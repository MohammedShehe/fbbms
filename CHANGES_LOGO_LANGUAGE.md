# Update: business logos + Swahili/English

## New files
- `js/i18n.js` — translation engine. `js/i18n.sw.js` — the Kiswahili dictionary (~1,900 phrases).
- `js/logo-manager.js` — upload / change / remove logo card (preview step, spinners, drag & drop).

## Using it
- **Language:** the 🌐 button in the top bar (and EN/SW on the sign-in page). Each person chooses for themselves; Super Admins set the business default in *Shop & website → Language*; the Developer sets the platform default in *Platform theme*.
- **Logo:** *Shop & website → Business logo* (Super Admin). Developer: *Businesses → Edit*, or upload while registering a business.
- The sidebar, business switcher, browser-tab icon and every session of that business update live.

## Adding or fixing a translation
Open `js/i18n.sw.js` and add a line `["English text", "Kiswahili"],`. Use `{0}`, `{1}` for numbers/names. Anything without a translation simply stays in English.
Not translated on purpose: `about.html`, the old v1 pages (`otp.html`, `*-dashboard.html`), and e-mails other than the sign-in code.
