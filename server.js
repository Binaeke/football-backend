const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

// -------------------
// SOURCES
// -------------------
const LIVE_URL =
  "https://api.sofascore.com/api/v1/sport/football/events/live";

// dynamic today URL
function getTodayURL() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `https://api.sofascore.com/api/v1/sport/football/scheduled-events/${yyyy}-${mm}-${dd}`;
}

// -------------------
let cache = null;
let cacheTime = 0;

// -------------------
// FETCH
// -------------------
async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return res.json();
}

// -------------------
// GET DATA
// -------------------
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

// -------------------
// BIG MATCH PRIORITY (ESPN+ FEATURE)
// -------------------
const PRIORITY_TEAMS = [
  "France",
  "Argentina",
  "Brazil",
  "Germany",
  "England",
  "Spain",
  "Portugal"
];

function teamScore(match) {
  const home = match.homeTeam?.name || "";
  const away = match.awayTeam?.name || "";

  let score = 0;

  PRIORITY_TEAMS.forEach(team => {
    if (home.includes(team) || away.includes(team)) {
      score += 10;
    }
  });

  if (match.status?.type === "inprogress") score += 50;
  if (match.status?.type === "notstarted") score += 20;

  return score;
}

// -------------------
// SELECT MATCH (ESPN+ ENGINE)
// -------------------
function selectMatch(events) {
  const football = events.filter(e => e.sport?.name === "Football");

  if (!football.length) return null;

  // normalize status safely
  const getStatus = (e) =>
    e.status?.type ||
    e.status?.description ||
    e.status?.name ||
    "";

  // 🟢 LIVE detection (BROADER)
  const live = football.find(e => {
    const s = getStatus(e).toLowerCase();
    return (
      s.includes("live") ||
      s.includes("inprogress") ||
      s.includes("in_progress") ||
      s.includes("1st") ||
      s.includes("2nd")
    );
  });

  if (live) return live;

  // 🟡 UPCOMING
  const upcoming = football.find(e => {
    const s = getStatus(e).toLowerCase();
    return (
      s.includes("notstarted") ||
      s.includes("scheduled") ||
      s.includes("upcoming")
    );
  });

  if (upcoming) return upcoming;

  // 🔵 fallback to most relevant match
  return football[0];
}

// -------------------
// BROADCAST CLOCK
// -------------------
function getMatchMinute(utcDate) {
  const start = new Date(utcDate).getTime();
  const now = Date.now();

  let minutes = Math.floor((now - start) / 60000);

  if (minutes < 0) return "0'";
  if (minutes <= 45) return minutes + "'";
  if (minutes <= 90) return minutes + "'";
  return "90+";
}

// -------------------
// FORMAT RESPONSE
// -------------------
function format(match) {
  if (!match) {
    return {
      home: "ESPN+",
      away: "NO MATCH",
      homeScore: "",
      awayScore: "",
      status: "STANDBY",
      clock: "",
      utcDate: new Date().toISOString()
    };
  }

  const statusMap = {
    inprogress: "LIVE 🔴",
    live: "LIVE 🔴",
    notstarted: "UPCOMING 🟡",
    finished: "FT ⚪"
  };

  return {
    home: match.homeTeam?.name || "—",
    away: match.awayTeam?.name || "—",
    homeScore: match.homeScore?.current ?? 0,
    awayScore: match.awayScore?.current ?? 0,
    status: statusMap[match.status?.type] || "UNKNOWN",
    clock:
      match.status?.type === "inprogress"
        ? getMatchMinute(match.utcDate)
        : "",
    utcDate: match.utcDate || new Date().toISOString()
  };
}

// -------------------
// API
// -------------------
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
      home: "ESPN+",
      away: "ERROR",
      homeScore: "",
      awayScore: "",
      status: "RECONNECTING",
      clock: "",
      utcDate: new Date().toISOString()
    });
  }
});

// -------------------
app.listen(3000, () => {
  console.log("🔥 ESPN+ BROADCAST ENGINE RUNNING");
});