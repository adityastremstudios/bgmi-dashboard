const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
app.use(cors());
app.use(express.json());

// Match counter (auto-increments on /end-match)
let matchCounter = 0;

/**
 * Helper: Authenticate with Google Sheets
 */
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Render secret file path
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

/**
 * Route: Update live data (for vMix overlays)
 */
app.post("/update", async (req, res) => {
  try {
    // Normally save to Firestore or memory
    global.liveData = req.body;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Route: Provide live JSON for vMix
 */
app.get("/live.json", async (req, res) => {
  try {
    res.json(global.liveData || {});
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Route: Save final match data → Google Sheets
 */
app.post("/end-match", async (req, res) => {
  try {
    matchCounter += 1;

    const sheets = await getSheetsClient();
    const sheetId = process.env.SHEET_ID;

    const values = [
      [
        `Match ${matchCounter}`,
        JSON.stringify(req.body), // dump match data
        new Date().toISOString(),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A:C", // make sure "Sheet1" exists in your Google Sheet
      valueInputOption: "RAW",
      requestBody: { values },
    });

    res.json({ ok: true, match: matchCounter });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Route: Debug Google Sheets connection
 */
app.get("/gs-debug", async (req, res) => {
  try {
    const sheets = await getSheetsClient();
    const sheetId = process.env.SHEET_ID;

    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

    res.json({
      ok: true,
      sheetId,
      title: meta.data.properties.title,
      tabs: meta.data.sheets.map((s) => s.properties.title),
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

/**
 * Start the server
 */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
