const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { writeMatchToSheet } = require("./googleSheets");
const { saveMatchData, updateLiveData, getLiveData } = require("./firebase");

const app = express();
app.use(cors());
app.use(bodyParser.json());

let matchCounter = 0;

// Update live match state (Firestore only)
app.post("/update", async (req, res) => {
  try {
    await updateLiveData(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("update error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Live JSON for vMix (from Firestore)
app.get("/live.json", async (req, res) => {
  try {
    const data = await getLiveData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// End match → save to Firestore + Google Sheets
app.post("/end-match", async (req, res) => {
  try {
    const { teams = [], match_timer = "00:00", lobby_stats = {} } = req.body || {};
    matchCounter += 1;
    const sheetTitle = `Match ${matchCounter}`;

    // Save to Firestore
    await saveMatchData(matchCounter, req.body);

    // Save to Google Sheets
    await writeMatchToSheet({ sheetTitle, matchTimer: match_timer, lobbyStats: lobby_stats, teams });

    res.json({ ok: true, match: matchCounter, sheetTitle });
  } catch (err) {
    console.error("end-match error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Port for Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
