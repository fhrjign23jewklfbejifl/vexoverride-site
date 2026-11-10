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

## Automatic competition data

The supported updater is now `scripts/vex_sync.py`. It uses the official VEX Events API, never guessed event ID ranges or browser session cookies.

The GitHub Actions workflow **Refresh VEX data** is configured for every six hours, at minute 17 UTC. It can also run manually from the repository's Actions tab. Scheduling requires the workflow on the default branch and Actions enabled. This is a cached scouting dataset, not a live match feed.

- Without an API key: refresh the public high-school season Skills standings and a compact daily history snapshot.
- With `VEX_EVENTS_TOKEN` configured as a GitHub Actions repository secret: also discover the season's actual events and gradually refresh event teams, Skills, awards, match schedules/results, qualification rankings, and finalist rankings.
- A run updates at most 24 complete event snapshots. Half the batch is reserved for old data so backfill can progress. The first complete season import takes multiple runs.
- Refresh failures retain prior data and expose their last successful timestamp in `data/season-204/sync-status.json`.

**Setup and current limits:** [Data setup guide](docs/DATA_SETUP.md).

Current public data files:

- `data/season-204/skills-high-school.json`: published standings, team metadata, separate score fields, source and retrieval time.
- `data/season-204/history/YYYY-MM-DD.json`: one observed standings snapshot per UTC day. This is not a reconstruction of previous matches.
- `data/season-204/sync-status.json`: freshness and errors for each source.
- `data/events/index.json`: successfully saved event snapshots, with each event's own freshness date.
- `data/events/catalog.json`: complete authenticated event discovery, created after API access works.
- `data/events/{id}/`: event, teams, skills, awards, matches, rankings, finalistRankings, and meta JSON files after an authenticated refresh.

The new season feed is available as data. Connecting it to the redesigned analysis screens is a separate pending step; downloading it does not automatically create the charts.

For local development, Python 3.11+ is sufficient; no Python packages are needed:

```sh
python scripts/vex_sync.py --public-only
python -m unittest discover -s scripts -p 'test_vex_sync.py' -v
```

Set `VEX_EVENTS_TOKEN` in the process environment to enable authenticated collection. Keep it out of files, command arguments, screenshots, and chat. The script never prints it. Configuration is in `data/vex-sync-config.json`.

The older browser collector, Chrome profile updater, header-copying workflow, and Windows scheduled-task installer remain as legacy files. They are no longer the supported collection or scheduling path. Do not run a broad event-ID scan.

## Existing live data proxy

`workers/vex-data-proxy.js` is the older Cloudflare proxy used by the original website. It is independent of the scheduled snapshot updater. Its deployment and authenticated endpoints are not validated by the new pipeline. Future live competition mode should fetch a selected event through a rate-limited server cache, with the API key held server-side.
