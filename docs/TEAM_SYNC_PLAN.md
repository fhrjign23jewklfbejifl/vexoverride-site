# Shared team workspaces — implementation specification

Status: design only. The current v2 review stores data in the browser and does not synchronize computers. Do not present a join-code screen as functional until the server path exists.

## User workflow

1. Sign in; create a workspace with a team number and name. A team number identifies a team; knowing it does not grant access.
2. The owner creates a revocable, expiring invitation code. A signed-in teammate enters the code to join. Codes must not expose a permanent database credential.
3. Members share match records, event schedules, scouting observations and picklists. The active page, selected zone, unfinished field draft and chart filters stay personal.
4. Each saved record displays its author, creation time, last editor and revision. Members can correct mistakes without silently deleting history.
5. Show an honest state: saved on this device, waiting to sync, synchronized, or conflict needs attention. Loss of connectivity must not discard scouting notes.
6. The owner can revoke invitations and remove members. Removed users lose server access. Already exported or cached data cannot be remotely guaranteed erased.

## Storage and authorization

Use a server API and durable database. The browser must never be able to bypass membership checks by supplying a different workspace ID. The source repository remains on GitHub; GitHub is not the collaboration database. The public production hosting path still needs to be established before choosing the identity integration.

Core records: users, workspaces, memberships, invitations (hashed code, expiry, revoked status), events, match records, observations, picklists, revisions, and idempotent mutation receipts. Scope every shared record to a workspace. Use roles owner/editor/viewer; restrict membership changes to owners. Rate-limit code redemption and return generic failures for invalid codes.

Keep local IDs when importing browser data. An explicit one-time import must not publish an entire personal workspace merely because a user signs in. Sample data remains separate and is never silently imported.

## Concurrent and offline changes

- Saves carry the record ID, expected revision, and a client-generated mutation ID.
- Creating different observations concurrently succeeds independently.
- Editing the same observation or picklist at the same revision rejects the stale write and offers a comparison; no silent whole-workspace overwrite.
- A persistent local outbox retries on reconnect. The mutation ID prevents duplicate observations when a response is lost.
- Deletes create tombstones, preventing an offline device from resurrecting a removed record.
- Pull changes using a server cursor. A visible Sync action supplements automatic refresh.
- Backups remain exportable. Membership removal or an expired session pauses uploads without deleting unsent local work.

## Required acceptance tests before calling it ready

- Two independent browser profiles: A saves an observation; B sees it without importing a file.
- Two members add notes concurrently; both survive.
- Two members edit the same picklist; the second edit resolves a visible conflict rather than overwriting the first.
- Offline member creates records, reloads offline, reconnects; every record uploads exactly once.
- Another workspace cannot list, read, edit or delete these records, even with their IDs.
- A revoked invitation cannot be used. A removed member cannot read or write new server data.
- Invalid, expired, reused and guessed codes fail without leaking team data.
- Sign-out, expired sessions and quota failures leave recoverable local drafts.
- Real browser records import once; demo records remain isolated.

## Deployment boundary

The current private review is owner-only. Its private URL does not grant teammates membership. Adding access to the review host and implementing team membership are separate operations. Do not open the review site to everyone as a shortcut for team synchronization.
