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

The website never stores a VEX Events API token in browser code. Live competition import uses the Cloudflare Worker source in `workers/vex-data-proxy.js`.

Worker setup:

- Deploy `workers/vex-data-proxy.js` to a free Cloudflare Worker.
- Add a Worker secret named `VEX_EVENTS_TOKEN`.
- Open the website once with `?proxy=https://YOUR-WORKER.workers.dev` to save the proxy URL on that device.
