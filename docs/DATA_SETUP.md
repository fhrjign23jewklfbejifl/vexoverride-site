# VEX data setup

## What has been verified

On November 10, 2026 UTC, the public high-school season-204 Skills endpoint returned 1,555 teams from 17 countries, including 53 Florida teams. The rows reference 169 distinct events; that is not the total number of season events. Only teams represented in the Skills standings appear here.

Official source: https://events.vex.com/api/seasons/204/skills?post_season=0&grade_level=High%20School

Official API documentation: https://events.vex.com/api/v2

Official schema: https://events.vex.com/api/v2/swagger.yml

The documented API provides event and team listings, event registrations, matches, rankings, Skills, and awards. It supports up to 250 results per page. An unauthenticated request to `/api/v2/events/65030` returned HTTP 401, `Unauthenticated.` The documentation's **Request Access** link opens a VEX Events sign-in page when logged out. Approval timing and the post-login form have not been verified.

RoboScout's public `RoboScoutAPI.swift` source uses `https://events.vex.com/api/v2` with a bearer API key and paginated requests. This supports using the official API rather than guessing thousands of event IDs. It does not prove how every production RoboScout service works. Source: https://github.com/SunkenSplash/VRC-RoboScout/blob/main/VRC%20RoboScout/RoboScoutAPI.swift

## The owner's one-time steps

1. Open https://events.vex.com/api/v2.
2. Click **Request Access**, then sign in to your VEX Events account.
3. Complete VEX's API access request. If it asks for a project description, use:

   > VexOverride.com is a VEX V5 scouting and match-analysis app. I need read-only access to events, registered teams, schedules, match results, rankings, and Skills results for the 2026–2027 Override season. Data will be cached and refreshed conservatively, with rate limits respected.

4. Once VEX provides an API token, open https://github.com/fhrjign23jewklfbejifl/vexoverride-site.
5. Select **Settings → Secrets and variables → Actions → New repository secret**.
6. Set **Name** to `VEX_EVENTS_TOKEN`. Paste the VEX token into **Secret**, then click **Add secret**. Do not put it in the repository's source files or send it in chat.
7. Open **Actions → Refresh VEX data → Run workflow**, select `main`, and click **Run workflow**. Adding a secret alone does not trigger an immediate run, but the next scheduled run will use it.
8. Check the resulting run and `data/season-204/sync-status.json`. A green run without a key means the public Skills refresh worked; it does not mean competition history was imported. For authenticated success, `events.state` must be `ok`; `remainingDue` shows the outstanding backfill.

If VEX shows a different screen, share its text or a screenshot with credentials hidden. Do not copy cookies or request headers. The token-based portion is tested with fixtures but still needs its first real authenticated run.

GitHub's secret instructions: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets

## What runs automatically

The workflow runs at 00:17, 06:17, 12:17, and 18:17 UTC. GitHub can delay scheduled jobs, so these are target times, not a freshness guarantee. Public repositories can have scheduled workflows disabled after 60 days without repository activity. Check freshness from the saved timestamp rather than assuming the schedule ran.

The updater makes one public Skills request, validates it, and saves the current snapshot plus that UTC day's history. It never adds separately reported best autonomous and driver values to invent an official total.

With a valid token, it reads the actual season catalog, then refreshes up to 24 events. Recent and upcoming events are eligible again after five hours; older events after seven days. Half the batch is reserved for the oldest snapshots. Ransom event 65030 and event 64306 have priority. This is deliberately bounded backfill; it does not refresh the entire world every six hours. The event index includes only saved event snapshots, while the catalog holds discovered events.

Requests are sequential, at least two seconds apart. There is a 400-request run budget, a 40-second request timeout, bounded retries, and support for `Retry-After`. Long rate limits stop the run for a later retry. HTTP 401/403 stop authenticated work immediately. No credentials are sent to the public feed or forwarded across redirects. Unexpected pagination, duplicate IDs, wrong seasons, and large feed shrinkage fail validation.

An event's full response set is fetched before files are replaced. Individual files are written atomically; GitHub publishes all changes in a single commit. Previously successful data keeps its original timestamp if a fetch fails. The status file can report a failure alongside a successful public refresh. The workflow intentionally commits that status and valid snapshots, then reports a failed run.

## What this does not solve yet

- **Live competition updates:** a six-hour snapshot is insufficient between matches. The next backend step is a cache for a selected active event, polling at a rate allowed by VEX, with a visible last-updated time and manual refresh. Do not globally poll every event at live-match frequency.
- **Official schedules:** the API can return scheduled matches, but only after the organizer publishes them. Before publication the app should say the schedule is unavailable. Manual entry is a fallback for private scrimmages or unpublished schedules.
- **Past performance history:** the public Skills endpoint is a standings snapshot. Event-by-event history comes from authenticated event results. Daily snapshots collected now cannot fill missing previous months.
- **Robot design:** official scores do not identify a cascade lift, belcher, reverse four bar, robot revision, strategy, or why a failure happened. Those need dated team-entered robot profiles and scouting observations. An app recommendation must distinguish those observations from score-derived statistics.
- **Individual contribution:** a head-to-head alliance score is not one robot's score. Match records retain the official `scored` flag so a scheduled 0–0 is not counted as a played tie.
- **Team sharing:** this pipeline downloads public competition data. It does not synchronize private notes, practice records, memberships, or pick lists between devices.
- **UI integration:** the new season snapshot and match files still need to be consumed by the redesigned views. Public downloads are working; authenticated endpoint shape and division-ID behavior must be checked with a real token before calling the complete pipeline production-ready.

## Development checks

`python -m unittest discover -s scripts -p 'test_vex_sync.py' -v`

The tests cover pagination, duplicate/partial responses, rate limiting, authentication stops, request budgets, preserving old data, atomic file replacement, token handling, missing scores, published totals, backfill fairness, division routes, and unscored matches. These checks do not substitute for the first authenticated integration run.
