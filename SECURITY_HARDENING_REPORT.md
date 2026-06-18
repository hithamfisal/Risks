# Security Hardening Report — Risks Dashboard

## Scope
Applied frontend security hardening to the Risks Dashboard without changing KPI logic, chart logic, tabs, filters, colors, or dashboard layout.

## Completed

### Runtime/debug cleanup
- Removed `@builder.io/vite-plugin-jsx-loc` from `package.json`.
- Removed the related `@builder.io` lockfile entries from `yarn.lock`.
- Verified no remaining source references to Manus/debug/runtime tracking terms:
  - `manus`
  - `__manus__`
  - `vite-plugin-manus-runtime`
  - `vitePluginManusRuntime`
  - `vitePluginManusDebugCollector`
  - `vitePluginStorageProxy`
  - `BUILT_IN_FORGE`
  - `jsxLocPlugin`
  - `@builder.io/vite-plugin-jsx-loc`
  - debug collector log names

### Vite/build hardening
- Confirmed clean React + Tailwind Vite plugin setup.
- Added `build.sourcemap: false`.
- Aligned Vercel output directory with the current Vite output path: `dist`.

### Browser security headers
- Added CSP meta tag to `client/index.html`.
- Removed external analytics script placeholder from `client/index.html`.
- Removed external Google font links so the CSP remains self-contained.
- Added Apache/cPanel `.htaccess` security file.
- Added `client/public/.htaccess` so it is copied into `dist/.htaccess` during Vite build.

### Upload safety
- Added upload file type validation.
- Allowed upload extensions: `.xlsx`, `.xls`, `.xlsm`, `.csv`.
- Added empty file validation.
- Added maximum upload size validation: 25 MB.
- Added required column validation for `Risk Title`.
- Replaced raw upload errors with user-friendly messages.
- Detailed parsing errors are logged only in development mode.

### Browser data controls
- Added visible `Clear Saved Dashboard Data` button on the upload screen.
- The button clears dashboard-related `localStorage` keys.
- The button clears dashboard-related `sessionStorage` keys.
- The button attempts to clear dashboard-related IndexedDB databases when supported by the browser.
- Added confirmation message: `Saved dashboard data cleared successfully.`

### Upload privacy note
- Added privacy note near the upload area:
  `Uploaded files are processed in your browser. No files are sent to a server by this dashboard.`

### Public/sample file review
- `client/public/sample_data.xlsx` remains included for the sample dashboard.
- The workbook was spot-checked and appears to use generic/anonymized labels such as department names and generic risk titles.
- No obvious secrets were found in source text files.

## Files changed
- `package.json`
- `yarn.lock`
- `vite.config.ts`
- `vercel.json`
- `.gitignore`
- `.htaccess`
- `client/public/.htaccess`
- `client/index.html`
- `client/src/pages/Home.tsx`
- `client/src/pages/Upload.tsx`
- `client/src/components/ErrorBoundary.tsx`
- `client/src/lib/excelParser.ts`
- `SECURITY_HARDENING_REPORT.md`
- `DEPLOYMENT_CHECKLIST.md`

## Notes
- The dashboard remains browser-only for workbook processing.
- The Express server files were not removed from source, but the Vite/Vercel production build uses the static frontend output.
- Run `yarn install --registry https://registry.npmjs.org/ --network-timeout 600000` and `yarn build` locally to generate the final production `dist` folder.
