const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const LIVE_URL =
  "https://api.sofascore.com/api/v1/sport/football/events/live";

let cachedMatch = null;
let lastUpdate = 0;

async function fetchSofascore() {
  const res = await fetch(LIVE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  return res.json();
}

app.get("/auto-match", async (req, res) => {
  try {
    const now = Date.now();

    // 🧠 cache (prevents rate issues)
    if (cachedMatch && now - lastUpdate < 15000) {
      return res.json(cachedMatch);
    }

    const data = await fetchSofascore();
    const events = data?.events || [];

    if (!events.length) {
      return res.json({
        home: "—",
        away: "—",
        homeScore: 0,
        awayScore: 0,
        status: "NO LIVE MATCH",
        utcDate: new Date().toISOString()
      });
    }

    const match = events[0];

    const payload = {
      home: match.homeTeam?.name || "—",
      away: match.awayTeam?.name || "—",
      homeScore: match.homeScore?.current ?? 0,
      awayScore: match.awayScore?.current ?? 0,
      status: match.status?.type || "LIVE",
      utcDate: new Date().toISOString()
    };

    cachedMatch = payload;
    lastUpdate = now;

    res.json(payload);

  } catch (err) {
    res.json({
      home: "—",
      away: "—",
      homeScore: 0,
      awayScore: 0,
      status: "ERROR",
      utcDate: new Date().toISOString()
    });
  }
});

app.listen(3000, () => {
  console.log("🔥 Sofascore server running on http://localhost:3000");
});