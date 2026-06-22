const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

let cachedMatch = null;
let lastUpdate = 0;

async function fetchSofascore() {
  const [liveRes, todayRes] = await Promise.all([
    fetch("https://api.sofascore.com/api/v1/sport/football/events/live", {
      headers: { "User-Agent": "Mozilla/5.0" }
    }),
    fetch("https://api.sofascore.com/api/v1/sport/football/scheduled-events/2026-06-22", {
      headers: { "User-Agent": "Mozilla/5.0" }
    })
  ]);

  const liveData = await liveRes.json();
  const todayData = await todayRes.json();

  return [
    ...(liveData.events || []),
    ...(todayData.events || [])
  ];
}

app.get("/auto-match", async (req, res) => {
  try {
    const now = Date.now();

    // 🧠 cache
    if (cachedMatch && now - lastUpdate < 15000) {
      return res.json(cachedMatch);
    }

    const events = await fetchSofascore();

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

    // ⚽ filter football only
    const footballMatches = events.filter(e =>
      e.sport?.name === "Football"
    );

    // 🎯 prioritize live matches
    const match =
      footballMatches.find(e =>
        e.status?.type === "inprogress" ||
        e.status?.type === "live"
      ) ||
      footballMatches[0];

    if (!match) {
      return res.json({
        home: "—",
        away: "—",
        homeScore: 0,
        awayScore: 0,
        status: "NO MATCH FOUND",
        utcDate: new Date().toISOString()
      });
    }

    const payload = {
      home: match.homeTeam?.name || "—",
      away: match.awayTeam?.name || "—",
      homeScore: match.homeScore?.current ?? 0,
      awayScore: match.awayScore?.current ?? 0,
      status: match.status?.type || "LIVE",
      utcDate: match.utcDate || new Date().toISOString()
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