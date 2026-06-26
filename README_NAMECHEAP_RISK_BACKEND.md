# Risk Dashboard — Namecheap MySQL + Node.js API Deployment

This package is for the **Risk Dashboard only**. It is prepared for Namecheap hosting only and uses Risk-specific table names, variables, and API labels.

## 1. What changed

- Added a Namecheap-compatible Node.js backend at `server/index.cjs`.
- Added MySQL schema at `server/schema.mysql.sql`.
- Added `.env.example` for Namecheap cPanel environment variables.
- Updated frontend login to call the backend API using `username` instead of local/browser-only credentials.
- Updated roles to:
  - `system_admin`
  - `risk_admin`
  - `viewer`
- Updated package scripts:
  - `dev:api`
  - `mysql:init`
  - `check`
  - `build`
- Kept existing dashboard upload, Excel parsing, KPI, chart, table, filter, and export logic unchanged.

## 2. Backend API URL structure

Frontend:

```text
https://risks-dashboard.com/
```

Backend API:

```text
https://api.risks-dashboard.com/
```

Database:

```text
Namecheap cPanel MySQL
```

## 3. MySQL database setup in Namecheap cPanel

Create from cPanel:

```text
Database: cpaneluser_risk_dashboard
User:     cpaneluser_risk_user
Privileges: ALL PRIVILEGES
```

Then import:

```text
server/schema.mysql.sql
```

The schema creates these tables:

- `risk_users`
- `risk_app_settings`
- `risk_audit_logs`
- `risk_dashboard_state`
- `risk_saved_workbooks`

## 4. Node.js app setup in Namecheap cPanel

Suggested cPanel Node.js settings:

```text
Application root: risk-api
Application URL:  api.risks-dashboard.com
Startup file:     server/index.cjs
Node version:     20 or 22 if available
```

Upload the project files or at minimum these backend files to the Node app root:

```text
server/index.cjs
server/schema.mysql.sql
package.json
yarn.lock
.env
```

Create `.env` from `.env.example` and set real values:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=cpaneluser_risk_user
MYSQL_PASSWORD=DATABASE_PASSWORD
MYSQL_DATABASE=cpaneluser_risk_dashboard
RISK_SKIP_CREATE_DATABASE=1
RISK_SESSION_SECRET=LONG_RANDOM_SECRET_CHANGE_THIS
RISK_SEED_ADMIN_PASSWORD=ONE_TIME_ADMIN_PASSWORD_CHANGE_AFTER_LOGIN
RISK_SESSION_TTL_HOURS=8
RISK_MAX_FAILED_LOGINS=5
RISK_LOCKOUT_MINUTES=15
RISK_COOKIE_NAME=risk_session
RISK_COOKIE_DOMAIN=.risks-dashboard.com
RISK_COOKIE_SECURE=true
API_PORT=4000
NODE_ENV=production
RISK_CORS_ORIGINS=https://risks-dashboard.com,https://www.risks-dashboard.com
# Optional for Vercel preview deployments:
# RISK_CORS_ORIGIN_PATTERNS=^https://[a-z0-9-]+\\.vercel\\.app$
```

Do not upload `.env` to GitHub.

## 5. Backend commands

Install dependencies:

```bash
yarn install
```

Initialize MySQL schema and seed default users:

```bash
yarn mysql:init
```

Run API locally:

```bash
yarn dev:api
```

Local health check:

```text
http://127.0.0.1:4000/api/health
```

Production health check:

```text
https://api.risks-dashboard.com/api/health
```

## 6. First admin user

When the production database has no users, the API creates one `system_admin` user named `admin`.
Set `RISK_SEED_ADMIN_PASSWORD` in `.env` before the first start. The password must be at least 12 characters.
The first admin is forced to change this password after login, then create the Risk Admin and Viewer users from System Management.

## 7. API endpoints included

### Health

```text
GET /api/health
```

### Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/change-password
```

Login body:

```json
{
  "username": "admin",
  "password": "YOUR_ONE_TIME_ADMIN_PASSWORD"
}
```

### Settings

```text
GET  /api/app/settings
POST /api/app/settings
GET  /api/app/system-status
GET  /api/app/backup
POST /api/app/restore
```

Backup export includes settings, public user metadata, audit logs, and dashboard state.
Restore accepts settings and dashboard state only. It does not restore passwords or user accounts.

### User management

```text
GET  /api/app/users
POST /api/app/users
PUT  /api/app/users/:id
POST /api/app/users/:id/reset-password
POST /api/app/users/:id/toggle-active
```

### Audit logs

```text
GET /api/app/audit-logs
```

### Dashboard saved state

```text
GET  /api/app/dashboard-state
POST /api/app/dashboard-state
```

### Existing frontend compatibility endpoints

These are included so the existing company identity and portal pages still work:

```text
GET   /api/customer/tenant
GET   /api/admin/tenant
PATCH /api/admin/tenant
POST  /api/admin/tenant/logo
POST  /api/admin/tenant/cover
GET   /api/super-admin/tenants
PATCH /api/super-admin/tenants/:tenantId
```

## 8. Frontend setup

Use this variable when building the React app:

```env
VITE_API_BASE_URL=https://api.risks-dashboard.com
```

Build locally:

```bash
yarn run check
VITE_API_BASE_URL=https://api.risks-dashboard.com yarn build
```

On Windows PowerShell:

```powershell
$env:VITE_API_BASE_URL="https://api.risks-dashboard.com"
yarn build
```

Upload the contents of the generated `dist` folder to the Namecheap document root for:

```text
https://risks-dashboard.com/
```

## 9. SPA rewrite

Confirm `.htaccess` exists in the frontend document root:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

## 10. Security notes

- The browser never connects directly to MySQL.
- Only the Node.js API connects to MySQL.
- `.env` is ignored and must not be committed.
- Passwords are hashed with bcrypt.
- Login uses secure cookie/JWT session handling.
- Failed login attempts are tracked in `risk_users.failed_attempts`.
- Users are temporarily locked using `risk_users.locked_until`.
- Seeded, newly created, and reset users are forced to change password before using normal app endpoints.
- Login, logout, settings changes, user changes, dashboard-state changes, and branding uploads are written to `risk_audit_logs`.
- Viewer users are redirected away from admin routes and do not see admin portal buttons.

## 11. Local testing checklist

Run:

```bash
yarn run check
yarn test
yarn build
yarn mysql:init
yarn dev:api
```

Confirm:

1. `http://127.0.0.1:4000/api/health` returns `ok: true`.
2. Login works using `admin` and your `RISK_SEED_ADMIN_PASSWORD`.
3. System Admin can open admin portal and company identity.
4. Risk Admin can open dashboard and normal settings/branding pages.
5. Viewer opens customer portal/dashboard only and does not see admin buttons.
6. Existing Risk Dashboard tabs still load.
7. Upload and Excel parsing still work.
8. KPIs/charts/tables remain unchanged.
9. Exports still work.
10. Production frontend uses `https://api.risks-dashboard.com`.

## 12. Deployment packages

Create fresh upload ZIP files:

```powershell
yarn deploy:packages
```

The script builds the frontend and creates timestamped ZIP files in `deploy-packages/`:

- frontend ZIP: extract into `public_html`
- backend ZIP: extract into the Node.js app root

The real `.env` file is intentionally not packaged.

## 13. Vercel frontend deployment

This project can run the React frontend on Vercel while keeping the Node.js/MySQL API on Namecheap.

Vercel project settings:

- Framework Preset: Vite
- Build Command: `yarn build`
- Output Directory: `dist`
- Install Command: `yarn install --registry https://registry.npmjs.org/ --network-timeout 600000`

Add this Vercel environment variable for Production and Preview:

```env
VITE_API_BASE_URL=https://api.risks-dashboard.com
```

The frontend also falls back to `https://api.risks-dashboard.com` automatically on `*.vercel.app` domains.

On the Namecheap API `.env`, add either the exact Vercel production domain:

```env
RISK_CORS_ORIGINS=https://risks-dashboard.com,https://www.risks-dashboard.com,https://your-vercel-domain.vercel.app
```

Or allow Vercel preview URLs with:

```env
RISK_CORS_ORIGIN_PATTERNS=^https://[a-z0-9-]+\\.vercel\\.app$
```

After changing Namecheap API `.env`, restart the Node.js app.

## 14. Importing existing local/browser data into MySQL

The current dashboard still parses and stores workbook data in the browser/local flow. For server-side saved settings:

1. Export or copy existing local settings from browser/localStorage if needed.
2. Insert them into `risk_app_settings` using keys such as:
   - `company_name`
   - `logo_url`
   - `cover_image_url`
   - `primary_color`
   - `secondary_color`
   - `dashboard_config`
3. Use `POST /api/app/settings` for future server-side settings updates.
4. For workbook metadata only, insert metadata into `risk_saved_workbooks`. Do not store large Excel binary files in MySQL unless you intentionally add that feature later.

Example setting import:

```sql
INSERT INTO risk_app_settings (setting_key, setting_value)
VALUES ('dashboard_config', '{"defaultTab":"overview"}')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
```
