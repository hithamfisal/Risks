# Deployment Checklist — Risks Dashboard

## Before build

- [ ] Confirm `package-lock.json` is not present if deploying with Yarn only.
- [ ] Confirm `.yarnrc` uses the public npm registry.
- [ ] Confirm no real company/customer data is inside `client/public/sample_data.xlsx`.
- [ ] Confirm no `.env` files are included in the source package.
- [ ] Confirm no debug/runtime tracking folders are present.

## Local verification

Run from the project root:

```powershell
yarn install --registry https://registry.npmjs.org/ --network-timeout 600000
yarn build
```

Then verify:

- [ ] Build succeeds.
- [ ] `dist/index.html` exists.
- [ ] `dist/assets/` exists.
- [ ] `dist/.htaccess` exists.
- [ ] No `*.map` files exist in `dist`.
- [ ] No `src/`, `node_modules/`, `.git/`, `.env`, logs, or raw project files are in the deployment package.

## Namecheap / cPanel deployment package

The deployment ZIP should contain only:

```text
index.html
assets/
sample_data.xlsx only if intentionally included and anonymized
.htaccess
```

Do not include:

```text
src/
client/
server/
shared/
node_modules/
package.json
yarn.lock
vite.config.ts
tsconfig.json
.env
.git/
logs
real internal data files
```

## Vercel settings

If deploying to Vercel:

```text
Framework Preset: Vite
Root Directory: ./
Install Command: yarn install --registry https://registry.npmjs.org/ --network-timeout 600000
Build Command: yarn build
Output Directory: dist
```

## Functional checks after deployment

- [ ] Dashboard opens on first load.
- [ ] Refreshing any route returns the dashboard, not 404.
- [ ] Upload accepts `.xlsx`, `.xls`, `.xlsm`, and `.csv`.
- [ ] Invalid file types show a friendly error.
- [ ] Bad/corrupt files do not crash the dashboard.
- [ ] Sample dashboard opens.
- [ ] Clear Saved Dashboard Data button works.
- [ ] Exports still work.
- [ ] Filters, tabs, KPIs, charts, and tables are visually unchanged.
