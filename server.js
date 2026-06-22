const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// -------------------
// SOFASCORE SOURCES
// -------------------
const LIVE_URL =
  "https://api.sofascore.com/api/v1/sport/football/events/live";

const TODAY_URL =
  "https://api.sofascore.com/api/v1/sport/football/scheduled-events/2026-06-22";

// -------------------
let cache = null;
let cacheTime = 0;

// -------------------
// FETCH HELPERS
// -------------------
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return res.json();
}

// -------------------
// GET ALL MATCHES
// -------------------
async function getAllMatches() {
  const [live, today] = await Promise.all([
    fetchJSON(LIVE_URL),
    fetchJSON(TODAY_URL)
  ]);

  return [
    ...(live.events || []),
    ...(today.events || [])
  ];
}

// -------------------
// ESPN MATCH SELECTOR
// -------------------
function selectMatch(events) {
  const football = events.filter(
    e => e.sport?.name === "Football"
  );

  if (!football.length) return null;

  // 🟢 LIVE FIRST
  const live = football.find(
    e => e.status?.type === "inprogress"
  );
  if (live) return live;

  // 🟡 TODAY MATCHES
  const upcoming = football.find(
    e => e.status?.type === "notstarted"
  );
  if (upcoming) return upcoming;

  // 🔵 FALLBACK
  return football[0];
}

// -------------------
// FORMAT ESPN RESPONSE
// -------------------
function format(match) {
  if (!match) {
    return {
      home: "ESPN LIVE",
      away: "STANDBY",
      homeScore: "",
      awayScore: "",
      status: "NO ACTIVE MATCH",
      utcDate: new Date().toISOString()
    };
  }

  return {
    home: match.homeTeam?.name || "—",
    away: match.awayTeam?.name || "—",
    homeScore: match.homeScore?.current ?? 0,
    awayScore: match.awayScore?.current ?? 0,
    status: match.status?.type || "UNKNOWN",
    utcDate: match.utcDate || new Date().toISOString()
  };
}

// -------------------
// MAIN ROUTE
// -------------------
app.get("/auto-match", async (req, res) => {
  try {
    const now = Date.now();

    // cache 15s
    if (cache && now - cacheTime < 15000) {
      return res.json(cache);
    }

    const events = await getAllMatches();
    const match = selectMatch(events);

    const payload = format(match);

    cache = payload;
    cacheTime = now;

    res.json(payload);

  } catch (err) {
    res.json({
      home: "ESPN LIVE",
      away: "SYSTEM ERROR",
      homeScore: "",
      awayScore: "",
      status: "RETRYING SIGNAL",
      utcDate: new Date().toISOString()
    });
  }
});

// -------------------
app.listen(3000, () => {
  console.log("🔥 ESPN MODE ACTIVE: http://localhost:3000");
});