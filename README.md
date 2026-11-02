# FBBMS v3 – Management app (static: HTML + CSS + JS modules, Bootstrap 5, Chart.js)

1. Open `js/config.js` and set `PRODUCTION_API` to your backend URL (ends with `/api`).
2. Upload this folder to `management.fourbrothers.online` (a `CNAME` file is included for GitHub Pages).
3. Sign in at `index.html`. Developer = full platform console; Super Admin = one or more shops (switch from the top bar);
   Sub Admin = only what the Super Admin allowed.

Local test: `npx serve .` (or VS Code Live Server) with the backend running on :5000.
Per-shop emblem: add the shop slug → image to `BIZ_LOGOS` in `js/config.js` (ZanLux is already set).

Product photos: the app resizes each photo in the browser, then the backend uploads it to Cloudinary and stores the returned link.

## New in v3
New pages (shown only when the Developer has enabled the module and the user has the permission): Customers, Refunds & exchanges, Suppliers & purchases, Cash & till, Finance & tax, Business health, Alerts, AI assistant, API & webhooks, Branches. The POS gained customer lookup, split/credit payments, loyalty redeem, barcode scanning (scanner or camera), held carts and an 80 mm receipt print.
Time zone, date format and currency come from each business's settings. Reports and lists export to Excel and PDF (SheetJS and jsPDF are loaded from a CDN only when you click Export).
Developer console additions: AI settings, Feature modules, API & integrations, System & backups, Security & sessions.
Integrating a public website with the API: see `backend/docs/PUBLIC_API.md`.
