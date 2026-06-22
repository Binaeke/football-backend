const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = "1df1eebb1229b56f24ffd0cee4ad12f1";

// ⚽ Stable fetch
async function apiFetch(url) {
  const res = await fetch(url, {
    headers: {
      "x-apisports-key": API_KEY
    }
  });
  return res.json();
}

/**
 * GET LIVE MATCHES
 */
app.get("/auto-match", async (req, res) => {
  try {
    // 1. LIVE matches
    const liveRes = await apiFetch("https://v3.football.api-sports.io/fixtures?live=all");
    let matches = liveRes.response || [];

    // 2. fallback: today's matches if no live
    if (!matches.length) {
      const today = new Date().toISOString().split("T")[0];

      const todayRes = await apiFetch(
        `https://v3.football.api-sports.io/fixtures?date=${today}`
      );

      matches = todayRes.response || [];
    }

    // 3. fallback hardcoded empty safe state
    if (!matches.length) {
      return res.json({
        home: "—",
        away: "—",
        homeScore: 0,
        awayScore: 0,
        status: "NO MATCH",
        utcDate: new Date().toISOString()
      });
    }

    // 4. pick match (Argentina priority)
    let match =
      matches.find(m =>
        m.teams.home.name.toLowerCase().includes("argentina") ||
        m.teams.away.name.toLowerCase().includes("argentina")
      ) || matches[0];

    res.json({
      home: match.teams.home.name,
      away: match.teams.away.name,
      homeScore: match.goals.home ?? 0,
      awayScore: match.goals.away ?? 0,
      status: match.fixture.status.short,
      utcDate: match.fixture.date
    });

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
  console.log("🔥 API-Football server running on http://localhost:3000");
});