import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_IDENTITY, type TenantIdentity } from '../shared/tenant';
import type { AuthUser, UserRole } from '../shared/auth';

const PROJECT_ROOT = process.cwd();
export const DATA_ROOT = path.resolve(process.env.SQLITE_DATA_DIR || path.join(PROJECT_ROOT, 'server', 'data'));
export const STORAGE_ROOT = path.resolve(process.env.TENANT_STORAGE_DIR || path.join(PROJECT_ROOT, 'server', 'storage'));
export const UPLOAD_ROOT = path.join(STORAGE_ROOT, 'uploads', 'tenants');
export const DATABASE_FILE = path.resolve(process.env.SQLITE_DB_FILE || path.join(DATA_ROOT, 'app.db'));

export type DbUserRow = AuthUser & { password_hash: string };

let db: Database.Database | null = null;

function now() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function getDb() {
  if (db) return db;
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  db = new Database(DATABASE_FILE);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  seedDefaults(db);
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      logo_url TEXT NOT NULL DEFAULT '',
      cover_image_url TEXT NOT NULL DEFAULT '',
      primary_color TEXT NOT NULL DEFAULT '#073266',
      secondary_color TEXT NOT NULL DEFAULT '#0078FF',
      whatsapp_number TEXT NOT NULL DEFAULT '',
      support_email TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('super_admin','tenant_admin','tenant_user','viewer')),
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('logo','cover')),
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      public_url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_by TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (tenant_id, setting_key),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_tenant_id ON uploaded_files(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id_created_at ON audit_logs(tenant_id, created_at);
  `);
}

function seedDefaults(database: Database.Database) {
  const timestamp = now();
  const insertTenant = database.prepare(`
    INSERT OR IGNORE INTO tenants (
      id, company_name, logo_url, cover_image_url, primary_color, secondary_color,
      whatsapp_number, support_email, description, created_at, updated_at
    ) VALUES (
      @id, @company_name, @logo_url, @cover_image_url, @primary_color, @secondary_color,
      @whatsapp_number, @support_email, @description, @created_at, @updated_at
    )
  `);

  insertTenant.run({
    ...DEFAULT_TENANT_IDENTITY,
    created_at: timestamp,
    updated_at: timestamp,
  });
  insertTenant.run({
    ...DEFAULT_TENANT_IDENTITY,
    id: 'tenant-sample-2',
    company_name: 'Sample Tenant 2',
    description: 'Second tenant for isolation testing.',
    created_at: timestamp,
    updated_at: timestamp,
  });

  const countUsers = database.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (countUsers.count > 0) return;

  const defaultPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const passwordHash = bcrypt.hashSync(defaultPassword, 12);
  const insertUser = database.prepare(`
    INSERT INTO users (id, tenant_id, name, email, password_hash, role, is_active, last_login_at, created_at, updated_at)
    VALUES (@id, @tenant_id, @name, @email, @password_hash, @role, 1, NULL, @created_at, @updated_at)
  `);

  insertUser.run({
    id: 'user_super_admin',
    tenant_id: DEFAULT_TENANT_ID,
    name: 'Risks Super Admin',
    email: 'super@risks.local',
    password_hash: passwordHash,
    role: 'super_admin',
    created_at: timestamp,
    updated_at: timestamp,
  });
  insertUser.run({
    id: 'user_tenant_admin',
    tenant_id: DEFAULT_TENANT_ID,
    name: 'Risks Tenant Admin',
    email: 'tenant@risks.local',
    password_hash: passwordHash,
    role: 'tenant_admin',
    created_at: timestamp,
    updated_at: timestamp,
  });
  insertUser.run({
    id: 'user_tenant2_admin',
    tenant_id: 'tenant-sample-2',
    name: 'Second Tenant Admin',
    email: 'tenant2@risks.local',
    password_hash: passwordHash,
    role: 'tenant_admin',
    created_at: timestamp,
    updated_at: timestamp,
  });
  insertUser.run({
    id: 'user_customer_viewer',
    tenant_id: DEFAULT_TENANT_ID,
    name: 'Risks Customer Viewer',
    email: 'customer@risks.local',
    password_hash: passwordHash,
    role: 'tenant_user',
    created_at: timestamp,
    updated_at: timestamp,
  });
  insertUser.run({
    id: 'user_tenant2_customer',
    tenant_id: 'tenant-sample-2',
    name: 'Second Tenant Customer',
    email: 'customer2@risks.local',
    password_hash: passwordHash,
    role: 'tenant_user',
    created_at: timestamp,
    updated_at: timestamp,
  });
}

export function rowToTenant(row: Record<string, unknown>): TenantIdentity {
  return {
    id: String(row.id || DEFAULT_TENANT_ID),
    company_name: String(row.company_name || ''),
    logo_url: String(row.logo_url || ''),
    cover_image_url: String(row.cover_image_url || ''),
    primary_color: String(row.primary_color || '#073266'),
    secondary_color: String(row.secondary_color || '#0078FF'),
    whatsapp_number: String(row.whatsapp_number || ''),
    support_email: String(row.support_email || ''),
    description: String(row.description || ''),
    updated_at: String(row.updated_at || new Date(0).toISOString()),
  };
}

export function getTenantById(id: string): TenantIdentity | null {
  const row = getDb().prepare('SELECT * FROM tenants WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToTenant(row) : null;
}

export function getOrCreateTenant(id: string): TenantIdentity {
  const existing = getTenantById(id);
  if (existing) return existing;
  const timestamp = now();
  const tenant = {
    ...DEFAULT_TENANT_IDENTITY,
    id,
    company_name: id === DEFAULT_TENANT_ID ? DEFAULT_TENANT_IDENTITY.company_name : `Company ${id}`,
    created_at: timestamp,
    updated_at: timestamp,
  };
  getDb().prepare(`
    INSERT INTO tenants (id, company_name, logo_url, cover_image_url, primary_color, secondary_color, whatsapp_number, support_email, description, created_at, updated_at)
    VALUES (@id, @company_name, @logo_url, @cover_image_url, @primary_color, @secondary_color, @whatsapp_number, @support_email, @description, @created_at, @updated_at)
  `).run(tenant);
  return rowToTenant(tenant);
}

export function listTenants(): TenantIdentity[] {
  const rows = getDb().prepare('SELECT * FROM tenants ORDER BY company_name COLLATE NOCASE').all() as Record<string, unknown>[];
  return rows.map(rowToTenant);
}

export function updateTenant(id: string, patch: Partial<TenantIdentity>): TenantIdentity {
  const existing = getOrCreateTenant(id);
  const next = {
    ...existing,
    ...patch,
    id,
    updated_at: now(),
  };
  getDb().prepare(`
    UPDATE tenants SET
      company_name = @company_name,
      logo_url = @logo_url,
      cover_image_url = @cover_image_url,
      primary_color = @primary_color,
      secondary_color = @secondary_color,
      whatsapp_number = @whatsapp_number,
      support_email = @support_email,
      description = @description,
      updated_at = @updated_at
    WHERE id = @id
  `).run(next);
  return next;
}

export function findUserByEmail(email: string): DbUserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email.trim()) as DbUserRow | undefined;
  return row || null;
}

export function findUserById(id: string): DbUserRow | null {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUserRow | undefined;
  return row || null;
}

export function publicUser(user: DbUserRow): AuthUser {
  const { password_hash: _passwordHash, ...safe } = user;
  return { ...safe, is_active: Boolean(user.is_active) };
}

export function updateLastLogin(userId: string) {
  getDb().prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), userId);
}

export function createUploadedFileRecord(input: {
  tenant_id: string;
  file_type: 'logo' | 'cover';
  original_name: string;
  stored_name: string;
  file_path: string;
  public_url: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by?: string | null;
}) {
  getDb().prepare(`
    INSERT INTO uploaded_files (id, tenant_id, file_type, original_name, stored_name, file_path, public_url, mime_type, size_bytes, uploaded_by, created_at)
    VALUES (@id, @tenant_id, @file_type, @original_name, @stored_name, @file_path, @public_url, @mime_type, @size_bytes, @uploaded_by, @created_at)
  `).run({ id: randomId('file'), created_at: now(), uploaded_by: input.uploaded_by || null, ...input });
}

export function writeAuditLog(input: {
  tenant_id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, unknown>;
  ip_address?: string;
}) {
  getDb().prepare(`
    INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, details_json, ip_address, created_at)
    VALUES (@id, @tenant_id, @user_id, @action, @entity_type, @entity_id, @details_json, @ip_address, @created_at)
  `).run({
    id: randomId('audit'),
    tenant_id: input.tenant_id,
    user_id: input.user_id || null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    details_json: JSON.stringify(input.details || {}),
    ip_address: input.ip_address || '',
    created_at: now(),
  });
}

export function isAdminRole(role: UserRole) {
  return role === 'super_admin' || role === 'tenant_admin';
}
