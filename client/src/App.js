import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const MAX_TEAMS = 25;
const SQUAD_SIZE = 4;

export default function App() {
  const [teams, setTeams] = useState([]); // you add teams manually
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

  // ===== Sync to backend (JSON for vMix) =====
  const syncData = async () => {
    const playersAlive = teams.reduce(
      (sum, t) => sum + t.players.filter((p) => p.alive).length,
      0
    );
    const teamsAlive = teams.filter((t) => t.players.some((p) => p.alive)).length;

    // total_kills still computed from model (will be 0 unless updated programmatically)
    const totalKills = teams.reduce(
      (sum, t) => sum + t.players.reduce((s, p) => s + (p.kills || 0), 0),
      0
    );

    await axios.post(`${API_URL}/update`, {
      match_status: matchStatus,
      match_timer: matchTimer,
      lobby_stats: { players_alive: playersAlive, teams_alive: teamsAlive, total_kills: totalKills },
      // We keep all events in JSON for vMix; UI will only render eliminations
      recent_events: events.slice(0, 8),
      teams
    });
  };

  useEffect(() => {
    if (matchStatus !== "waiting") syncData();
    // eslint-disable-next-line
  }, [teams, events, matchTimer]);

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
  const addTeam = (teamName, logoDataUrl) => {
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
        // kept in model for backend/vMix; not shown in UI:
        kills: 0,
        achievement: null,
        alive: true,
        survival_time: "00:00"
      }))
    };
    setTeams((prev) => [...prev, newTeam]);
  };

  const removeTeam = (id) => setTeams((prev) => prev.filter((t) => t.id !== id));

  const updateTeam = (teamId, patch) =>
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, ...patch } : t)));

  const updatePlayer = (teamId, idx, patch) =>
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, players: t.players.map((p, i) => (i === idx ? { ...p, ...patch } : p)) }
          : t
      )
    );

  // ===== Player elimination (auto team position when last member dies) =====
  const eliminatePlayer = (teamId, playerIdx) => {
    setTeams((prev) => {
      const idxTeam = prev.findIndex((t) => t.id === teamId);
      if (idxTeam === -1) return prev;

      const team = prev[idxTeam];
      const newPlayers = team.players.map((p, i) =>
        i === playerIdx ? { ...p, alive: false, survival_time: matchTimer } : p
      );

      const willBeAliveAfter = newPlayers.some((p) => p.alive);
      let newTeam = { ...team, players: newPlayers };

      // If this eliminates the whole team, auto-assign position
      if (!willBeAliveAfter && !team.eliminated) {
        const teamsAliveBefore = prev.filter((tt) => tt.players.some((p) => p.alive)).length;
        const autoPos = Math.max(1, teamsAliveBefore); // first wipe gets Nth where N=alive before
        newTeam = { ...newTeam, eliminated: true, position: autoPos };

        // Event for vMix (UI will only show elimination events)
        const ev = {
          type: "elimination",
          team: team.team_name,
          position: autoPos,
          message: `${team.team_name} Eliminated – ${autoPos}th Place`,
          at: new Date().toISOString()
        };
        setEvents((e) => [ev, ...e]);
      }

      const next = [...prev];
      next[idxTeam] = newTeam;
      return next;
    });
  };

  // ===== Manual position override (dropdown) =====
  const setTeamEliminatedWithPosition = (teamId, pos) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              eliminated: true,
              position: pos,
              players: t.players.map((p) =>
                p.alive ? { ...p, alive: false, survival_time: matchTimer } : p
              )
            }
          : t
      )
    );

    const tm = teams.find((t) => t.id === teamId);
    if (tm) {
      setEvents((ev) => [
        {
          type: "elimination",
          team: tm.team_name,
          position: pos,
          message: `${tm.team_name} Eliminated – ${pos}th Place`,
          at: new Date().toISOString()
        },
        ...ev
      ]);
    }
  };

  // ===== Logo file helper =====
  const handleLogoFile = (file, onReady) => {
    if (!file) return onReady("");
    const reader = new FileReader();
    reader.onload = (e) => onReady(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4" style={{ fontFamily: "Arial, sans-serif" }}>
      <h1 className="text-2xl font-bold mb-4">BGMI Tournament Dashboard</h1>

      {/* Controls */}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px,1fr))", gap: 12 }}>
        {teams.map((team) => (
          <div key={team.id} style={{
            border: "1px solid #ddd", borderRadius: 8, padding: 12,
            background: team.eliminated ? "#ffe5e5" : "#fff"
          }}>
            {/* Header */}
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

            {/* Players (NO kills/achievements shown in UI) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {team.players.map((p, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    style={{ flex: 1, padding: "4px 6px", border: "1px solid #ccc", borderRadius: 4 }}
                    value={p.name}
                    onChange={(e) => updatePlayer(team.id, idx, { name: e.target.value })}
                  />
                  <span style={{ minWidth: 60, textAlign: "center" }}>
                    {p.alive ? "✅ Alive" : "☠️ Dead"}
                  </span>

                  {/* Eliminate player (records survival time) */}
                  <button
                    disabled={!p.alive}
                    onClick={() => eliminatePlayer(team.id, idx)}
                    style={btn(p.alive ? "orange" : "gray")}
                    title="Mark this player eliminated"
                  >
                    Eliminate
                  </button>
                </div>
              ))}
            </div>

            {/* Team elimination & manual position dropdown */}
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

      {/* Popups: ONLY elimination events (no kills/achievements popups in UI) */}
      <div style={{ position: "fixed", right: 16, bottom: 16, width: 320 }}>
        {events.filter(ev => ev.type === "elimination").slice(0, 3).map((ev, i) => (
          <div key={i} style={{
            marginBottom: 8, padding: 10, color: "#fff",
            background: "#ef4444",
            borderRadius: 8, boxShadow: "0 2px 6px rgba(0,0,0,.25)"
          }}>
            {ev.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== helpers ===== */

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
    orange: "#f59e0b"
  };
  return {
    background: map[color] || "#111827",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer"
  };
}
