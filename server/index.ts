import express, { type Request } from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { type TenantIdentity } from '../shared/tenant';
import {
  createUploadedFileRecord,
  getDb,
  getOrCreateTenant,
  listTenants,
  STORAGE_ROOT,
  updateTenant,
  UPLOAD_ROOT,
  writeAuditLog,
} from './db';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireSuperAdmin,
  sanitizeTenantId,
  targetTenantIdForRequest,
  warnIfInsecureSecret,
  type AuthenticatedRequest,
} from './auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = process.cwd();
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

type UploadKind = 'logo' | 'cover';

function pickTenantPatch(body: Record<string, unknown>): Partial<TenantIdentity> {
  const stringFields: Array<keyof TenantIdentity> = [
    'company_name',
    'primary_color',
    'secondary_color',
    'whatsapp_number',
    'support_email',
    'description',
    'logo_url',
    'cover_image_url',
  ];
  const patch: Partial<TenantIdentity> = {};
  for (const field of stringFields) {
    if (typeof body[field] === 'string') {
      patch[field] = String(body[field]).trim() as never;
    }
  }
  return patch;
}

async function readRequestBuffer(req: Request, limitBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let rejected = false;
    req.on('data', (chunk: Buffer) => {
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
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });
    req.on('error', error => {
      if (!rejected) reject(error);
    });
  });
}

function parseHeaderValue(header: string, name: string): string {
  const match = header.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match?.[1] || '';
}

function parseMultipartFile(
  body: Buffer,
  contentType: string,
  fieldName: string,
): { filename: string; mimeType: string; data: Buffer; formFields: Record<string, string> } {
  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) throw new Error('Invalid multipart/form-data request. Missing boundary.');

  const raw = body.toString('binary');
  const delimiter = `--${boundary}`;
  const parts = raw.split(delimiter).slice(1, -1);
  const formFields: Record<string, string> = {};
  let uploaded: { filename: string; mimeType: string; data: Buffer } | null = null;

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

    if (filename && partName === fieldName) {
      uploaded = {
        filename,
        mimeType,
        data: Buffer.from(content, 'binary'),
      };
    } else if (partName) {
      formFields[partName] = Buffer.from(content, 'binary').toString('utf8').trim();
    }
  }

  if (!uploaded) throw new Error(`Missing image file field '${fieldName}'.`);
  return { ...uploaded, formFields };
}

function hasValidImageSignature(data: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    return data.length > 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  }
  if (mimeType === 'image/jpeg') {
    return data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return data.length > 12 && data.slice(0, 4).toString('ascii') === 'RIFF' && data.slice(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function safeExtension(filename: string, mimeType: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  return '';
}

async function saveTenantImage(req: AuthenticatedRequest, kind: UploadKind) {
  if (!req.user) throw new Error('Authentication required.');
  const fieldName = kind;
  const maxBytes = kind === 'logo' ? MAX_LOGO_BYTES : MAX_COVER_BYTES;
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data.');
  }

  const buffer = await readRequestBuffer(req, maxBytes + 1024 * 512);
  const uploaded = parseMultipartFile(buffer, contentType, fieldName);
  if (uploaded.data.length > maxBytes) {
    throw new Error(`File is larger than the maximum allowed size of ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  }
  if (!ALLOWED_IMAGE_MIMES.has(uploaded.mimeType)) {
    throw new Error('Unsupported file type. Please upload png, jpg, jpeg, or webp only.');
  }
  if (!hasValidImageSignature(uploaded.data, uploaded.mimeType)) {
    throw new Error('Invalid image content. Please upload a real png, jpg, jpeg, or webp image.');
  }
  const ext = safeExtension(uploaded.filename, uploaded.mimeType);
  if (!ext) throw new Error('Unsupported image extension.');

  const targetTenantId = req.user.role === 'super_admin'
    ? sanitizeTenantId(req.params?.tenantId || req.query.tenantId || uploaded.formFields.tenant_id || req.user.tenant_id)
    : req.user.tenant_id;
  getOrCreateTenant(targetTenantId);
  const tenantDir = path.join(UPLOAD_ROOT, targetTenantId, kind);
  await fs.mkdir(tenantDir, { recursive: true });

  const fileName = `tenant-${targetTenantId}-${kind}-${Date.now()}${ext}`;
  const absoluteFile = path.join(tenantDir, fileName);
  await fs.writeFile(absoluteFile, uploaded.data);

  const publicUrl = `/uploads/tenants/${targetTenantId}/${kind}/${fileName}`;
  const next = updateTenant(targetTenantId, {
    [kind === 'logo' ? 'logo_url' : 'cover_image_url']: publicUrl,
  } as Partial<TenantIdentity>);

  createUploadedFileRecord({
    tenant_id: targetTenantId,
    file_type: kind,
    original_name: uploaded.filename,
    stored_name: fileName,
    file_path: absoluteFile,
    public_url: publicUrl,
    mime_type: uploaded.mimeType,
    size_bytes: uploaded.data.length,
    uploaded_by: req.user.id,
  });
  writeAuditLog({
    tenant_id: targetTenantId,
    user_id: req.user.id,
    action: `tenant.${kind}.upload`,
    entity_type: 'tenant',
    entity_id: targetTenantId,
    details: { fileName, mimeType: uploaded.mimeType, sizeBytes: uploaded.data.length },
    ip_address: req.ip,
  });
  return next;
}

async function startServer() {
  getDb();
  warnIfInsecureSecret();

  const app = express();
  const server = createServer(app);

  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(STORAGE_ROOT, 'uploads'), {
    fallthrough: false,
    immutable: true,
    maxAge: '30d',
  }));
  app.use(express.json({ limit: '256kb' }));
  app.use(optionalAuth);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'risks-dashboard-api', database: 'sqlite' });
  });

  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/logout', requireAuth, logoutHandler);
  app.get('/api/auth/me', requireAuth, meHandler);

  app.get('/api/customer/tenant', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required.' });
        return;
      }
      const tenant = getOrCreateTenant(req.user.tenant_id);
      res.json({ tenant });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load tenant identity.' });
    }
  });

  app.get('/api/admin/tenant', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const tenant = getOrCreateTenant(targetTenantIdForRequest(req));
      res.json({ tenant });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load tenant identity.' });
    }
  });

  app.patch('/api/admin/tenant', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const targetTenantId = targetTenantIdForRequest(req);
      const next = updateTenant(targetTenantId, pickTenantPatch(req.body || {}));
      writeAuditLog({
        tenant_id: targetTenantId,
        user_id: req.user?.id,
        action: 'tenant.identity.update',
        entity_type: 'tenant',
        entity_id: targetTenantId,
        details: pickTenantPatch(req.body || {}),
        ip_address: req.ip,
      });
      res.json({ tenant: next });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save tenant identity.' });
    }
  });

  app.post('/api/admin/tenant/logo', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const tenant = await saveTenantImage(req, 'logo');
      res.json({ tenant });
    } catch (error) {
      res.status(error instanceof Error && error.message.includes('Authentication') ? 401 : 400).json({ error: error instanceof Error ? error.message : 'Logo upload failed.' });
    }
  });

  app.post('/api/admin/tenant/cover', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const tenant = await saveTenantImage(req, 'cover');
      res.json({ tenant });
    } catch (error) {
      res.status(error instanceof Error && error.message.includes('Authentication') ? 401 : 400).json({ error: error instanceof Error ? error.message : 'Cover image upload failed.' });
    }
  });

  app.get('/api/super-admin/tenants', requireSuperAdmin, (_req, res) => {
    res.json({ tenants: listTenants() });
  });

  app.patch('/api/super-admin/tenants/:tenantId', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      req.body = { ...(req.body || {}), tenant_id: sanitizeTenantId(req.params.tenantId) };
      const targetTenantId = targetTenantIdForRequest(req);
      const next = updateTenant(targetTenantId, pickTenantPatch(req.body || {}));
      writeAuditLog({
        tenant_id: targetTenantId,
        user_id: req.user?.id,
        action: 'super_admin.tenant.identity.update',
        entity_type: 'tenant',
        entity_id: targetTenantId,
        details: pickTenantPatch(req.body || {}),
        ip_address: req.ip,
      });
      res.json({ tenant: next });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save tenant identity.' });
    }
  });

  app.post('/api/super-admin/tenants/:tenantId/logo', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      req.params.tenantId = sanitizeTenantId(req.params.tenantId);
      const tenant = await saveTenantImage(req, 'logo');
      res.json({ tenant });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Logo upload failed.' });
    }
  });

  app.post('/api/super-admin/tenants/:tenantId/cover', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      req.params.tenantId = sanitizeTenantId(req.params.tenantId);
      const tenant = await saveTenantImage(req, 'cover');
      res.json({ tenant });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Cover image upload failed.' });
    }
  });

  const staticPath =
    process.env.NODE_ENV === 'production'
      ? path.resolve(__dirname, '..')
      : path.resolve(PROJECT_ROOT, 'dist');

  app.use(express.static(staticPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });

  const defaultPort = process.env.NODE_ENV === 'production' ? 3000 : 4000;
  const port = Number(process.env.PORT || defaultPort);
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`SQLite database: ${path.join(PROJECT_ROOT, 'server', 'data', 'app.db')}`);
    console.log(`Tenant uploads stored at: ${UPLOAD_ROOT}`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
