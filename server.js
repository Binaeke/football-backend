const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = "YOUR_API_FOOTBALL_KEY";

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
    const data = await apiFetch("https://v3.football.api-sports.io/fixtures?live=all");

    const matches = data.response || [];

    if (!matches.length) {
      return res.json({
        home: "—",
        away: "—",
        homeScore: 0,
        awayScore: 0,
        status: "NO LIVE MATCH",
        utcDate: new Date().toISOString()
      });
    }

    // 🧠 Pick match: Argentina first, otherwise first live match
    let match =
      matches.find(m =>
        m.teams.home.name.toLowerCase().includes("argentina") ||
        m.teams.away.name.toLowerCase().includes("argentina")
      ) || matches[0];

    const fixture = match.fixture;
    const goals = match.goals;

    res.json({
      home: match.teams.home.name,
      away: match.teams.away.name,

      homeScore: goals.home ?? 0,
      awayScore: goals.away ?? 0,

      status: match.fixture.status.short,
      utcDate: fixture.date
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