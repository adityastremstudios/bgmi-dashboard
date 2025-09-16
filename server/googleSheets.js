const { google } = require("googleapis");

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

async function writeMatchToSheet({ sheetTitle, matchTimer, lobbyStats, teams }) {
  const spreadsheetId = process.env.SHEET_ID;
  const sheets = await getSheetsClient();

  // Ensure tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = meta.data.sheets.map(s => s.properties.title);
  if (!titles.includes(sheetTitle)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] }
    });
  }

  // Build rows
  const rows = [
    ["Match Timer", matchTimer, "", "Players Alive", lobbyStats.players_alive, "Teams Alive", lobbyStats.teams_alive, "Total Kills", lobbyStats.total_kills],
    [],
    ["Team", "Player", "Kills", "Alive", "Survival Time", "Knocked", "Position", "Team Eliminated"]
  ];

  teams.forEach(t => {
    t.players.forEach(p => {
      rows.push([
        t.team_name,
        p.name,
        p.kills || 0,
        p.alive ? "Yes" : "No",
        p.survival_time || "",
        p.knocked ? "Yes" : "No",
        t.position ?? "",
        t.eliminated ? "Yes" : "No"
      ]);
    });
  });

  // Clear + write
  const range = `${sheetTitle}!A1:H1000`;
  await sheets.spreadsheets.values.clear({ spreadsheetId, range });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: rows }
  });
}

module.exports = { writeMatchToSheet };
