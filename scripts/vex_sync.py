#!/usr/bin/env python3
"""Refresh public VEX data. Python 3.11+; no browser session or dependencies."""
import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

HOST = "https://events.vex.com"
API = HOST + "/api/v2"
ROOT = Path(__file__).resolve().parents[1]


class SyncError(Exception):
    pass


class AccessError(SyncError):
    pass


class RateLimitError(SyncError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward a credential through a redirect.


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_json(path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
    fd, name = tempfile.mkstemp(prefix=".vex-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(content)
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def positive_int(value):
    return type(value) is int and value > 0


def public_url(season, grade):
    return HOST + f"/api/seasons/{season}/skills?" + urllib.parse.urlencode(
        {"post_season": 0, "grade_level": grade})


def retry_delay(value, attempt):
    if value:
        try:
            return max(0, float(value))
        except ValueError:
            try:
                return max(0, parsedate_to_datetime(value).timestamp() - time.time())
            except (TypeError, ValueError):
                pass
    return 2 ** (attempt + 1)


class Client:
    def __init__(self, token="", delay=2, budget=400, opener=None, sleep=time.sleep):
        self.token, self.delay, self.budget = token, delay, budget
        self.open = opener or urllib.request.build_opener(NoRedirect()).open
        self.sleep, self.requests = sleep, 0

    def get(self, path, params=None, authenticated=True):
        if not re.fullmatch(r"/[A-Za-z0-9/_-]+", path):
            raise SyncError("Invalid API path")
        if authenticated and not self.token:
            raise AccessError("VEX_EVENTS_TOKEN is not configured")
        url = (API if authenticated else HOST + "/api") + path
        if params:
            url += "?" + urllib.parse.urlencode(params)
        headers = {"User-Agent": "VexOverride data updater (+https://vexoverride.com)",
                   "Accept": "application/json"}
        if authenticated:
            headers["Authorization"] = "Bearer " + self.token
        for attempt in range(3):
            if self.requests >= self.budget:
                raise RateLimitError("Request budget reached; remaining events deferred")
            if self.requests:
                self.sleep(self.delay)
            self.requests += 1
            try:
                with self.open(urllib.request.Request(url, headers=headers), timeout=40) as response:
                    body = response.read(32 * 1024 * 1024 + 1)
                    if len(body) > 32 * 1024 * 1024:
                        raise SyncError("API response exceeded size limit")
                    try:
                        return json.loads(body)
                    except (ValueError, UnicodeError):
                        raise SyncError("API did not return valid JSON") from None
            except urllib.error.HTTPError as error:
                code = error.code
                retry_after = error.headers.get("Retry-After")
                error.close()
                if code in (401, 403):
                    raise AccessError(f"VEX API returned HTTP {code}; access must be resolved") from None
                if code != 429 and code not in (500, 502, 503, 504):
                    raise SyncError(f"VEX API returned HTTP {code}") from None
                delay = retry_delay(retry_after, attempt)
                if code == 429 and (attempt == 2 or delay > 60):
                    raise RateLimitError("VEX rate limit; retry in a later run") from None
                if attempt == 2 or delay > 60:
                    raise SyncError(f"VEX API unavailable (HTTP {code})") from None
                self.sleep(delay)
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                if attempt == 2:
                    raise SyncError("VEX request failed or timed out") from None
                self.sleep(2 ** (attempt + 1))
        raise SyncError("VEX request failed")

    def pages(self, path, params=None):
        result, seen, page, last_page, total = [], set(), 1, None, None
        while True:
            payload = self.get(path, {**(params or {}), "per_page": 250, "page": page})
            if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
                raise SyncError("Invalid paginated API response")
            meta = payload.get("meta", {})
            last, current, count = meta.get("last_page"), meta.get("current_page"), meta.get("total")
            if not positive_int(last) or last > 1000 or current != page or last < page:
                raise SyncError("Invalid API pagination metadata")
            if type(count) is not int or count < 0:
                raise SyncError("Missing API total")
            if last_page is not None and (last != last_page or count != total):
                raise SyncError("API collection changed during pagination; retry next run")
            last_page, total = last, count
            for row in payload["data"]:
                if not isinstance(row, dict) or not positive_int(row.get("id")):
                    raise SyncError("API row has no valid ID")
                if row["id"] in seen:
                    raise SyncError("Duplicate API row across pages")
                seen.add(row["id"])
                result.append(row)
            if page == last:
                if len(result) != total:
                    raise SyncError("Incomplete API collection")
                return result
            if not payload["data"]:
                raise SyncError("Unexpected empty API page")
            page += 1


def select_keys(row, keys):
    return {key: row.get(key) for key in keys.split()}


def skills_snapshot(rows, config, fetched_at):
    if not isinstance(rows, list) or not rows:
        raise SyncError("Empty or invalid Skills feed; previous snapshot retained")
    clean, seen = [], set()
    numeric = "score programming driver maxProgramming maxDriver combinedStopTime progStopTime driverStopTime".split()
    for row in rows:
        if not isinstance(row, dict):
            raise SyncError("Invalid Skills row")
        team, scores, event = row.get("team"), row.get("scores"), row.get("event")
        if not all(isinstance(x, dict) for x in (team, scores, event)):
            raise SyncError("Skills row is missing its team, event, or scores")
        number = team.get("team", "")
        if (not re.fullmatch(r"[0-9]{1,6}[A-Z]{0,3}", number) or number in seen
                or not positive_int(team.get("id")) or not positive_int(row.get("rank"))
                or team.get("program") != "V5RC" or team.get("gradeLevel") != config["gradeLevel"]
                or config["seasonName"] not in event.get("seasonName", "")):
            raise SyncError("Unexpected team, season, grade, or duplicate in Skills feed")
        seen.add(number)
        values = {}
        for key in numeric:
            value = scores.get(key)
            if value is not None and (type(value) is not int or value < 0):
                raise SyncError("Invalid Skills score")
            values[key] = value  # Missing is not zero. Preserve source values; never recompute the total.
        values.update(select_keys(scores, "progScoredAt driverScoredAt"))
        clean.append({"rank": row["rank"], "team": select_keys(team,
            "id team teamName organization city region country gradeLevel eventRegion eventRegionId"),
            "event": select_keys(event, "sku startDate seasonName"), "scores": values})
    clean.sort(key=lambda row: (row["rank"], row["team"]["team"]))
    digest = hashlib.sha256(json.dumps(clean, sort_keys=True).encode()).hexdigest()
    return {"schemaVersion": 1, "seasonId": config["seasonId"], "program": "V5RC",
            "gradeLevel": config["gradeLevel"], "fetchedAt": fetched_at,
            "source": public_url(config["seasonId"], config["gradeLevel"]),
            "coverage": "season-skills-standings", "contentHash": digest,
            "teamCount": len(clean), "data": clean}


def validate_event(row, config):
    if (not isinstance(row, dict) or not positive_int(row.get("id"))
            or row.get("season", {}).get("id") != config["seasonId"]
            or row.get("program", {}).get("id") != config["programId"]
            or not isinstance(row.get("divisions"), list)):
        raise SyncError("Invalid event or unexpected season/program")
    return row


def clean_event(row):
    result = select_keys(row, "id sku name start end season program divisions level ongoing awards_finalized event_type")
    result["location"] = select_keys(row.get("location") or {}, "venue city region country")
    return result


def due_events(events, config, root, now):
    entries = []
    for event in events:
        meta = read_json(root / "data/events" / str(event["id"]) / "meta.json", {})
        stamp = meta.get("updatedAt", "") if meta.get("collectorVersion") == 1 else ""
        try:
            age = (now - datetime.fromisoformat(stamp.replace("Z", "+00:00"))).total_seconds()
        except ValueError:
            age = float("inf")
        try:
            start = datetime.fromisoformat(event["start"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(event["end"].replace("Z", "+00:00"))
            close = start.timestamp() - 7 * 86400 <= now.timestamp() <= end.timestamp() + 7 * 86400
        except (ValueError, TypeError, KeyError):
            close = False
        if age >= (5 * 3600 if close else 7 * 86400):
            entries.append((event, stamp, close))
    priority = config.get("priorityEventIds", [])
    limit = config["maxEventsPerRun"]
    # Reserve half the batch for the oldest snapshots so active events cannot starve backfill.
    urgent = sorted(entries, key=lambda x: (x[0]["id"] not in priority, not x[2], x[1], x[0]["id"]))
    picked = urgent[:max(1, limit // 2)]
    selected = {x[0]["id"] for x in picked}
    backlog = sorted((x for x in entries if x[0]["id"] not in selected), key=lambda x: (x[1], x[0]["id"]))
    return [x[0] for x in (picked + backlog)[:limit]], len(entries)


def fetch_event(client, event_id, config, fetched_at):
    event = validate_event(client.get(f"/events/{event_id}"), config)
    if event["id"] != event_id:
        raise SyncError("Wrong event returned")
    result = {"event": {"data": clean_event(event)}}
    for kind in ("teams", "skills", "awards"):
        rows = client.pages(f"/events/{event_id}/{kind}")
        if kind == "teams":
            rows = [{**select_keys(row, "id number team_name robot_name organization registered program grade"),
                     "location": select_keys(row.get("location") or {}, "city region country")} for row in rows]
        elif kind == "skills":
            rows = [select_keys(row, "id event team type season division rank score attempts") for row in rows]
        else:
            rows = [select_keys(row, "id event order title qualifications designation classification teamWinners") for row in rows]
        result[kind] = {"data": rows}
    result.update({kind: {"data": []} for kind in ("matches", "rankings", "finalistRankings")})
    divisions = set()
    for division in event["divisions"]:
        division_id = division.get("id")
        if not positive_int(division_id) or division_id in divisions:
            raise SyncError("Invalid or duplicate event division")
        divisions.add(division_id)
        for kind in ("matches", "rankings", "finalistRankings"):
            rows = client.pages(f"/events/{event_id}/divisions/{division_id}/{kind}")
            for row in rows:
                if row.get("event", {}).get("id") != event_id:
                    raise SyncError("Division response contained a different event")
            if kind == "matches":
                rows = [select_keys(row, "id event division round instance matchnum scheduled started field scored scoring_system name alliances") for row in rows]
                if any(type(row["scored"]) is not bool for row in rows):
                    raise SyncError("Match is missing its scored flag")
            else:
                rows = [select_keys(row, "id event division rank team wins losses ties wp ap sp high_score average_points total_points") for row in rows]
            result[kind]["data"].extend(rows)
    result["meta"] = {"eventId": event_id, "updatedAt": fetched_at, "source": API,
                      "status": "ok", "collectorVersion": 1, "divisionCount": len(divisions)}
    return result


def index_entry(bundle):
    event, meta = bundle["event"]["data"], bundle["meta"]
    return {"eventId": event["id"], **select_keys(event, "sku name start end"),
            **select_keys(event.get("location") or {}, "city region country"),
            "teamCount": len(bundle["teams"]["data"]), "skillCount": len(bundle["skills"]["data"]),
            "awardCount": len(bundle["awards"]["data"]), "matchCount": len(bundle["matches"]["data"]),
            "updatedAt": meta["updatedAt"],
            "paths": {kind: f"data/events/{event['id']}/{kind}.json" for kind in bundle}}


def refresh(root, config, client, public_only=False):
    stamp = utc_now()
    season_dir = root / f"data/season-{config['seasonId']}"
    previous = read_json(season_dir / "sync-status.json", {})
    status = {"schemaVersion": 1, "attemptedAt": stamp, "skills": previous.get("skills", {}),
              "events": previous.get("events", {}), "errors": []}
    stop_requests = False
    try:
        rows = client.get(f"/seasons/{config['seasonId']}/skills",
                          {"post_season": 0, "grade_level": config["gradeLevel"]}, authenticated=False)
        snapshot = skills_snapshot(rows, config, stamp)
        old = read_json(season_dir / "skills-high-school.json", {})
        if old.get("teamCount", 0) > snapshot["teamCount"] * 2:
            raise SyncError("Skills feed shrank by more than half; review before replacing it")
        write_json(season_dir / "skills-high-school.json", snapshot)
        # One compact closing observation per UTC day, not an invented past match history.
        history = {"fetchedAt": stamp, "source": snapshot["source"], "contentHash": snapshot["contentHash"],
                   "columns": ["team", "rank", "score", "programming", "driver", "maxProgramming", "maxDriver", "eventSku"],
                   "data": [[r["team"]["team"], r["rank"], *[r["scores"][k] for k in
                             ("score", "programming", "driver", "maxProgramming", "maxDriver")], r["event"]["sku"]]
                            for r in snapshot["data"]]}
        write_json(season_dir / "history" / f"{stamp[:10]}.json", history)
        status["skills"] = {"state": "ok", "lastSuccessfulAt": stamp, "teamCount": snapshot["teamCount"]}
    except SyncError as error:
        stop_requests = isinstance(error, (RateLimitError, AccessError))
        status["skills"] = {**status["skills"], "state": "failed"}
        status["errors"].append("Skills: " + str(error))

    if stop_requests:
        status["events"] = {**status["events"], "state": "deferred"}
    elif public_only or not client.token:
        status["events"] = {**status["events"], "state": "skipped" if public_only else "needs-api-key"}
    else:
        status["events"] = {**status["events"], "state": "running", "updatedThisRun": 0}
        try:
            catalog = client.pages(f"/seasons/{config['seasonId']}/events")
            if not catalog:
                raise SyncError("Empty event catalog; existing data retained")
            catalog = [clean_event(validate_event(row, config)) for row in catalog]
            write_json(root / "data/events/catalog.json", {"updatedAt": stamp, "seasonId": config["seasonId"],
                                                           "source": API, "data": catalog})
            selected, due = due_events(catalog, config, root, datetime.now(timezone.utc))
            index = read_json(root / "data/events/index.json", {"events": []})
            entries = {row["eventId"]: row for row in index["events"]}
            failures = []
            for event in selected:
                try:
                    bundle = fetch_event(client, event["id"], config, utc_now())
                    old_meta = read_json(root / "data/events" / str(event["id"]) / "meta.json", {})
                    bundle["meta"] = {**old_meta, **bundle["meta"]}
                    # Fetch and validate the whole event before replacing any saved files.
                    for kind, payload in bundle.items():
                        write_json(root / "data/events" / str(event["id"]) / f"{kind}.json", payload)
                    entries[event["id"]] = {**entries.get(event["id"], {}), **index_entry(bundle)}
                    write_json(root / "data/events/index.json", {"updatedAt": stamp, "seasonId": config["seasonId"],
                        "programId": config["programId"], "events": sorted(entries.values(), key=lambda row: (row.get("start") or "", row["eventId"]))})
                    status["events"]["updatedThisRun"] += 1
                except (AccessError, RateLimitError):
                    raise
                except SyncError as error:
                    failures.append({"eventId": event["id"], "error": str(error)})
            status["events"].update({"state": "partial" if failures else "ok", "catalogFetchedAt": stamp,
                "catalogCount": len(catalog), "remainingDue": due - status["events"]["updatedThisRun"], "failures": failures})
            if not failures:
                status["events"]["lastSuccessfulAt"] = stamp
            else:
                status["errors"].append(f"{len(failures)} event snapshots failed; their previous data was retained")
        except SyncError as error:
            status["events"]["state"] = "failed"
            status["errors"].append("Events: " + str(error))
    status["requests"] = client.requests
    write_json(season_dir / "sync-status.json", status)
    return status


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public-only", action="store_true")
    parser.add_argument("--root", type=Path, default=ROOT)
    args = parser.parse_args()
    config = read_json(args.root / "data/vex-sync-config.json")
    if not config or not positive_int(config.get("seasonId")) or not positive_int(config.get("maxEventsPerRun")):
        raise SyncError("Invalid sync configuration")
    client = Client(token=os.environ.get("VEX_EVENTS_TOKEN", "").strip(),
                    delay=config["requestDelaySeconds"], budget=config["maxRequestsPerRun"])
    status = refresh(args.root, config, client, args.public_only)
    print(json.dumps(status, indent=2))  # Public metadata only. Never print request headers or response errors.
    return 1 if status["errors"] else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        # Exit 2 forbids publishing this working tree (e.g. partial disk writes).
        # Avoid printing arbitrary exception text that might contain a request.
        print(f"Data refresh aborted ({type(error).__name__}); do not publish this run", file=sys.stderr)
        sys.exit(2)
