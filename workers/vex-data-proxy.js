const ROBOT_EVENTS_BASE = "https://www.robotevents.com/api/v2";
const PROGRAM_ID = "1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=300" : "no-store"
    }
  });
}

function normalizeEvent(event) {
  return {
    id: event.id,
    code: event.sku || event.code || "",
    name: event.name || "",
    start: event.start || event.start_date || "",
    end: event.end || event.end_date || "",
    date: event.start || event.start_date || "",
    city: event.location?.city || event.city || "",
    region: event.location?.region || event.region || "",
    country: event.location?.country || event.country || "",
    venue: event.location?.venue || event.venue || ""
  };
}

function normalizeTeam(team) {
  return {
    id: team.id,
    teamNumber: team.number || team.team || "",
    teamName: team.team_name || team.name || "",
    organization: team.organization || "",
    city: team.location?.city || team.city || "",
    region: team.location?.region || team.region || "",
    country: team.location?.country || team.country || ""
  };
}

function normalizeMatch(match) {
  return {
    id: match.id,
    eventId: match.event?.id || match.event_id || "",
    eventName: match.event?.name || "",
    division: match.division?.name || "",
    round: match.round || match.round_name || "",
    instance: match.instance || "",
    matchnum: match.matchnum || match.match_number || "",
    scheduled: match.scheduled || "",
    alliances: match.alliances || []
  };
}

function normalizeSkill(skill) {
  return {
    eventId: skill.event?.id || skill.event_id || "",
    eventName: skill.event?.name || "",
    type: skill.type || skill.name || "",
    rank: skill.rank ?? null,
    score: skill.score ?? skill.driver ?? skill.programming ?? null,
    attempts: skill.attempts ?? null
  };
}

async function robotEvents(env, path, params = {}) {
  if (!env.ROBOT_EVENTS_TOKEN) {
    return { error: "ROBOT_EVENTS_TOKEN is not configured on the proxy.", status: 500 };
  }

  const url = new URL(`${ROBOT_EVENTS_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(key, item));
    } else if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.ROBOT_EVENTS_TOKEN}`,
      "Accept": "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      error: payload.message || payload.error || "RobotEvents API request failed.",
      status: response.status
    };
  }
  return payload;
}

async function pagedRobotEvents(env, path, params = {}, limit = 250) {
  const first = await robotEvents(env, path, { ...params, per_page: Math.min(limit, 250) });
  if (first.error) return first;
  const data = [...(first.data || [])];
  const lastPage = first.meta?.last_page || 1;
  for (let page = 2; page <= lastPage && data.length < limit; page += 1) {
    const next = await robotEvents(env, path, { ...params, page, per_page: Math.min(limit, 250) });
    if (next.error) break;
    data.push(...(next.data || []));
  }
  return { data: data.slice(0, limit), meta: first.meta || {} };
}

async function searchEvents(env, requestUrl) {
  const q = requestUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return json({ events: [] });
  const today = new Date().toISOString().slice(0, 10);
  const payload = await robotEvents(env, "/events", {
    "program[]": PROGRAM_ID,
    search: q,
    start: today,
    per_page: 12
  });
  if (payload.error) return json({ error: payload.error }, payload.status || 500);
  return json({ events: (payload.data || []).map(normalizeEvent) });
}

async function eventDetail(env, eventId) {
  const payload = await robotEvents(env, `/events/${eventId}`);
  if (payload.error) return json({ error: payload.error }, payload.status || 500);
  return json({ event: normalizeEvent(payload.data || payload) });
}

async function eventTeams(env, eventId) {
  const payload = await pagedRobotEvents(env, `/events/${eventId}/teams`, {}, 300);
  if (payload.error) return json({ error: payload.error }, payload.status || 500);
  return json({ teams: (payload.data || []).map(normalizeTeam) });
}

async function teamHistory(env, teamId) {
  const [matches, skills, rankings] = await Promise.all([
    pagedRobotEvents(env, `/teams/${teamId}/matches`, {}, 40),
    pagedRobotEvents(env, `/teams/${teamId}/skills`, {}, 20),
    pagedRobotEvents(env, `/teams/${teamId}/rankings`, {}, 20)
  ]);

  return json({
    matches: matches.error ? [] : (matches.data || []).map(normalizeMatch),
    skills: skills.error ? [] : (skills.data || []).map(normalizeSkill),
    rankings: rankings.error ? [] : (rankings.data || [])
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "GET") {
      return json({ error: "Method not allowed." }, 405);
    }

    const requestUrl = new URL(request.url);
    const path = requestUrl.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);

    try {
      if (path === "/api/events/search") return searchEvents(env, requestUrl);
      if (parts[0] === "api" && parts[1] === "events" && parts[2] && parts.length === 3) {
        return eventDetail(env, parts[2]);
      }
      if (parts[0] === "api" && parts[1] === "events" && parts[2] && parts[3] === "teams") {
        return eventTeams(env, parts[2]);
      }
      if (parts[0] === "api" && parts[1] === "teams" && parts[2] && parts[3] === "history") {
        return teamHistory(env, parts[2]);
      }
      return json({ error: "Unknown endpoint." }, 404);
    } catch {
      return json({ error: "Competition data could not load. Try again later." }, 500);
    }
  }
};
