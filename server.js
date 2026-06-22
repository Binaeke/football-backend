const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// --------------------
// SOURCES
// --------------------
const LIVE_URL =
  "https://api.sofascore.com/api/v1/sport/football/events/live";

function getTodayURL() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${yyyy}-${mm}-${dd}`;
}

// --------------------
// STATE CACHE
// --------------------
let cache = null;
let cacheTime = 0;
let lastScoreMap = new Map();

// --------------------
// FETCH
// --------------------
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return res.json();
}

// --------------------
// GET ALL EVENTS
// --------------------
async function getMatches() {
  const [live, today] = await Promise.all([
    fetchJSON(LIVE_URL),
    fetchJSON(getTodayURL())
  ]);

  return [
    ...(live.events || []),
    ...(today.events || [])
  ];
}

// --------------------
// CW+ IMPORTANCE ENGINE
// --------------------
const BIG_TEAMS = [
  "France",
  "Argentina",
  "Brazil",
  "Germany",
  "England",
  "Spain",
  "Portugal"
];

function importanceScore(m) {
  const home = m.homeTeam?.name || "";
  const away = m.awayTeam?.name || "";

  let score = 0;

  if (m.status?.type === "inprogress") score += 100;
  if (m.status?.type === "notstarted") score += 40;

  BIG_TEAMS.forEach(t => {
    if (home.includes(t) || away.includes(t)) score += 30;
  });

  if (m.isFinal || m.status?.type === "finished") score += 10;

  return score;
}

// --------------------
// SELECT BEST MATCH
// --------------------
function selectMatch(events) {
  const football = events.filter(e => e.sport?.name === "Football");

  if (!football.length) return null;

  football.sort((a, b) => importanceScore(b) - importanceScore(a));

  return football[0];
}

// --------------------
// CLOCK ENGINE
// --------------------
function getMinute(utcDate) {
  const start = new Date(utcDate).getTime();
  const now = Date.now();

  let min = Math.floor((now - start) / 60000);

  if (min < 0) return "0'";
  if (min <= 45) return `${min}'`;
  if (min <= 90) return `${min}'`;
  return `90+`;
}

// --------------------
// HALFTIME DETECTION
// --------------------
function isHalftime(match) {
  const s = (match.status?.type || "").toLowerCase();
  return s.includes("halftime") || s.includes("intermission");
}

// --------------------
// FORMAT OUTPUT
// --------------------
function format(match) {
  if (!match) {
    return {
      home: "CW+ CONTROL ROOM",
      away: "STANDBY",
      homeScore: "",
      awayScore: "",
      status: "NO ACTIVE MATCH",
      clock: "",
      ticker: []
    };
  }

  const key = match.id;

  const home = match.homeTeam?.name || "—";
  const away = match.awayTeam?.name || "—";

  const homeScore = match.homeScore?.current ?? 0;
  const awayScore = match.awayScore?.current ?? 0;

  // --------------------
  // GOAL DETECTION (EVENT CHANGE)
  // --------------------
  const prev = lastScoreMap.get(key);
  const currentScore = `${homeScore}-${awayScore}`;

  let goalEvent = null;

  if (prev && prev !== currentScore) {
    goalEvent = {
      type: "GOAL",
      message: `⚽ GOAL! ${home} ${homeScore} - ${awayScore} ${away}`
    };
  }

  lastScoreMap.set(key, currentScore);

  return {
    home,
    away,
    homeScore,
    awayScore,

    status: match.status?.type || "UNKNOWN",

    clock: isHalftime(match)
      ? "HT"
      : match.status?.type === "inprogress"
      ? getMinute(match.utcDate)
      : "",

    goalEvent,

    ticker: [
      `${home} vs ${away}`,
      `Status: ${match.status?.type || "UNKNOWN"}`,
      `CW+ BROADCAST ACTIVE`
    ]
  };
}

// --------------------
// MAIN ROUTE
// --------------------
app.get("/auto-match", async (req, res) => {
  try {
    const now = Date.now();

    if (cache && now - cacheTime < 10000) {
      return res.json(cache);
    }

    const events = await getMatches();
    const match = selectMatch(events);

    const payload = format(match);

    cache = payload;
    cacheTime = now;

    res.json(payload);

  } catch (err) {
    res.json({
      home: "CW+",
      away: "ERROR",
      homeScore: "",
      awayScore: "",
      status: "RECONNECTING SIGNAL",
      clock: "",
      ticker: []
    });
  }
});

// --------------------
// OBS CONTROL HOOK (OPTIONAL)
// --------------------
app.post("/scene", (req, res) => {
  // placeholder for OBS WebSocket / Stream Deck integration
  res.json({ ok: true, message: "OBS hook ready (not connected yet)" });
});

// --------------------
app.listen(3000, () => {
  console.log("🔥 CW+ CONTROL ROOM ENGINE ACTIVE");
  
  console.log("CW+ running on http://localhost:3000");
});
