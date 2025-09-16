const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { saveMatchData, updateLiveData, getLiveData } = require("./firebase");
const { writeMatchToSheet } = require("./googleSheets");

const app = express();
app.use(cors());
app.use(bodyParser.json());

let matchCounter = 0;

// 🟢 Update live data (for vMix overlays)
app.post("/update", async (req, res) => {
  try {
    await updateLiveData(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🟢 Provide live JSON for vMix
app.get("/live.json", async (req, res) => {
  try {
    const data = await getLiveData();
    res.json(data);
  } catch (err) {
    console.error("Live.json error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 🟢 Save final match data → Firestore + Google Sheets
app.post("/end-match", async (req, res) => {
  try {
    const { teams = [], match_timer = "00:00", lobby_stats = {} } = req.body || {};
    matchCounter += 1;
    const sheetTitle = `Match ${matchCounter}`;

    // Save to Firestore
    await saveMatchData(matchCounter, req.body);

    // Save to Google Sheets
    await writeMatchToSheet({
      sheetTitle,
      matchTimer: match_timer,
      lobbyStats: lobby_stats,
      teams
    });

    res.json({ ok: true, match: matchCounter, sheetTitle });
  } catch (err) {
    console.error("End-match error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ Render expects you to listen on process.env.PORT
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
