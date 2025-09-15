import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json", // downloaded from Google Cloud
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({ version: "v4", auth });

// Your spreadsheet ID
const SPREADSHEET_ID = "1zdakAy6Pcn20J547ZVhLo7-uY6cJRXliaDBt_BUDiGw";

async function getNextMatchId() {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const titles = spreadsheet.data.sheets.map(s => s.properties.title);
  const matchTabs = titles.filter(t => t.startsWith("Match_"));
  if (matchTabs.length === 0) return 1;
  const nums = matchTabs.map(t => parseInt(t.replace("Match_", ""), 10)).filter(n => !isNaN(n));
  return Math.max(...nums) + 1;
}

export async function saveMatchData(matchData) {
  const matchId = await getNextMatchId();
  const title = `Match_${matchId}`;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] }
  });

  const header = [
    "Team Name", "Logo", "Position",
    "Player 1", "Kills", "Survival Time", "Achievement",
    "Player 2", "Kills", "Survival Time", "Achievement",
    "Player 3", "Kills", "Survival Time", "Achievement",
    "Player 4", "Kills", "Survival Time", "Achievement",
    "Team Kills", "Notes"
  ];

  const rows = matchData.teams.map(team => {
    const players = team.players.flatMap(p => [
      p.name,
      p.kills,
      p.survival_time,
      p.achievement || ""
    ]);
    const totalKills = team.players.reduce((sum, p) => sum + p.kills, 0);
    return [team.team_name, team.logo, team.position, ...players, totalKills, team.notes || ""];
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [header, ...rows] }
  });

  console.log(`✅ Saved ${title} to Google Sheets`);
}
