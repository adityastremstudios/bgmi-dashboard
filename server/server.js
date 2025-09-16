import express from "express";
import fs from "fs";
import cors from "cors";
import { saveMatchData } from "./googleSheets.js";

const app = express();
app.use(cors());
app.use(express.json());

const JSON_PATH = "./server/liveData.json";

// Default match state
let liveData = {
  match_status: "waiting",
  match_timer: "00:00",
  lobby_stats: { players_alive: 0, teams_alive: 0, total_kills: 0 },
  recent_events: [],
  teams: []
};

// Serve live JSON for vMix
app.get("/live.json", (req, res) => {
  res.json(liveData);
});

// Update from frontend
app.post("/update", (req, res) => {
  liveData = { ...liveData, ...req.body };
  fs.writeFileSync(JSON_PATH, JSON.stringify(liveData, null, 2));
  res.json({ success: true });
});

// Save to Google Sheets
app.post("/end-match", async (req, res) => {
  try {
    await saveMatchData(req.body);
    res.json({ success: true, message: "Match saved to Google Sheets" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset match
app.post("/end-match", async (req, res) => {
  try {
    const { teams = [], match_timer = "00:00", lobby_stats = {} } = req.body || {};
    const sheetTitle = `Match ${Date.now()}`; // or auto-increment match counter

    await writeMatchToSheet({
      sheetTitle,
      matchTimer: match_timer,
      lobbyStats: lobby_stats,
      teams
    });

    res.json({ ok: true, message: "Match ended and pushed to Google Sheets" });
  } catch (err) {
    console.error("end-match error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
