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
2. Run `npm run vex:login`.
3. Sign into VEX Events in the Chrome window that opens.
4. Return to the terminal and press Enter. This saves only the local browser session.
5. Edit `data/vex-updater-config.json` to add known event IDs or conservative ranges.
6. Test without pushing: `npm run vex:update:headed`.
7. Run the real update: `npm run vex:update`.

If the automated login browser gets stuck on the robot check, use the normal-Chrome header fallback instead:

1. Run `npm run vex:headers-help`.
2. Sign into VEX Events in your normal Chrome browser.
3. Use DevTools Network on a working VEX API request.
4. Copy only the `cookie` and `user-agent` request headers into `.local/vex-request-headers.json`.
5. Run `npm run vex:update:headed`.

Never paste `.local/vex-request-headers.json`, cookies, passwords, or session tokens into chat. The `.local/` folder is ignored by Git and stays on this computer.

Install the 3:00 AM Windows scheduled task:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-vex-updater-task.ps1
```

The updater only publishes events that match the configured target season, currently `2026-2027` / season id `204`. Older event IDs from previous seasons are skipped and logged.
