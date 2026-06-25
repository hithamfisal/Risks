import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserById, getTenantById, publicUser, updateLastLogin, writeAuditLog } from './db';
import type { AuthUser, UserRole } from '../shared/auth';
import type { TenantIdentity } from '../shared/tenant';

export const SESSION_COOKIE = 'risks_session';
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 7);
const FALLBACK_SECRET = 'dev-only-change-this-secret-before-production';
const JWT_SECRET = process.env.JWT_SECRET || FALLBACK_SECRET;

type TokenPayload = {
  sub: string;
  tenant_id: string;
  role: UserRole;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
  tenant?: TenantIdentity | null;
};

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function signSession(user: AuthUser) {
  return jwt.sign({ sub: user.id, tenant_id: user.tenant_id, role: user.role } satisfies TokenPayload, JWT_SECRET, {
    expiresIn: `${SESSION_DAYS}d`,
  });
}

export async function loginHandler(req: Request, res: Response) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const userRow = findUserByEmail(email);
  if (!userRow || !userRow.is_active) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const ok = await bcrypt.compare(password, userRow.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  updateLastLogin(userRow.id);
  const freshUser = findUserById(userRow.id) || userRow;
  const user = publicUser(freshUser);
  const tenant = getTenantById(user.tenant_id);
  const token = signSession(user);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  writeAuditLog({ tenant_id: user.tenant_id, user_id: user.id, action: 'auth.login', entity_type: 'user', entity_id: user.id, ip_address: req.ip });
  res.json({ user, tenant });
}

export function logoutHandler(req: AuthenticatedRequest, res: Response) {
  if (req.user) {
    writeAuditLog({ tenant_id: req.user.tenant_id, user_id: req.user.id, action: 'auth.logout', entity_type: 'user', entity_id: req.user.id, ip_address: req.ip });
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const raw = req.cookies?.[SESSION_COOKIE] || '';
  if (!raw) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(raw, JWT_SECRET) as TokenPayload;
    const userRow = findUserById(payload.sub);
    if (userRow && userRow.is_active) {
      req.user = publicUser(userRow);
      req.tenant = getTenantById(userRow.tenant_id);
    }
  } catch {
    // Ignore invalid cookies here; protected routes will reject.
  }
  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'tenant_admin' && req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Admin permission required.' });
    return;
  }
  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin permission required.' });
    return;
  }
  next();
}

export function meHandler(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  res.json({ user: req.user, tenant: req.tenant || getTenantById(req.user.tenant_id) });
}

export function targetTenantIdForRequest(req: AuthenticatedRequest): string {
  if (!req.user) throw new Error('Authentication required.');
  if (req.user.role === 'super_admin') {
    const queryTenant = typeof req.query.tenantId === 'string' ? req.query.tenantId : '';
    const bodyTenant = typeof req.body?.tenant_id === 'string' ? req.body.tenant_id : '';
    const paramTenant = typeof req.params?.tenantId === 'string' ? req.params.tenantId : '';
    return sanitizeTenantId(paramTenant || queryTenant || bodyTenant || req.user.tenant_id);
  }
  return req.user.tenant_id;
}

export function sanitizeTenantId(value: unknown): string {
  const raw = String(value || '').trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  return safe || 'tenant-demo';
}

export function warnIfInsecureSecret() {
  if (!process.env.JWT_SECRET || JWT_SECRET === FALLBACK_SECRET) {
    console.warn('WARNING: JWT_SECRET is not configured. Set a strong JWT_SECRET before production use.');
  }
}
