# FBBMS v2 – Management app (static: HTML + CSS + JS modules, Bootstrap 5, Chart.js)

1. Open `js/config.js` and set `PRODUCTION_API` to your backend URL (ends with `/api`).
2. Upload this folder to `management.fourbrothers.online` (a `CNAME` file is included for GitHub Pages).
3. Sign in at `index.html`. Developer = full platform console; Super Admin = one or more shops (switch from the top bar);
   Sub Admin = only what the Super Admin allowed.

Local test: `npx serve .` (or VS Code Live Server) with the backend running on :5000.
Per-shop emblem: add the shop slug → image to `BIZ_LOGOS` in `js/config.js` (ZanLux is already set).

Product photos: the app resizes each photo in the browser, then the backend uploads it to Cloudinary and stores the returned link.
