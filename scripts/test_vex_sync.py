import copy
import io
import json
import tempfile
import unittest
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import vex_sync as sync

CONFIG = {"seasonId": 204, "seasonName": "2026-2027", "programId": 1,
          "gradeLevel": "High School", "priorityEventIds": [1], "maxEventsPerRun": 2}
ROW = {"rank": 467, "team": {"id": 17050, "team": "4330P", "teamName": "RoboPigeons",
       "program": "V5RC", "gradeLevel": "High School", "region": "Florida"},
       "event": {"sku": "RE-V5RC-26-4306", "startDate": "2026-10-31", "seasonName": "2026-2027: Override"},
       "scores": {"score": 68, "driver": 68, "programming": 0, "maxDriver": 68, "maxProgramming": 18}}
EVENT = {"id": 1, "season": {"id": 204}, "program": {"id": 1},
         "name": "Fixture", "start": "2026-11-10T00:00:00Z", "end": "2026-11-10T00:00:00Z",
         "divisions": [{"id": 2, "order": 1, "name": "Division"}]}


def response(value):
    return io.BytesIO(json.dumps(value).encode())


def page(rows, current=1, last=1, total=None):
    return {"data": rows, "meta": {"current_page": current, "last_page": last,
                                  "total": len(rows) if total is None else total,
                                  "next_page_url": "https://untrusted.invalid/ignore-me"}}


class ClientTests(unittest.TestCase):
    def test_pages_use_fixed_host_and_follow_all_metadata(self):
        calls = []
        def open_request(req, timeout):
            calls.append(req)
            return response(page([{"id": len(calls)}], len(calls), 2, 2))
        client = sync.Client("secret", opener=open_request, sleep=lambda _: None)
        self.assertEqual(client.pages("/events"), [{"id": 1}, {"id": 2}])
        self.assertIn("page=2", calls[1].full_url)
        self.assertTrue(all(r.full_url.startswith(sync.API + "/events?") for r in calls))

    def test_auth_errors_stop_without_retries_or_token_in_error(self):
        for code in (401, 403):
            client = sync.Client("private", opener=lambda *_args, **_kwargs: (_ for _ in ()).throw(
                urllib.error.HTTPError(sync.API, code, "secret body", {}, None)), sleep=lambda _: None)
            with self.assertRaisesRegex(sync.AccessError, str(code)) as error:
                client.get("/events")
            self.assertNotIn("private", str(error.exception))
            self.assertEqual(client.requests, 1)

    def test_public_request_does_not_send_token(self):
        calls = []
        client = sync.Client("private", opener=lambda req, **_: calls.append(req) or response([]))
        client.get("/seasons/204/skills", authenticated=False)
        self.assertNotIn("Authorization", dict(calls[0].header_items()))

    def test_short_retry_after_respected(self):
        waits, calls = [], []
        def open_request(*_, **__):
            calls.append(1)
            if len(calls) == 1:
                raise urllib.error.HTTPError(sync.API, 429, "", {"Retry-After": "7"}, None)
            return response({"ok": True})
        client = sync.Client("key", delay=0, opener=open_request, sleep=waits.append)
        self.assertEqual(client.get("/events"), {"ok": True})
        self.assertIn(7, waits)

    def test_long_rate_limit_defers_without_retries(self):
        client = sync.Client("key", opener=lambda *_a, **_k: (_ for _ in ()).throw(
            urllib.error.HTTPError(sync.API, 429, "", {"Retry-After": "600"}, None)))
        with self.assertRaises(sync.RateLimitError):
            client.get("/events")
        self.assertEqual(client.requests, 1)

    def test_corrupt_or_incomplete_pagination_rejected(self):
        for payload in (page([], 1, 2, 5), page([{"id": 1}], total=2), page([], current=2), {"data": []}):
            client = sync.Client("key", opener=lambda *_a, **_k: response(payload), sleep=lambda _: None)
            with self.assertRaises(sync.SyncError):
                client.pages("/events")

    def test_duplicate_pages_rejected(self):
        count = 0
        def open_request(*_, **__):
            nonlocal count
            count += 1
            return response(page([{"id": 1}], count, 2, 2))
        with self.assertRaises(sync.SyncError):
            sync.Client("key", opener=open_request, sleep=lambda _: None).pages("/events")

    def test_budget_is_a_hard_limit(self):
        client = sync.Client("key", budget=1, opener=lambda *_a, **_k: response(page([{"id": 1}], 1, 2, 2)))
        with self.assertRaises(sync.RateLimitError):
            client.pages("/events")
        self.assertEqual(client.requests, 1)

    def test_url_and_redirect_safety(self):
        client = sync.Client("key")
        with self.assertRaises(sync.SyncError):
            client.get("https://another-host.invalid/events")
        self.assertIsNone(sync.NoRedirect().redirect_request(None, None, 302, "", {}, "https://elsewhere.invalid"))


class DataTests(unittest.TestCase):
    def test_skills_total_preserved_separate_from_independent_bests(self):
        result = sync.skills_snapshot([ROW], CONFIG, "now")["data"][0]
        self.assertEqual(result["scores"]["score"], 68)
        self.assertEqual(result["scores"]["maxProgramming"], 18)
        self.assertEqual(result["scores"]["programming"], 0)
        self.assertIsNone(result["scores"]["combinedStopTime"])

    def test_missing_is_null_not_zero(self):
        row = copy.deepcopy(ROW)
        del row["scores"]["driver"]
        self.assertIsNone(sync.skills_snapshot([row], CONFIG, "now")["data"][0]["scores"]["driver"])

    def test_wrong_season_duplicates_empty_and_bad_scores_rejected(self):
        wrong = copy.deepcopy(ROW)
        wrong["event"]["seasonName"] = "2025-2026"
        bad = copy.deepcopy(ROW)
        bad["scores"]["score"] = "68"
        for rows in ([], [ROW, ROW], [wrong], [bad]):
            with self.assertRaises(sync.SyncError):
                sync.skills_snapshot(rows, CONFIG, "now")

    def test_public_fields_allowlisted(self):
        row = copy.deepcopy(ROW)
        row["team"].update({"email": "private@example.invalid", "link": "<script>bad</script>"})
        result = json.dumps(sync.skills_snapshot([row], CONFIG, "now"))
        self.assertNotIn("private@example", result)
        self.assertNotIn("<script>", result)

    def test_event_matches_use_division_id_and_keep_unscored_flag(self):
        class Fake:
            paths = []
            def get(self, path): return copy.deepcopy(EVENT)
            def pages(self, path):
                self.paths.append(path)
                if path.endswith("/matches"):
                    return [{"id": 7, "event": {"id": 1}, "scored": False,
                             "alliances": [{"color": "red", "score": 0, "teams": []}]}]
                return []
        client = Fake()
        bundle = sync.fetch_event(client, 1, CONFIG, "now")
        self.assertIn("/events/1/divisions/2/matches", client.paths)
        self.assertFalse(bundle["matches"]["data"][0]["scored"])
        self.assertIn("finalistRankings", bundle)

    def test_backfill_has_reserved_capacity(self):
        with tempfile.TemporaryDirectory() as folder:
            events = [{**copy.deepcopy(EVENT), "id": i} for i in (1, 2, 3, 4)]
            events[1]["start"], events[1]["end"] = "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"
            picked, due = sync.due_events(events, CONFIG, Path(folder), datetime(2026, 11, 10, tzinfo=timezone.utc))
            self.assertEqual([x["id"] for x in picked], [1, 2])
            self.assertEqual(due, 4)

    def test_failed_feed_preserves_previous_good_file_and_timestamp(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "data/season-204/skills-high-school.json"
            sync.write_json(target, {"teamCount": 100, "fetchedAt": "yesterday"})
            sync.write_json(root / "data/season-204/sync-status.json", {"skills": {"lastSuccessfulAt": "yesterday"}})
            client = sync.Client(opener=lambda *_a, **_k: response([]))
            status = sync.refresh(root, CONFIG, client)
            self.assertEqual(sync.read_json(target)["fetchedAt"], "yesterday")
            self.assertEqual(status["skills"]["lastSuccessfulAt"], "yesterday")
            self.assertEqual(status["skills"]["state"], "failed")
            self.assertEqual(client.requests, 1)

    def test_no_key_skips_protected_api_but_saves_real_public_data(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            client = sync.Client(opener=lambda *_a, **_k: response([ROW]))
            status = sync.refresh(root, CONFIG, client)
            self.assertEqual(status["events"]["state"], "needs-api-key")
            self.assertEqual(client.requests, 1)
            self.assertEqual(len(list((root / "data/season-204/history").glob("*.json"))), 1)

    def test_public_rate_limit_stops_all_further_requests(self):
        with tempfile.TemporaryDirectory() as folder:
            client = sync.Client("key", opener=lambda *_a, **_k: (_ for _ in ()).throw(
                urllib.error.HTTPError(sync.HOST, 429, "", {"Retry-After": "600"}, None)))
            status = sync.refresh(Path(folder), CONFIG, client)
            self.assertEqual(client.requests, 1)
            self.assertEqual(status["events"]["state"], "deferred")

    def test_storage_failure_is_fatal_and_not_a_publishable_api_error(self):
        with tempfile.TemporaryDirectory() as folder:
            client = sync.Client(opener=lambda *_a, **_k: response([ROW]))
            with patch("vex_sync.write_json", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    sync.refresh(Path(folder), CONFIG, client)

    def test_bad_event_fetch_does_not_replace_existing_event(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "data/events/1/event.json"
            sync.write_json(target, {"data": {"id": 1, "name": "old good data"}})
            class Fake:
                token, requests = "key", 0
                def get(self, path, *_, **__):
                    if path.endswith("/skills"): return [ROW]
                    return copy.deepcopy(EVENT)
                def pages(self, path):
                    if path == "/seasons/204/events": return [copy.deepcopy(EVENT)]
                    raise sync.SyncError("incomplete response")
            status = sync.refresh(root, CONFIG, Fake())
            self.assertEqual(sync.read_json(target)["data"]["name"], "old good data")
            self.assertEqual(status["events"]["state"], "partial")

    def test_atomic_file_write_keeps_old_file_if_replace_fails(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "good.json"
            sync.write_json(target, {"good": 1})
            with patch("vex_sync.os.replace", side_effect=OSError("disk failure")):
                with self.assertRaises(OSError): sync.write_json(target, {"bad": 1})
            self.assertEqual(sync.read_json(target), {"good": 1})
            self.assertEqual(len(list(Path(folder).iterdir())), 1)


if __name__ == "__main__":
    unittest.main()
