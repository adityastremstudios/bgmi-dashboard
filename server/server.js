const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { saveMatchData, updateLiveData, getLiveData } = require("./firebase");

const app = express();
app.use(cors());
app.use(bodyParser.json());

let matchCounter = 0;

// Update live data (for vMix overlays)
app.post("/update", async (req, res) => {
  try {
    await updateLiveData(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Provide live JSON for vMix
app.get("/live.json", async (req, res) => {
  try {
    const data = await getLiveData();
    res.json(data);
  } catch (err) {
    console.error("Live.json error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Save final match data
app.post("/end-match", async (req, res) => {
  try {
    matchCounter += 1;
    await saveMatchData(matchCounter, req.body);
    res.json({ ok: true, match: matchCounter });
  } catch (err) {
    console.error("End-match error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ✅ Important: Listen on Render's port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
