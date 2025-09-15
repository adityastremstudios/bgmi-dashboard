import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const MAX_TEAMS = 25;
const SQUAD_SIZE = 4;

export default function App() {
  const [teams, setTeams] = useState([]);           // start empty, you add teams
  const [matchStatus, setMatchStatus] = useState("waiting");
  const [elapsed, setElapsed] = useState(0);
  const [matchTimer, setMatchTimer] = useState("00:00");
  const [events, setEvents] = useState([]);         // goes to JSON for vMix

  // ---- timer ----
  useEffect(() => {
    if (matchStatus !== "live") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [matchStatus]);

  useEffect(() => {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    setMatchTimer(`${mm}:${ss}`);
  }, [elapsed]);

  // ---- derived stats ----
  const playersAlive = teams.reduce((sum, t) => sum + t.players.filter(p => p.alive).length, 0);
  const teamsAlive = teams.filter(t => t.players.some(p => p.alive)).length;
  const totalPlayers = teams.length * SQUAD_SIZE;
  const totalKills = teams.reduce((sum, t) => sum + t.players.reduce((s, p) => s + (p.kills || 0), 0), 0);

  // ---- sync to backend ----
  useEffect(() => {
    if (matchStatus === "waiting") return;
    axios.post(`${API_URL}/update`, {
      match_status: matchStatus,
      match_timer: matchTimer,
      lobby_stats: { players_alive: playersAlive, teams_alive: teamsAlive, total_kills: totalKills },
      recent_events: events.slice(0, 12),
      teams
    }).catch(() => {});
  }, [teams, events, matchTimer]); // eslint-disable-line

  // ---- controls ----
  const startMatch = () => { setElapsed(0); setMatchStatus("live"); };
  const endMatch = async () => {
    setMatchStatus("ended");
    await axios.post(`${API_URL}/end-match`, { teams }).catch(() => {});
  };

  // ---- team management ----
  const addTeam = (team_name, slot, logo) => {
    if (teams.length >= MAX_TEAMS) { alert("Max 25 teams."); return; }
    const t = {
      id: Date.now(),
      team_name: team_name || `Team ${teams.length + 1}`,
      slot: slot || teams.length + 1,
      logo: logo || "",
      position: null,
      eliminated: false,
      players: Array.from({ length: SQUAD_SIZE }, (_, j) => ({
        name: `PLAYER ${j + 1}`,
        kills: 0,
        achievement: null,
        alive: true,
        knocked: false,
        survival_time: "00:00"
      }))
    };
    setTeams(prev => [...prev, t]);
  };

  const removeTeam = (id) => setTeams(prev => prev.filter(t => t.id !== id));
  const updateTeam = (id, patch) => setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const updatePlayer = (teamId, idx, patch) =>
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, players: t.players.map((p, i) => i === idx ? { ...p, ...patch } : p) } : t
    ));

  // ---- kills (UI visible) ----
  const bumpKills = (teamId, idx, delta) => {
    setTeams(prev => prev.map(t => {
      if (t.id !== teamId) return t;
      const players = t.players.map((p, i) => {
        if (i !== idx) return p;
        const kills = Math.max(0, (p.kills || 0) + delta);
        let achievement = p.achievement;
        if (kills === 3) achievement = "DOMINATION";
        if (kills === 5) achievement = "RAMPAGE";
        if (kills === 7) achievement = "UNSTOPPABLE";
        if (achievement) {
          setEvents(ev => [{
            type: "achievement",
            team: t.team_name,
            player: p.name,
            kills,
            achievement,
            message: `${p.name} (${t.team_name}) achieved ${achievement} with ${kills} kills!`,
            at: new Date().toISOString()
          }, ...ev]);
        }
        return { ...p, kills, achievement };
      });
      return { ...t, players };
    }));
  };

  // ---- knock / elim ----
  const setKnock = (teamId, idx, value) => updatePlayer(teamId, idx, { knocked: !!value });

  const setElim = (teamId, idx, value) => {
    if (!value) { updatePlayer(teamId, idx, { alive: true }); return; }
    setTeams(prev => {
      const next = prev.map(t => {
        if (t.id !== teamId) return t;
        const players = t.players.map((p, i) =>
          i === idx ? { ...p, alive: false, knocked: false, survival_time: matchTimer } : p
        );
        let patch = {};
        if (!players.some(p => p.alive) && !t.eliminated) {
          const teamsAliveBefore = prev.filter(tt => tt.players.some(p => p.alive)).length;
          const autoPos = Math.max(1, teamsAliveBefore);
          patch = { eliminated: true, position: autoPos };
          setEvents(ev => [{
            type: "elimination",
            team: t.team_name,
            position: autoPos,
            message: `${t.team_name} Eliminated – ${autoPos}th Place`,
            at: new Date().toISOString()
          }, ...ev]);
        }
        return { ...t, ...patch, players };
      });
      return next;
    });
  };

  const manualElimAndPosition = (teamId, pos) => {
    setTeams(prev => prev.map(t =>
      t.id === teamId
        ? { ...t,
            eliminated: true,
            position: pos,
            players: t.players.map(p => p.alive ? { ...p, alive: false, knocked: false, survival_time: matchTimer } : p)
          }
        : t
    ));
    const tm = teams.find(t => t.id === teamId);
    if (tm) {
      setEvents(ev => [{
        type: "elimination",
        team: tm.team_name,
        position: pos,
        message: `${tm.team_name} Eliminated – ${pos}th Place`,
        at: new Date().toISOString()
      }, ...ev]);
    }
  };

  // ---- logo helper ----
  const toDataURL = (file, cb) => {
    if (!file) return cb("");
    const r = new FileReader();
    r.onload = e => cb(e.target.result);
    r.readAsDataURL(file);
  };

  return (
    <div style={{ padding: 16, background: "#0f172a", minHeight: "100vh", color: "#e5e7eb" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>MATCH 1</div>
          <div style={{ color: "#94a3b8" }}>GRAND FINALS • customize here</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
          <Badge color="#22c55e" label={`${teamsAlive}`} sub="ALIVE TEAMS" />
          <Badge color="#f59e0b" label={`${totalKills}`} sub="KILL COUNT" />
          <Badge color="#a855f7" label={`${playersAlive}/${totalPlayers || 0}`} sub="PLAYERS" />
        </div>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
          <button style={btn("#22c55e", "#06110a")} onClick={startMatch}>Start Match Timer</button>
          <div style={{ fontWeight: 700 }}>⏱ {matchTimer}</div>
          <button style={btn("#374151")} onClick={endMatch}>End</button>
        </div>
      </div>

      {/* add team */}
      <AddTeamBar onAdd={(name, slot, file) => toDataURL(file, (logo) => addTeam(name, Number(slot) || undefined, logo))} count={teams.length} />

      {/* grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 12 }}>
        {teams.map((team, idx) => (
          <div key={team.id} style={{ background: "#111827", borderRadius: 12, borderTop: `4px solid ${colorByIndex(idx)}` }}>
            {/* header */}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 10px 6px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ background: "#0b1220", border: "1px solid #334155", padding: "2px 6px", borderRadius: 6, fontWeight: 700, color: "#93c5fd" }}>#{team.slot}</div>
                <input
                  value={team.team_name}
                  onChange={(e) => updateTeam(team.id, { team_name: e.target.value })}
                  style={{ background: "transparent", border: "1px solid #334155", borderRadius: 6, color: "#e5e7eb", padding: "6px 8px", minWidth: 160 }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ background: "#0b1220", border: "1px solid #334155", borderRadius: 16, padding: "2px 8px", color: "#fbbf24", fontWeight: 800 }}>
                  K: {team.players.reduce((s,p)=>s+(p.kills||0),0)}
                </div>
                <div style={{ borderRadius: 8, padding: "4px 8px", fontWeight: 700, background: team.eliminated ? "#3f1d1d" : "#064e3b", color: team.eliminated ? "#fecaca" : "#a7f3d0" }}>
                  {team.eliminated ? `#${team.position ?? "-"}` : "ALIVE"}
                </div>
              </div>
            </div>

            {/* players */}
            <div style={{ padding: "8px 10px 2px", display: "flex", flexDirection: "column", gap: 6 }}>
              {team.players.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#1f2937", border: "1px solid #334155", borderRadius: 8, padding: 6 }}>
                  <input
                    value={p.name}
                    onChange={(e) => updatePlayer(team.id, i, { name: e.target.value })}
                    style={{ background: "transparent", border: "1px solid #334155", borderRadius: 6, color: "#e5e7eb", padding: "6px 8px", minWidth: 160 }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1", fontSize: 12 }}>
                    <input type="checkbox" checked={!!p.knocked} onChange={(e)=>setKnock(team.id, i, e.target.checked)} />
                    <span>KNOCK</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#cbd5e1", fontSize: 12 }}>
                    <input type="checkbox" checked={!p.alive} onChange={(e)=>setElim(team.id, i, e.target.checked)} />
                    <span>ELIM</span>
                  </label>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                    <button style={btnMini()} onClick={()=>bumpKills(team.id, i, -1)}>–</button>
                    <div style={{ minWidth: 26, textAlign: "center", fontWeight: 800 }}>{p.kills}</div>
                    <button style={btnMini()} onClick={()=>bumpKills(team.id, i, +1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* position bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 12px" }}>
              <span>Update Position</span>
              <select
                value={team.position || ""}
                onChange={(e)=> manualElimAndPosition(team.id, Number(e.target.value))}
                style={{ background: "#1f2937", border: "1px solid #334155", color: "#e5e7eb", borderRadius: 6, padding: 6 }}
              >
                <option value="">—</option>
                {Array.from({ length: 25 }, (_, n) => n + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button style={btn("#0b1220","#e5e7eb","#334155")} onClick={()=>removeTeam(team.id)}>Remove Team</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ color, label, sub }) {
  return (
    <div style={{ background: "#111827", borderRadius: 8, padding: "6px 10px", minWidth: 100, textAlign: "center", outline: `1px solid ${color}` }}>
      <div style={{ fontWeight: 800, color }}>{label}</div>
      <div style={{ fontSize: 11, color: "#94a3b8" }}>{sub}</div>
    </div>
  );
}

function AddTeamBar({ onAdd, count }) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("");
  const [file, setFile] = useState(null);

  return (
    <div style={{ background: "#111827", borderRadius: 10, padding: 10, display: "flex", alignItems: "center", gap: 12, margin: "10px 0" }}>
      <input placeholder="Search… (not wired)" style={inp()} />
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        <input placeholder="Team name" value={name} onChange={(e)=>setName(e.target.value)} style={inp()} />
        <input placeholder="Slot #" value={slot} onChange={(e)=>setSlot(e.target.value)} style={{ ...inp(), width: 90 }} />
        <input type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] || null)} style={{ color: "#cbd5e1" }} />
        <button onClick={()=>onAdd(name.trim(), slot, file)} style={btn("#22c55e","#06110a")}>+ Add Team</button>
        <div style={{ color: "#94a3b8" }}>{count}/25</div>
      </div>
    </div>
  );
}

/* ---- tiny style helpers (no external CSS needed to render) ---- */
function btn(bg, color="#fff", border="#0000"){ return { background:bg, color, border:`1px solid ${border}`, borderRadius:8, padding:"8px 10px", cursor:"pointer" }; }
function btnMini(){ return { background:"#0b1220", border:"1px solid #334155", color:"#e5e7eb", borderRadius:6, padding:"4px 8px", cursor:"pointer" }; }
function inp(){ return { background:"#1f2937", border:"1px solid #334155", color:"#e5e7eb", borderRadius:8, padding:8 }; }
function colorByIndex(i){ const p=["#7c3aed","#0ea5e9","#10b981","#f97316","#06b6d4","#a78bfa","#f59e0b","#22c55e"]; return p[i%p.length]; }
