# VexOverride v2: implementation and acceptance plan

Baseline: `5ca75c3`. This document describes product work, not competition claims.

## Audit conclusions

- The four existing modes do not share a coherent navigation or visual hierarchy.
- The field counters become too small for dependable touch input.
- Match records do not identify an event or scheduled match. Scouting data cannot be joined reliably.
- Team lookup builds an index by fetching every event's team file.
- Demo records share normal storage. The separate prepared presentation page already proves isolation is possible.
- Head-to-head analysis calls all yellow halves placed on the field "our" opportunity. Attribution is unavailable, so this conclusion is invalid.
- Sample count is labeled confidence without statistical calibration. Remove that label.
- An alliance score cannot establish an individual robot's contribution. Do not manufacture team ratings from it.
- Existing tests exercise the recommendation engine but not scoring, storage boundaries, imports, or complete user workflows.
- The static collector fetches metadata, teams, skills and awards, not a complete tournament schedule/rankings feed.

## Ordered implementation

1. **Protect the baseline.** Work on `feature/v2-workspace`; keep the existing root app and data unchanged. Deliver the new workspace at `/v2/` for a reversible rollout.
2. **Establish scoring and storage contracts.** Independent scoring functions, explicit pin-half labels, separate head/skills rules, event-linked records, isolated demo storage, reversible legacy import, validated backup/restore.
3. **Build one design system.** Graphite surfaces, off-white text, teal for actions. Red/blue/yellow only for game data. Shared buttons, forms, tables, spacing, cards and empty states. Desktop sidebar; mobile navigation; large touch targets.
4. **Complete the practice workflow.** Head-to-head and Driver/Autonomous Skills scoring, undo, field overview, saved records, notes, run comparison and honest analysis. No forced recommendation when the records do not support one.
5. **Complete the event workflow with available data.** Search the existing event index; load one event at a time; view teams and event-specific skills; attach structured observations; compare two teams; build and reorder a picklist; track selected/declined teams; print a list. Accept manual schedules until a verified automatic feed exists.
6. **Make it usable offline.** Cache the v2 shell, persist selected event information and observations, indicate network/data age, export/import backup, printable picks. Demo opens populated and is labeled on every screen.
7. **Verify before release.** Rule examples and edge cases; storage isolation; malformed-import rejection; XSS-safe rendering; keyboard navigation; save/reload; team observations and pick ordering; representative mobile widths. Run the existing tests too.
8. **Publish a reviewable branch.** Commit and open a pull request with exact validation and remaining limitations. Do not silently replace the main site during this review.

## Explicitly deferred

- Scheduled automatic VEX data collection: source and authorization need a separate implementation.
- Shared cloud team accounts: need authentication, access controls, conflict handling and backup design. Local data is explicitly labeled as local.
- Win probabilities, universal robot ratings, automatic partner recommendations: no validated model or sufficient individual observations yet.
- Multiple seasons/programs and translated v2 copy: stabilize the V5 Override workflow first; keep v1 available.

## User steps

1. GitHub connection: verified, repository reports push permission.
2. Refresh the existing public event data when convenient. Do not send session cookies or tokens.
3. Review the working v2 route and report specific workflow issues. Confirm the hosting source before a main-site cutover.
4. Test on a real phone and use real practice/event records. Synthetic examples only demonstrate functionality.

## Completion criteria

A teammate can open the demo, score and save a match, understand the score breakdown, inspect a real event, save an observation, compare teams, reorder and print picks, export a backup, reload without data loss, and distinguish synthetic/manual/official data without explanation from the developer.
