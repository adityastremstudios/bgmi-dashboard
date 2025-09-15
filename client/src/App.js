import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const MAX_TEAMS = 25;
const SQUAD_SIZE = 4;

export default function App() {
  // ===== State =====
  const [teams, setTeams] = useState([]); // start with 0 teams; you add them
  const [matchStatus, setMatchStatus] = useState("waiting");
  const [elapsed, setElapsed] = useState(0);
  const [matchTimer, setMatchTimer] = useState("00:00");
  const [events, setEvents] = useState([]);
  const [intervalId, setIntervalId] = useState(null);

  // ===== Timer =====
  useEffect(() => {
    if (matchStatus === "live") {
      const id = setInterval(() => setElapsed((s) => s + 1), 1000);
      setIntervalId(id);
      return () => clearInterval(id);
    }
  }, [matchStatus]);

  useEffect(() => {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    setMatchTimer(`${mm}:${ss}`);
  }, [elapsed]);

  // ===== Derived lobby stats and backend sync =====
  const syncData = async () => {
    const playersAlive = teams.reduce(
      (sum, t) => sum + t.players.filter((p) => p.alive).length,
      0
    );
    const teamsAlive = teams.filter((t) => t.players.some((p) => p.alive)).length;
    const totalKills = teams.reduce(
      (sum, t) => sum + t.players.reduce((s, p) => s + p.kills, 0),
      0
    );

    await axios.post(`${API_URL}/update`, {
      match_status: matchStatus,
      match_timer: matchTimer,
      lobby_stats: { players_alive: playersAlive, teams_alive: teamsAlive, total_kills: totalKills },
      recent_events: events.slice(0, 8),
      teams,
    });
  };

  useEffect(() => {
    if (matchStatus !== "waiting") syncData();
  }, [teams, events, matchTimer]); // eslint-disable-line

  // ===== Controls =====
  const startMatch = () => {
    setElapsed(0);
    setMatchStatus("live");
  };

  const endMatch = async () => {
    setMatchStatus("ended");
    clearInterval(intervalId);
    await axios.post(`${API_URL}/end-match`, { teams });
  };

  const resetMatch = () => window.location.reload();

  // ===== Team management =====
  const addTeam = async (teamName, logoDataUrl) => {
    if (teams.length >= MAX_TEAMS) return alert("Max 25 teams reached.");
    const newTeam = {
      id: Date.now(),
      team_name: teamName || `Team ${teams.length + 1}`,
      logo: logoDataUrl || "",
      position: null,
      eliminated: false,
      notes: "",
      players: Array.from({ length: SQUAD_SIZE }, (_, j) => ({
        name: `Player ${j + 1}`,
        kills: 0,
        alive: true,
        survival_time: "00:00",
        achievement: null,
      })),
    };
    setTeams((prev) => [...prev, newTeam]);
  };

  const removeTeam = (id) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTeam = (teamId, patch) => {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, ...patch } : t)));
  };

  const updatePlayer = (teamId, idx, patch) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, players: t.players.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }
          : t
      )
    );
  };

  // ===== Kills & achievements =====
  const addKill = (teamId, playerIdx) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        const players = t.players.map((p, i) => {
          if (i !== playerIdx) return p;
          const kills = p.kills + 1;
          let achievement = p.achievement;
          if (kills === 3) achievement = "DOMINATION";
          if (kills === 5) achievement = "RAMPAGE";
          if (kills === 7) achievement = "UNSTOPPABLE";
          if (achievement) {
            setEvents((ev) => [
              {
                type: "achievement",
                team: t.team_name,
                player: p.name,
                kills,
                achievement,
                message: `${p.name} (${t.team_name}) achieved ${achievement} with ${kills} kills!`,
                at: new Date().toISOString(),
              },
              ...ev,
            ]);
          }
          return { ...p, kills, achievement };
        });
        return { ...t, players };
      })
    );
  };

  // ===== Player elimination (replaces Toggle) =====
  const eliminatePlayer = (teamId, playerIdx) => {
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id !== teamId) return t;
        const players = t.players.map((p, i) =>
          i === playerIdx ? { ...p, alive: false, survival_time: matchTimer } : p
        );

        // If this action wipes the team, auto-mark team eliminated with default position
        const wasAliveBefore = t.players.some((p) => p.alive);
        const willBeAliveAfter = players.some((p) => p.alive);
        let eliminatedPatch = {};
        if (wasAliveBefore && !willBeAliveAfter && !t.eliminated) {
          const aliveTeamsBefore = prev.filter((x) => x.players.some((p) => p.alive)).length; // includes this team
          const defaultPosition = aliveTeamsBefore; // first out gets Nth (N = alive teams before)
          eliminatedPatch = { eliminated: true, position: defaultPosition };
          setEvents((ev) => [
            {
              type: "elimination",
              team: t.team_name,
              position: defaultPosition,
              message: `${t.team_name} Eliminated – ${defaultPosition}th Place`,
              at: new Date().toISOString(),
            },
            ...ev,
          ]);
        }
        return { ...t, ...eliminatedPatch, players };
      })
    );
  };

  // ===== Manual team elimination (dropdown override) =====
  const setTeamEliminatedWithPosition = (teamId, pos) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              eliminated: true,
              position: pos,
              players: t.players.map((p) => (p.alive ? { ...p, alive: false, survival_time: matchTimer } : p)),
            }
          : t
      )
    );
    const team = teams.find((t) => t.id === teamId);
    if (team) {
      setEvents((ev) => [
        {
          type: "elimination",
          team: team.team_name,
          position: pos,
          message: `${team.team_name} Eliminated – ${pos}th Place`,
          at: new Date().toISOString(),
        },
        ...ev,
      ]);
    }
  };

  // ===== UI helpers =====
  const handleLogoFile = (file, onReady) => {
    if (!file) return onReady("");
    const reader = new FileReader();
    reader.onload = (e) => onReady(e.target.result);
    reader.readAsDataURL(file);
  };

  // ===== Render =====
  return (
    <div className="p-4" style={{ fontFamily: "Arial, sans-serif" }}>
      <h1 className="text-2xl font-bold mb-4">BGMI Tournament Dashboard</h1>

      {/* Control bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <button onClick={startMatch} style={btn("green")}>Start Match</button>
        <button onClick={endMatch} style={btn("red")}>End Match</button>
        <button onClick={resetMatch} style={btn("gray")}>Reset</button>
        <div style={{ marginLeft: "auto", fontWeight: "bold" }}>Match Time: {matchTimer}</div>
      </div>

      {/* Add Team */}
      <AddTeamForm
        disabled={teams.length >= MAX_TEAMS}
        onAdd={(name, file) => handleLogoFile(file, (logo) => addTeam(name, logo))}
      />
      <div style={{ margin: "8px 0", opacity: 0.8 }}>Teams: {teams.length}/{MAX_TEAMS}</div>

      {/* Teams Grid */}
      <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px,1fr))", gap: 12 }}>
        {teams.map((team) => (
          <div key={team.id} className="card" style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            background: team.eliminated ? "#ffe5e5" : "#fff"
          }}>
            {/* Team header */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              {team.logo ? (
                <img src={team.logo} alt="logo" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: "#eee" }} />
              )}
              <input
                style={{ flex: 1, fontWeight: "bold", padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }}
                value={team.team_name}
                onChange={(e) => updateTeam(team.id, { team_name: e.target.value })}
              />
              <button onClick={() => removeTeam(team.id)} style={btn("gray")}>Remove</button>
            </div>

            {/* Players */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {team.players.map((p, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    style={{ flex: 1, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }}
                    value={p.name}
                    onChange={(e) => updatePlayer(team.id, idx, { name: e.target.value })}
                  />
                  <span style={{ minWidth: 60, textAlign: "center" }}>{p.alive ? "✅ Alive" : "☠️ Dead"}</span>

                  {/* Replace Toggle → Eliminate */}
                  <button
                    disabled={!p.alive}
                    onClick={() => eliminatePlayer(team.id, idx)}
                    style={btn(p.alive ? "orange" : "gray")}
                    title="Mark this player eliminated"
                  >
                    Eliminate
                  </button>

                  <button onClick={() => addKill(team.id, idx)} style={btn("blue")}>+ Kill</button>
                  <span>({p.kills})</span>
                  {p.achievement && <span style={{ marginLeft: 6, fontWeight: "bold", color: "#6b21a8" }}>{p.achievement}</span>}
                </div>
              ))}
            </div>

            {/* Team elimination & position */}
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              {!team.eliminated ? (
                <>
                  <span>Eliminate as Position:</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const pos = Number(e.target.value);
                      if (pos) setTeamEliminatedWithPosition(team.id, pos);
                    }}
                    style={{ padding: "4px 6px" }}
                  >
                    <option value="">-- Select --</option>
                    {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <strong>Position:</strong>
                  <select
                    value={team.position || ""}
                    onChange={(e) => updateTeam(team.id, { position: Number(e.target.value) })}
                    style={{ padding: "4px 6px" }}
                  >
                    {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Popups (top 3 recent events) */}
      <div style={{ position: "fixed", right: 16, bottom: 16, width: 320 }}>
        {events.slice(0, 3).map((ev, i) => (
          <div key={i} style={{
            marginBottom: 8, padding: 10, color: "#fff",
            background: ev.type === "elimination" ? "#ef4444" : "#111827",
            borderRadius: 8, boxShadow: "0 2px 6px rgba(0,0,0,.25)"
          }}>
            {ev.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== Small components / helpers ========== */

function AddTeamForm({ disabled, onAdd }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);

  return (
    <div style={{
      border: "1px solid #ddd", borderRadius: 8, padding: 12,
      background: "#fff", display: "flex", gap: 8, alignItems: "center"
    }}>
      <strong>Add Team</strong>
      <input
        placeholder="Team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: 1, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }}
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ maxWidth: 220 }}
      />
      <button
        disabled={disabled}
        onClick={() => onAdd(name.trim(), file)}
        style={btn(disabled ? "gray" : "green")}
      >
        Add
      </button>
    </div>
  );
}

function btn(color) {
  const map = {
    green: "#22c55e",
    red: "#ef4444",
    gray: "#6b7280",
    blue: "#3b82f6",
    orange: "#f59e0b",
  };
  return {
    background: map[color] || "#111827",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
  };
}
