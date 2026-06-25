/* Risk Dashboard Namecheap MySQL + Node.js API
 * Startup file for cPanel Node.js App: server/index.cjs
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const PROJECT_ROOT = process.cwd();
const SERVER_ROOT = __dirname;
const SCHEMA_FILE = path.join(SERVER_ROOT, 'schema.mysql.sql');
const STORAGE_ROOT = path.resolve(process.env.RISK_STORAGE_DIR || path.join(PROJECT_ROOT, 'server', 'storage'));
const UPLOAD_ROOT = path.join(STORAGE_ROOT, 'uploads');

loadLocalEnv(path.join(PROJECT_ROOT, '.env'));
loadLocalEnv(path.join(SERVER_ROOT, '.env'));

const ENV = {
  MYSQL_HOST: process.env.MYSQL_HOST || '127.0.0.1',
  MYSQL_PORT: Number(process.env.MYSQL_PORT || 3306),
  MYSQL_USER: process.env.MYSQL_USER || '',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || '',
  RISK_SESSION_SECRET: process.env.RISK_SESSION_SECRET || process.env.JWT_SECRET || 'dev-only-change-this-risk-secret',
  RISK_SESSION_TTL_HOURS: Number(process.env.RISK_SESSION_TTL_HOURS || 8),
  RISK_MAX_FAILED_LOGINS: Number(process.env.RISK_MAX_FAILED_LOGINS || 5),
  RISK_LOCKOUT_MINUTES: Number(process.env.RISK_LOCKOUT_MINUTES || 15),
  RISK_COOKIE_NAME: process.env.RISK_COOKIE_NAME || 'risk_session',
  RISK_COOKIE_DOMAIN: process.env.RISK_COOKIE_DOMAIN || '',
  RISK_COOKIE_SECURE: String(process.env.RISK_COOKIE_SECURE || '').toLowerCase() === 'true',
  API_PORT: Number(process.env.API_PORT || process.env.PORT || 4000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  RISK_CORS_ORIGINS: (process.env.RISK_CORS_ORIGINS || 'https://risks-dashboard.com,https://www.risks-dashboard.com,http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean),
};

const DEFAULT_TENANT_ID = 'risk-main';
const DEFAULT_TENANT = {
  id: DEFAULT_TENANT_ID,
  company_name: 'Risks Management',
  logo_url: '',
  cover_image_url: '',
  primary_color: '#073266',
  secondary_color: '#0078FF',
  whatsapp_number: '',
  support_email: '',
  description: 'Enterprise risk management dashboard identity.',
  updated_at: new Date(0).toISOString(),
};

let pool;

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv() {
  const missing = [];
  for (const key of ['MYSQL_USER', 'MYSQL_DATABASE']) {
    if (!ENV[key]) missing.push(key);
  }
  if (missing.length) {
    throw new Error(`Missing required Risk API environment variable(s): ${missing.join(', ')}`);
  }
  if (!process.env.RISK_SESSION_SECRET || ENV.RISK_SESSION_SECRET === 'dev-only-change-this-risk-secret') {
    console.warn('WARNING: RISK_SESSION_SECRET is not configured. Set a long random secret before production.');
  }
}

function getPool() {
  if (!pool) {
    requireEnv();
    pool = mysql.createPool({
      host: ENV.MYSQL_HOST,
      port: ENV.MYSQL_PORT,
      user: ENV.MYSQL_USER,
      password: ENV.MYSQL_PASSWORD,
      database: ENV.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 8,
      queueLimit: 0,
      charset: 'utf8mb4',
      timezone: 'Z',
      multipleStatements: false,
    });
  }
  return pool;
}

function splitSqlStatements(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

async function initSchema() {
  const db = getPool();
  const sql = await fsp.readFile(SCHEMA_FILE, 'utf8');
  for (const statement of splitSqlStatements(sql)) {
    await db.query(statement);
  }
  await seedDefaultUsers();
}

async function seedDefaultUsers() {
  const db = getPool();
  const [rows] = await db.query('SELECT COUNT(*) AS count FROM risk_users');
  if (Number(rows[0].count) > 0) return;
  const defaults = [
    { username: 'admin', display_name: 'System Admin', role_name: 'system_admin', password: 'Admin@12345' },
    { username: 'riskadmin', display_name: 'Risk Admin', role_name: 'risk_admin', password: 'RiskAdmin@12345' },
    { username: 'viewer', display_name: 'Viewer / Customer', role_name: 'viewer', password: 'Viewer@12345' },
  ];
  for (const user of defaults) {
    const hash = await bcrypt.hash(user.password, 12);
    await db.query(
      'INSERT INTO risk_users (username, password_hash, display_name, role_name, is_active) VALUES (?, ?, ?, ?, 1)',
      [user.username, hash, user.display_name, user.role_name],
    );
  }
  await audit(null, 'system.seed_users', { users: defaults.map(u => u.username) });
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    tenant_id: DEFAULT_TENANT_ID,
    username: row.username,
    email: row.username,
    name: row.display_name,
    display_name: row.display_name,
    role: row.role_name,
    role_name: row.role_name,
    is_active: Boolean(row.is_active),
    failed_attempts: Number(row.failed_attempts || 0),
    locked_until: row.locked_until ? new Date(row.locked_until).toISOString() : null,
    last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : '',
  };
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '').split(',')[0].trim();
}

async function audit(reqOrNull, action, details = {}, userOverride = null) {
  try {
    const db = getPool();
    const req = reqOrNull;
    const user = userOverride || req?.user || null;
    await db.query(
      'INSERT INTO risk_audit_logs (user_id, username, action, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [
        user?.id ? Number(user.id) : null,
        user?.username || null,
        action,
        JSON.stringify(details || {}),
        req ? clientIp(req) : null,
        req ? String(req.headers['user-agent'] || '') : null,
      ],
    );
  } catch (err) {
    console.warn('Audit log write failed:', err.message);
  }
}

function cookieOptions() {
  const opts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: ENV.RISK_COOKIE_SECURE || ENV.NODE_ENV === 'production',
    maxAge: ENV.RISK_SESSION_TTL_HOURS * 60 * 60 * 1000,
    path: '/',
  };
  if (ENV.RISK_COOKIE_DOMAIN) opts.domain = ENV.RISK_COOKIE_DOMAIN;
  return opts;
}

function signSession(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    ENV.RISK_SESSION_SECRET,
    { expiresIn: `${ENV.RISK_SESSION_TTL_HOURS}h` },
  );
}

function extractToken(req) {
  const cookieToken = req.cookies?.[ENV.RISK_COOKIE_NAME];
  if (cookieToken) return cookieToken;
  const auth = String(req.headers.authorization || '');
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

async function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, ENV.RISK_SESSION_SECRET);
    const [rows] = await getPool().query('SELECT * FROM risk_users WHERE id = ? AND is_active = 1', [payload.sub]);
    if (rows[0]) req.user = toPublicUser(rows[0]);
  } catch {
    // Protected routes will reject invalid/expired tokens.
  }
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  return next();
}

function hasRole(user, allowed) {
  return Boolean(user && allowed.includes(user.role));
}

function requireSystemAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (!hasRole(req.user, ['system_admin'])) return res.status(403).json({ error: 'System Admin permission required.' });
  return next();
}

function requireRiskAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (!hasRole(req.user, ['system_admin', 'risk_admin'])) return res.status(403).json({ error: 'Risk Admin permission required.' });
  return next();
}

async function loginHandler(req, res) {
  const username = String(req.body?.username || req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  const db = getPool();
  const [rows] = await db.query('SELECT * FROM risk_users WHERE LOWER(username) = LOWER(?) LIMIT 1', [username]);
  const row = rows[0];
  const generic = 'Invalid username or password.';

  if (!row) {
    await audit(req, 'auth.login_failed', { username, reason: 'unknown_user' });
    return res.status(401).json({ error: generic });
  }
  if (!row.is_active) {
    await audit(req, 'auth.login_failed', { username, reason: 'inactive_user' }, toPublicUser(row));
    return res.status(403).json({ error: 'This account is inactive.' });
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    await audit(req, 'auth.login_blocked_locked', { username, locked_until: row.locked_until }, toPublicUser(row));
    return res.status(423).json({ error: 'Too many failed login attempts. Try again later.' });
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    const failedAttempts = Number(row.failed_attempts || 0) + 1;
    const shouldLock = failedAttempts >= ENV.RISK_MAX_FAILED_LOGINS;
    const lockedUntilSql = shouldLock ? `DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${Math.max(1, ENV.RISK_LOCKOUT_MINUTES)} MINUTE)` : 'NULL';
    await db.query(`UPDATE risk_users SET failed_attempts = ?, locked_until = ${lockedUntilSql} WHERE id = ?`, [failedAttempts, row.id]);
    await audit(req, 'auth.login_failed', { username, failed_attempts: failedAttempts, locked: shouldLock }, toPublicUser(row));
    return res.status(401).json({ error: generic });
  }

  await db.query('UPDATE risk_users SET failed_attempts = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP() WHERE id = ?', [row.id]);
  const [freshRows] = await db.query('SELECT * FROM risk_users WHERE id = ?', [row.id]);
  const user = toPublicUser(freshRows[0] || row);
  const token = signSession(user);
  res.cookie(ENV.RISK_COOKIE_NAME, token, cookieOptions());
  await audit(req, 'auth.login', {}, user);
  return res.json({ ok: true, token, user, tenant: await getTenantIdentity() });
}

async function logoutHandler(req, res) {
  await audit(req, 'auth.logout');
  res.clearCookie(ENV.RISK_COOKIE_NAME, { path: '/', domain: ENV.RISK_COOKIE_DOMAIN || undefined });
  return res.json({ ok: true });
}

async function meHandler(req, res) {
  return res.json({ user: req.user, tenant: await getTenantIdentity() });
}

async function changePasswordHandler(req, res) {
  const currentPassword = String(req.body?.current_password || req.body?.currentPassword || '');
  const newPassword = String(req.body?.new_password || req.body?.newPassword || '');
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current password and new password are required.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  if (currentPassword === newPassword) return res.status(400).json({ error: 'New password must be different from the current password.' });

  const db = getPool();
  const [rows] = await db.query('SELECT * FROM risk_users WHERE id = ? AND is_active = 1 LIMIT 1', [req.user.id]);
  const row = rows[0];
  if (!row) return res.status(404).json({ error: 'User account was not found.' });

  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) {
    await audit(req, 'auth.password_change_failed', { reason: 'invalid_current_password' });
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await db.query('UPDATE risk_users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP() WHERE id = ?', [hash, row.id]);
  await audit(req, 'auth.password_change', { id: row.id });
  return res.json({ ok: true });
}

async function getSettingsMap() {
  const [rows] = await getPool().query('SELECT setting_key, setting_value, updated_at FROM risk_app_settings');
  const settings = {};
  let updatedAt = null;
  for (const row of rows) {
    settings[row.setting_key] = row.setting_value;
    if (!updatedAt || new Date(row.updated_at) > new Date(updatedAt)) updatedAt = row.updated_at;
  }
  return { settings, updatedAt };
}

async function getTenantIdentity() {
  const { settings, updatedAt } = await getSettingsMap();
  return {
    ...DEFAULT_TENANT,
    company_name: settings.company_name || DEFAULT_TENANT.company_name,
    logo_url: settings.logo_url || '',
    cover_image_url: settings.cover_image_url || '',
    primary_color: settings.primary_color || DEFAULT_TENANT.primary_color,
    secondary_color: settings.secondary_color || DEFAULT_TENANT.secondary_color,
    whatsapp_number: settings.whatsapp_number || '',
    support_email: settings.support_email || '',
    description: settings.description || DEFAULT_TENANT.description,
    updated_at: updatedAt ? new Date(updatedAt).toISOString() : DEFAULT_TENANT.updated_at,
  };
}

async function saveSetting(key, value) {
  await getPool().query(
    'INSERT INTO risk_app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = UTC_TIMESTAMP()',
    [key, typeof value === 'string' ? value : JSON.stringify(value ?? null)],
  );
}

function pickIdentityPatch(body) {
  const keys = ['company_name', 'logo_url', 'cover_image_url', 'primary_color', 'secondary_color', 'whatsapp_number', 'support_email', 'description'];
  const patch = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) patch[key] = String(body[key] ?? '').trim();
  }
  return patch;
}

async function getAppSettings(req, res) {
  const { settings } = await getSettingsMap();
  return res.json({ settings });
}

async function postAppSettings(req, res) {
  const body = req.body || {};
  const entries = body.settings && typeof body.settings === 'object'
    ? Object.entries(body.settings)
    : body.setting_key
      ? [[String(body.setting_key), body.setting_value]]
      : Object.entries(body);
  for (const [key, value] of entries) {
    if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(key)) return res.status(400).json({ error: `Invalid setting key: ${key}` });
    await saveSetting(key, value);
  }
  await audit(req, 'settings.update', { keys: entries.map(([key]) => key) });
  const { settings } = await getSettingsMap();
  return res.json({ ok: true, settings });
}

async function listUsers(_req, res) {
  const [rows] = await getPool().query('SELECT id, username, display_name, role_name, is_active, failed_attempts, locked_until, last_login_at, created_at, updated_at FROM risk_users ORDER BY id');
  return res.json({ users: rows.map(toPublicUser) });
}

function validateRole(role) {
  if (!['system_admin', 'risk_admin', 'viewer'].includes(role)) throw new Error('Invalid role_name. Allowed: system_admin, risk_admin, viewer.');
  return role;
}

async function createUser(req, res) {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.display_name || req.body?.name || username).trim();
  let roleName;
  try { roleName = validateRole(String(req.body?.role_name || req.body?.role || 'viewer')); } catch (err) { return res.status(400).json({ error: err.message }); }
  if (!/^[a-z0-9._-]{3,80}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-80 characters and use letters, numbers, dot, dash, or underscore only.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const hash = await bcrypt.hash(password, 12);
  try {
    const [result] = await getPool().query('INSERT INTO risk_users (username, password_hash, display_name, role_name, is_active) VALUES (?, ?, ?, ?, ?)', [username, hash, displayName, roleName, req.body?.is_active === false ? 0 : 1]);
    await audit(req, 'users.create', { id: result.insertId, username, role_name: roleName });
    const [rows] = await getPool().query('SELECT * FROM risk_users WHERE id = ?', [result.insertId]);
    return res.status(201).json({ user: toPublicUser(rows[0]) });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists.' });
    throw err;
  }
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id.' });
  const fields = [];
  const values = [];
  if (typeof req.body?.display_name === 'string') { fields.push('display_name = ?'); values.push(req.body.display_name.trim()); }
  if (typeof req.body?.role_name === 'string' || typeof req.body?.role === 'string') {
    try { values.push(validateRole(String(req.body.role_name || req.body.role))); fields.push('role_name = ?'); } catch (err) { return res.status(400).json({ error: err.message }); }
  }
  if (typeof req.body?.is_active === 'boolean') { fields.push('is_active = ?'); values.push(req.body.is_active ? 1 : 0); }
  if (!fields.length) return res.status(400).json({ error: 'No supported user fields were provided.' });
  values.push(id);
  await getPool().query(`UPDATE risk_users SET ${fields.join(', ')}, updated_at = UTC_TIMESTAMP() WHERE id = ?`, values);
  await audit(req, 'users.update', { id, fields: fields.map(f => f.split(' ')[0]) });
  const [rows] = await getPool().query('SELECT * FROM risk_users WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: toPublicUser(rows[0]) });
}

async function resetPassword(req, res) {
  const id = Number(req.params.id);
  const password = String(req.body?.password || req.body?.new_password || '');
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const hash = await bcrypt.hash(password, 12);
  await getPool().query('UPDATE risk_users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = UTC_TIMESTAMP() WHERE id = ?', [hash, id]);
  await audit(req, 'users.reset_password', { id });
  return res.json({ ok: true });
}

async function toggleActive(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id.' });
  await getPool().query('UPDATE risk_users SET is_active = IF(is_active = 1, 0, 1), updated_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
  await audit(req, 'users.toggle_active', { id });
  const [rows] = await getPool().query('SELECT * FROM risk_users WHERE id = ?', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user: toPublicUser(rows[0]) });
}

async function getAuditLogs(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
  const [rows] = await getPool().query('SELECT * FROM risk_audit_logs ORDER BY created_at DESC LIMIT ?', [limit]);
  return res.json({ audit_logs: rows.map(row => ({ ...row, details: typeof row.details === 'string' ? safeJson(row.details) : row.details })) });
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return value; }
}

async function getDashboardState(req, res) {
  const key = String(req.query.key || 'default');
  const [rows] = await getPool().query('SELECT * FROM risk_dashboard_state WHERE state_key = ? LIMIT 1', [key]);
  const row = rows[0];
  return res.json({ key, state: row?.state_value ? safeJson(row.state_value) : null, updated_at: row?.updated_at || null });
}

async function postDashboardState(req, res) {
  const key = String(req.body?.key || 'default');
  if (!/^[a-zA-Z0-9_.-]{1,120}$/.test(key)) return res.status(400).json({ error: 'Invalid dashboard state key.' });
  const state = req.body?.state ?? req.body?.state_value ?? null;
  await getPool().query(
    'INSERT INTO risk_dashboard_state (state_key, state_value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE state_value = VALUES(state_value), updated_by = VALUES(updated_by), updated_at = UTC_TIMESTAMP()',
    [key, JSON.stringify(state), Number(req.user.id)],
  );
  await audit(req, 'dashboard_state.update', { key });
  return res.json({ ok: true, key, state });
}

async function patchTenant(req, res) {
  const patch = pickIdentityPatch(req.body || {});
  for (const [key, value] of Object.entries(patch)) await saveSetting(key, value);
  await audit(req, 'tenant.identity.update', { keys: Object.keys(patch) });
  return res.json({ tenant: await getTenantIdentity() });
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function parseHeaderValue(header, name) {
  const match = header.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match?.[1] || '';
}

async function readRequestBuffer(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let rejected = false;
    req.on('data', chunk => {
      if (rejected) return;
      total += chunk.length;
      if (total > limitBytes) {
        rejected = true;
        reject(new Error(`File is larger than the maximum allowed size of ${Math.round(limitBytes / 1024 / 1024)} MB.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)); });
    req.on('error', err => { if (!rejected) reject(err); });
  });
}

function parseMultipartFile(body, contentType, fieldName) {
  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) throw new Error('Invalid multipart/form-data request. Missing boundary.');
  const raw = body.toString('binary');
  const parts = raw.split(`--${boundary}`).slice(1, -1);
  let uploaded = null;
  for (const part of parts) {
    const clean = part.replace(/^\r\n/, '');
    const index = clean.indexOf('\r\n\r\n');
    if (index < 0) continue;
    const headerBlock = clean.slice(0, index);
    let content = clean.slice(index + 4);
    if (content.endsWith('\r\n')) content = content.slice(0, -2);
    const disposition = headerBlock.split('\r\n').find(line => line.toLowerCase().startsWith('content-disposition')) || '';
    const partName = parseHeaderValue(disposition, 'name');
    const filename = parseHeaderValue(disposition, 'filename');
    const typeLine = headerBlock.split('\r\n').find(line => line.toLowerCase().startsWith('content-type')) || '';
    const mimeType = typeLine.split(':').slice(1).join(':').trim().toLowerCase();
    if (filename && partName === fieldName) uploaded = { filename, mimeType, data: Buffer.from(content, 'binary') };
  }
  if (!uploaded) throw new Error(`Missing image file field '${fieldName}'.`);
  return uploaded;
}

function validImageSignature(data, mimeType) {
  if (mimeType === 'image/png') return data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  if (mimeType === 'image/jpeg') return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mimeType === 'image/webp') return data.length > 12 && data.slice(0, 4).toString('ascii') === 'RIFF' && data.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}

function safeExt(filename, mimeType) {
  const ext = path.extname(filename).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '';
}

async function uploadTenantImage(req, res, kind) {
  const maxBytes = kind === 'logo' ? MAX_LOGO_BYTES : MAX_COVER_BYTES;
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().includes('multipart/form-data')) return res.status(400).json({ error: 'Content-Type must be multipart/form-data.' });
  const buffer = await readRequestBuffer(req, maxBytes + 512 * 1024);
  const uploaded = parseMultipartFile(buffer, contentType, kind);
  if (uploaded.data.length > maxBytes) return res.status(400).json({ error: 'File is too large.' });
  if (!ALLOWED_MIMES.has(uploaded.mimeType)) return res.status(400).json({ error: 'Unsupported file type. Please upload png, jpg, jpeg, or webp only.' });
  if (!validImageSignature(uploaded.data, uploaded.mimeType)) return res.status(400).json({ error: 'Invalid image content.' });
  const ext = safeExt(uploaded.filename, uploaded.mimeType);
  if (!ext) return res.status(400).json({ error: 'Unsupported image extension.' });
  const dir = path.join(UPLOAD_ROOT, 'branding', kind);
  await fsp.mkdir(dir, { recursive: true });
  const fileName = `risk-${kind}-${Date.now()}${ext}`;
  const absoluteFile = path.join(dir, fileName);
  await fsp.writeFile(absoluteFile, uploaded.data);
  const publicUrl = `/uploads/branding/${kind}/${fileName}`;
  await saveSetting(kind === 'logo' ? 'logo_url' : 'cover_image_url', publicUrl);
  await audit(req, `tenant.${kind}.upload`, { original_name: uploaded.filename, public_url: publicUrl, size: uploaded.data.length });
  return res.json({ tenant: await getTenantIdentity() });
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  if (origin && ENV.RISK_CORS_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

async function createApp() {
  await fsp.mkdir(UPLOAD_ROOT, { recursive: true });
  await initSchema();

  const app = express();
  app.disable('x-powered-by');
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use('/uploads', express.static(UPLOAD_ROOT, { fallthrough: false, immutable: true, maxAge: '30d' }));

  // JSON parser is applied after upload routes because image uploads use raw multipart parsing.
  app.post('/api/admin/tenant/logo', optionalAuth, requireRiskAdmin, asyncRoute((req, res) => uploadTenantImage(req, res, 'logo')));
  app.post('/api/admin/tenant/cover', optionalAuth, requireRiskAdmin, asyncRoute((req, res) => uploadTenantImage(req, res, 'cover')));
  app.post('/api/super-admin/tenants/:tenantId/logo', optionalAuth, requireSystemAdmin, asyncRoute((req, res) => uploadTenantImage(req, res, 'logo')));
  app.post('/api/super-admin/tenants/:tenantId/cover', optionalAuth, requireSystemAdmin, asyncRoute((req, res) => uploadTenantImage(req, res, 'cover')));

  app.use(express.json({ limit: '512kb' }));
  app.use(optionalAuth);

  app.get('/api/health', asyncRoute(async (_req, res) => {
    await getPool().query('SELECT 1');
    res.json({ ok: true, service: 'risk-dashboard-api', database: 'mysql', hosting: 'namecheap', timestamp: new Date().toISOString() });
  }));

  app.post('/api/auth/login', asyncRoute(loginHandler));
  app.post('/api/auth/logout', requireAuth, asyncRoute(logoutHandler));
  app.get('/api/auth/me', requireAuth, asyncRoute(meHandler));
  app.post('/api/auth/change-password', requireAuth, asyncRoute(changePasswordHandler));

  app.get('/api/app/settings', requireAuth, asyncRoute(getAppSettings));
  app.post('/api/app/settings', requireRiskAdmin, asyncRoute(postAppSettings));

  app.get('/api/app/users', requireSystemAdmin, asyncRoute(listUsers));
  app.post('/api/app/users', requireSystemAdmin, asyncRoute(createUser));
  app.put('/api/app/users/:id', requireSystemAdmin, asyncRoute(updateUser));
  app.post('/api/app/users/:id/reset-password', requireSystemAdmin, asyncRoute(resetPassword));
  app.post('/api/app/users/:id/toggle-active', requireSystemAdmin, asyncRoute(toggleActive));

  app.get('/api/app/audit-logs', requireSystemAdmin, asyncRoute(getAuditLogs));
  app.get('/api/app/dashboard-state', requireAuth, asyncRoute(getDashboardState));
  app.post('/api/app/dashboard-state', requireRiskAdmin, asyncRoute(postDashboardState));

  // Compatibility endpoints used by the current React pages for company identity.
  app.get('/api/customer/tenant', requireAuth, asyncRoute(async (_req, res) => res.json({ tenant: await getTenantIdentity() })));
  app.get('/api/admin/tenant', requireRiskAdmin, asyncRoute(async (_req, res) => res.json({ tenant: await getTenantIdentity() })));
  app.patch('/api/admin/tenant', requireRiskAdmin, asyncRoute(patchTenant));
  app.get('/api/super-admin/tenants', requireSystemAdmin, asyncRoute(async (_req, res) => res.json({ tenants: [await getTenantIdentity()] })));
  app.patch('/api/super-admin/tenants/:tenantId', requireSystemAdmin, asyncRoute(patchTenant));

  app.use((err, req, res, _next) => {
    console.error('Risk API error:', err);
    const status = err.status || 500;
    res.status(status).json({ error: status >= 500 ? 'Internal server error.' : err.message });
  });

  return app;
}

async function main() {
  if (process.argv.includes('--init-only')) {
    await initSchema();
    console.log('Risk Dashboard MySQL schema initialized successfully.');
    await getPool().end();
    return;
  }
  const app = await createApp();
  const server = http.createServer(app);
  server.listen(ENV.API_PORT, () => {
    console.log(`Risk Dashboard API running on http://127.0.0.1:${ENV.API_PORT}`);
    console.log(`MySQL database: ${ENV.MYSQL_DATABASE}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
