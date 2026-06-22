const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const LIVE_URL =
  "https://api.sofascore.com/api/v1/sport/football/events/live";

const TODAY_URL =
  "https://api.sofascore.com/api/v1/sport/football/scheduled-events/2026-06-22";

let cache = null;
let cacheTime = 0;

// ----------------------
// FETCH SOFASCORE DATA
// ----------------------
async function fetchData(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return res.json();
}

// ----------------------
// MAIN DATA PIPELINE
// ----------------------
async function getMatches() {
  const [live, today] = await Promise.all([
    fetchData(LIVE_URL),
    fetchData(TODAY_URL)
  ]);

  return [
    ...(live.events || []),
    ...(today.events || [])
  ];
}

// ----------------------
// MATCH SELECTOR (BROADCAST LOGIC)
// ----------------------
function pickMatch(events) {
  const football = events.filter(
    e => e.sport?.name === "Football"
  );

  if (!football.length) return null;

  // 1. LIVE FIRST
  const liveMatch = football.find(
    e => e.status?.type === "inprogress"
  );

  if (liveMatch) return liveMatch;

  // 2. UPCOMING MATCHES
  const upcoming = football.find(
    e => e.status?.type === "notstarted"
  );

  if (upcoming) return upcoming;

  // 3. FALLBACK
  return football[0];
}

// ----------------------
// FORMAT RESPONSE
// ----------------------
function formatMatch(match) {
  if (!match) {
    return {
      home: "No Match Available",
      away: "",
      homeScore: "",
      awayScore: "",
      status: "STANDBY",
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

// ----------------------
// API ROUTE
// ----------------------
app.get("/auto-match", async (req, res) => {
  try {
    const now = Date.now();

    // cache (15s)
    if (cache && now - cacheTime < 15000) {
      return res.json(cache);
    }

    const events = await getMatches();
    const match = pickMatch(events);
    const payload = formatMatch(match);

    cache = payload;
    cacheTime = now;

    res.json(payload);

  } catch (err) {
    res.json({
      home: "—",
      away: "—",
      homeScore: "",
      awayScore: "",
      status: "ERROR",
      utcDate: new Date().toISOString()
    });
  }
});

// ----------------------
app.listen(3000, () => {
  console.log("🔥 BROADCAST ENGINE RUNNING: http://localhost:3000");
});