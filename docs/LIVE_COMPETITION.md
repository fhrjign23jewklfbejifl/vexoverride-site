# Worldwide competition updates

VexOverride serves any V5RC team at any current-season event, without geographic or team-specific priority. The season catalog is the discovery layer. An event does not need to finish the background backfill before it can be requested from the live service.

## Two distinct update paths

The six-hour GitHub job maintains the worldwide catalog and historical snapshots. It is not a live competition feed. Background collection prioritizes recent/upcoming events and old snapshots fairly; no preferred event IDs are used.

The live service refreshes competitions that people are actively viewing. Each event has one Cloudflare Durable Object shared by viewers worldwide, with persistent cached resources and coalesced requests. Hidden/offline browser tabs stop polling. Returning to the tab or reconnecting triggers a check. No viewer sends the upstream API token.

Target cache intervals near the event date:

| Data | Target interval |
|---|---|
| Matches, published schedules, rankings | 30 seconds |
| Skills results | 60 seconds |
| Registered teams | 5 minutes |
| Event metadata/divisions | 15 minutes |

Outside the event window, resources use a 15-minute cache. This is demand-driven: closed events with no viewers generate no live polling. The browser checks every 30 seconds; changes can take roughly two polling intervals plus upstream response time to appear. VEX publication delays, network failures, and request-budget limits can lengthen that further. These intervals are design targets, not a delivery SLA.

Each resource retains its own last successful fetch time. Failed updates retain old data and display delay instead of changing an old snapshot's timestamp. Successfully returned empty results replace old rows, allowing schedule removals/corrections to propagate. Private scouting notes, pick lists and practice records are never merged from official data or erased by a refresh. Another browser tab's changes retain the existing compare-and-swap protection.

## Activation

The service is implemented but has not been deployed or tested against VEX from Cloudflare. The existing legacy proxy returned HTTP 403 during inspection; its account is not connected to this authoring environment. The new service uses the separate name `vexoverride-live`, leaving that legacy deployment intact.

The repository contains **Deploy live competition service**, a manual GitHub Actions workflow. It needs:

1. `VEX_EVENTS_TOKEN`: the VEX token already stored in GitHub.
2. `CLOUDFLARE_ACCOUNT_ID`: the target Cloudflare account ID.
3. `CLOUDFLARE_API_TOKEN`: a Cloudflare deployment token with Workers Scripts edit and the permissions needed for Durable Object namespaces on the selected account. Use Cloudflare's Edit Cloudflare Workers template scoped to the intended account and review its permissions. Do not grant unrelated account access.

Put these in repository Settings → Secrets and variables → Actions, never source files or chat. Run **Deploy live competition service** on `main`. It validates and deploys the worker, supplies the VEX secret through stdin, and checks an actual imported event before publishing `data/live-service.json`. The fixed event ID in the smoke check is only a verification fixture; it is not a discovery or refresh priority.

After successful deployment, set the review's `v2/live-config.json` to the verified public base URL and republish the review. On a release containing v2, the deployment workflow also updates that file automatically. Empty configuration deliberately displays snapshot mode instead of pretending the backend is live.

## Capacity and remaining production gates

- The default global live budget is 30 VEX requests per minute. This is a conservative cap we selected, not a published VEX allowance. The background collector also uses the same token outside this live budget. Confirm the permitted aggregate quota with VEX before increasing the live cap or claiming worldwide concurrent-event capacity.
- The budget object serializes upstream calls, persists its counter, honors Retry-After, and pauses all live upstream traffic after authentication/rate-limit failures. At capacity it returns delayed cached data. A fair queued scheduler and load testing across many simultaneously active events remain necessary before a broad launch; a busy event can otherwise consume a disproportionate share of the starter budget.
- CORS limits browser origins, but is not authentication or a full abuse defense. Add provider request limits/monitoring and load tests before advertising an unrestricted production service.
- VEX returned `scored:false` for completed events with nonzero scores. The app labels these as reported scores with completion unconfirmed. It does not create individual wins/losses from that flag or from scheduled 0–0 scores. Official published rankings remain separate.
- Review mode can display imported schedules/results now. The live token path, source publication latency, network interruptions, multi-event load, and sustained 30-second refresh behavior still need end-to-end verification after deployment.
- Shared private team workspaces are a separate authenticated database feature. Public competition refresh is not private-note synchronization.

## Checks

On the `feature/v2-workspace` review branch, `node --test scripts/live-tests.mjs` verifies coalescing, large cached datasets, pagination, persistence across object recreation, global budget enforcement, stale-data retention, rate-limit pauses, time-zone ordering, removed matches, and ambiguous completion flags. `wrangler deploy --dry-run --config wrangler.live.toml` verifies the Worker bundle and bindings. These checks do not establish production capacity.
