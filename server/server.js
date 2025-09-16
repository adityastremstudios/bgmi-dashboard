const { saveMatchData, updateLiveData, getLiveData } = require("./firebase");

let matchCounter = 0;

// Update live data (for vMix overlays)
app.post("/update", async (req, res) => {
  try {
    await updateLiveData(req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Provide live JSON for vMix
app.get("/live.json", async (req, res) => {
  try {
    const data = await getLiveData();
    res.json(data);
  } catch (err) {
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
    res.status(500).json({ ok: false, error: err.message });
  }
});
