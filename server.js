const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const API_KEY = "99cdd9bb54f544aabc3a8c0d177bbf48";

// helper
async function apiFetch(url) {
  const res = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY }
  });
  return res.json();
}

/**
 * GET BEST MATCH (AUTO PICK)
 * Priority: LIVE → TIMED → any
 */
app.get("/auto-match", async (req, res) => {
  try {
    const data = await apiFetch("https://api.football-data.org/v4/matches");

    const matches = data.matches;

    // 1. LIVE match first
    let match =
      matches.find(m => m.status === "LIVE") ||

      // 2. else upcoming match
      matches.find(m => m.status === "TIMED") ||

      // 3. fallback
      matches[0];

    if (!match) {
      return res.json({ error: "No matches found" });
    }

    res.json({
      id: match.id,
      home: match.homeTeam.name,
      away: match.awayTeam.name,
      status: match.status,
      score: match.score?.fullTime || { home: null, away: null }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("🔥 PRO SERVER RUNNING: http://localhost:3000");
});