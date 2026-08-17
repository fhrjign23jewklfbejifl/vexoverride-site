# 4330P Override Analytics Engine

Static Netlify-ready VEX V5 Override analytics app.

## Files

- `index.html` - page structure
- `styles.css` - visual design
- `app.js` - scoring, local storage, analysis, scouting, import/export

## Deploy on Netlify

Drag this folder into Netlify Drop or connect the folder to a Netlify site. No build command is required.

## Scoring model

Based on VEX V5 Override Game Manual v1.1:

- Alliance-colored Pin half: 5 points
- Owned yellow Pin half: 10 points
- Robot ending in Midfield: 8 points
- Autonomous Bonus: 12 points
- Tied Autonomous Bonus: 6 points each

The app is designed for pre-match, post-match, practice, scouting, and notebook analysis. It is not intended for mid-match decision-making.

## Data

Data is stored locally in the browser using LocalStorage. Use Export Data / Import JSON to move data between devices.

## VEX competition data proxy

The website never stores VEX session cookies or private account data in browser code. Live competition import uses the Cloudflare Worker source in `workers/vex-data-proxy.js`.

Worker setup:

- Deploy `workers/vex-data-proxy.js` to a free Cloudflare Worker.
- The public season skills endpoint does not need a token.
- Event/team-history API endpoints may still need an official VEX route or token before they can be fully automated.
- Open the website once with `?proxy=https://YOUR-WORKER.workers.dev` to override the default proxy URL on that device.

## Local VEX event updater

The local updater is for protected VEX Events data that should be fetched from this computer, cleaned into public JSON files, and pushed to GitHub Pages.

Private local files stay under `.local/` and are ignored by Git. Do not commit `.local/`, `.env`, browser session folders, or logs.

Public synced files are written here:

- `data/events/index.json`
- `data/events/{eventId}/event.json`
- `data/events/{eventId}/teams.json`
- `data/events/{eventId}/skills.json`
- `data/events/{eventId}/awards.json`
- `data/events/{eventId}/meta.json`

Setup:

1. Run `npm install`.
2. Sign into VEX Events in your normal Chrome browser.
3. Open `https://events.vex.com/` in that signed-in Chrome window.
4. Copy the browser-side collector:

```powershell
npm.cmd run vex:copy-collector
```

5. Press `F12`, open the Chrome DevTools `Console` tab, paste, and press Enter.
6. Enter event IDs or ranges when prompted, for example:

```text
65030,64306
```

or:

```text
64000-65100
```

The collector runs inside `events.vex.com`, so VEX sees the same trusted browser session that can already view the JSON pages. It filters to season id `204`, downloads teams/skills/awards/event JSON for matching events, and saves one bundle file to Downloads.

7. Import the downloaded bundle:

```powershell
npm.cmd run vex:import-bundle -- "C:\Users\29SSchwartz\Downloads\vex-event-bundle-PASTE-THE-REAL-NAME.json"
```

8. Commit and push the public JSON files when ready.

This is the preferred batch path. It scales to hundreds of event IDs in one run without putting your VEX password, cookies, or session data in this repo.

Experimental direct updater:

```powershell
npm.cmd run vex:update:headed
```

The default config uses:

- `useRemoteChrome: false`
- remote debugging port `9222`
- `useExistingChromeProfile: false`
- `%LOCALAPPDATA%\Google\Chrome\User Data`
- Chrome profile `Default`

The direct updater is kept for future experiments, but VEX currently rejects many non-browser automation attempts with `401` / `403` or robot checks. Use the browser-side collector first.

If the existing Chrome profile is locked or still gets blocked, use the normal-Chrome header fallback:

1. Run `npm run vex:headers-help`.
2. Sign into VEX Events in your normal Chrome browser.
3. Use DevTools Network on a working VEX API request.
4. Copy only the `cookie` and `user-agent` request headers into `.local/vex-request-headers.json`.
5. Run `npm run vex:update:headed`.

Never paste `.local/vex-request-headers.json`, cookies, passwords, or session tokens into chat. The `.local/` folder is ignored by Git and stays on this computer.

Manual API import fallback:

If VEX blocks automated API reads, open each API URL directly in normal Chrome, copy the visible JSON, then save it from the clipboard:

```powershell
npm.cmd run vex:save-clipboard -- --event 65030 --kind event
npm.cmd run vex:save-clipboard -- --event 65030 --kind teams
npm.cmd run vex:save-clipboard -- --event 65030 --kind skills
npm.cmd run vex:save-clipboard -- --event 65030 --kind awards
```

Use these URLs for event `65030`:

- `https://events.vex.com/api/v2/events/65030`
- `https://events.vex.com/api/v2/events/65030/teams?&per_page=250&page=1`
- `https://events.vex.com/api/v2/events/65030/skills?&page=1&per_page=250`
- `https://events.vex.com/api/v2/events/65030/awards?&per_page=999`

The manual importer still enforces the configured `2026-2027` / season id `204` check for event metadata.

Install the 3:00 AM Windows scheduled task:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-vex-updater-task.ps1
```

The updater only publishes events that match the configured target season, currently `2026-2027` / season id `204`. Older event IDs from previous seasons are skipped and logged.
