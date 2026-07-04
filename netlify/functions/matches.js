// netlify/functions/matches.js
// Fetches World Cup fixtures/scores from football-data.org and caches the
// result in memory for CACHE_MS so many simultaneous users only cost us
// one upstream API call every minute, not one call per visitor.

let cache = { data: null, timestamp: 0 };
const CACHE_MS = 60 * 1000; // 60 seconds
const COMPETITION = "WC"; // FIFA World Cup code on football-data.org

exports.handler = async function () {
  const now = Date.now();

  if (cache.data && now - cache.timestamp < CACHE_MS) {
    return respond(200, cache.data);
  }

  try {
    const token = process.env.FOOTBALL_DATA_TOKEN;
    if (!token) throw new Error("Missing FOOTBALL_DATA_TOKEN");

    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${COMPETITION}/matches`,
      { headers: { "X-Auth-Token": token } }
    );

    if (!res.ok) throw new Error(`Upstream ${res.status}`);

    const json = await res.json();

    const matches = (json.matches || []).map((m) => ({
      id: m.id,
      stage: m.stage,
      utcDate: m.utcDate,
      status: m.status, // SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, POSTPONED
      home: m.homeTeam && m.homeTeam.name ? m.homeTeam.name : "TBD",
      homeCrest: m.homeTeam ? m.homeTeam.crest : null,
      away: m.awayTeam && m.awayTeam.name ? m.awayTeam.name : "TBD",
      awayCrest: m.awayTeam ? m.awayTeam.crest : null,
      venue: m.venue || "",
      homeScore:
        m.score && m.score.fullTime ? m.score.fullTime.home : null,
      awayScore:
        m.score && m.score.fullTime ? m.score.fullTime.away : null,
    }));

    const payload = { matches, updatedAt: now };
    cache = { data: payload, timestamp: now };
    return respond(200, payload);
  } catch (err) {
    // If the upstream call fails, serve the last good cache instead of
    // breaking the app for everyone.
    if (cache.data) return respond(200, cache.data);
    return respond(500, { error: err.message, matches: [] });
  }
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(body),
  };
}
