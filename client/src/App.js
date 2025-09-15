import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const MAX_TEAMS = 25;
const SQUAD_SIZE = 4;

export default function App() {
  const [teams, setTeams] = useState([]);            // you add teams
  const [matchStatus, setMatchStatus] = useState("waiting");
  const [elapsed, setElapsed] = useState(0);
  const [matchTimer, setMatchTimer] = useState("00:00");
  const [events, setEvents] = useState([]);          // goes to JSON for vMix

  // ===== Timer =====
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

  // ===== Derived stats + Sync =====
  const playersAlive = teams.reduce((sum, t) => sum + t.players.filter(p => p.alive).length, 0);
  const teamsAlive = teams.filter(t => t.players.some(p => p.alive)).length;
  const totalPlayers = teams.length * SQUAD_SIZE;
  const totalKills = teams.reduce((sum, t) => sum + t.players.reduce((s, p) => s + (p.kills || 0), 0), 0);

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

  // ===== Controls =====
  const startMatch = () => { setElapsed(0); setMatchStatus("live"); };
  const endMatch = async () => {
    setMatchStatus("ended");
    await axios.post(`${API_URL}/end-match`, { teams }).catch(() => {});
  };

  // ===== Team management =====
  const addTeam = (team_name, slot, logo) => {
    if (teams.length >= MAX_TEAMS) return alert("Max 25 teams.");
    const newTeam = {
      id: Date.now(),
      team_name: team_name || `Team ${teams.length + 1}`,
      slot: slot || teams.length + 1,
      logo: logo || "",
      position: null,
      eliminated: false,
      players: Array.from({ length: SQUAD_SIZE }, (_, j) => ({
        name: `PLAYER ${j + 1}`,
        kills: 0,
        achievement: null,   // backend only
        alive: true,
        knocked: false,
        survival_time: "00:00"
      }))
    };
    setTeams(prev => [...prev, newTeam]);
  };

  const removeTeam = (id) => setTeams(prev => prev.filter(t => t.id !== id));

  const updateTeam = (id, patch) =>
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const updatePlayer = (teamId, idx, patch) =>
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, players: t.players.map((p, i) => i === idx ? { ...p, ...patch } : p) } : t
    ));

  // ===== Kills (visible in UI) =====
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

  // ===== Knock / Elim =====
  const setKnock = (teamId, idx, value) => {
    updatePlayer(teamId, idx, { knocked: value });
  };

  const setElim = (teamId, idx, value) => {
    // value true means eliminated
    if (!value) {
      updatePlayer(teamId, idx, { alive: true }); // un-elim (rare)
      return;
    }
    setTeams(prev => {
      const next = prev.map(t => {
        if (t.id !== teamId) return t;
        const players = t.players.map((p, i) =>
          i === idx ? { ...p, alive: false, knocked: false, survival_time: matchTimer } : p
        );
        let patch = {};
        // if all dead now → auto team elimination + position
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
        ? {
            ...t,
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

  // ===== Logo upload helper =====
  const toDataURL = (file, cb) => {
    if (!file) return cb("");
    const r = new FileReader();
    r.onload = e => cb(e.target.result);
    r.readAsDataURL(file);
  };

  return (
    <div className="ui-root">
      {/* Header */}
      <div className="topbar">
        <div>
          <div className="match-title">MATCH 1</div>
          <div className="match-sub">GRAND FINALS • customize here</div>
        </div>
        <div className="badges">
          <Badge color="green" label={`${teamsAlive}`} sub="ALIVE TEAMS" />
          <Badge color="orange" label={`${totalKills}`} sub="KILL COUNT" />
          <Badge color="purple" label={`${playersAlive}/${totalPlayers || 0}`} sub="PLAYERS" />
        </div>
        <div className="actions">
          <button className="btn btn-live" disabled={matchStatus === "live"}>Currently Live</button>
          <button className="btn btn-primary" onClick={startMatch}>Start Match Timer</button>
          <div className="timer">⏱ {matchTimer}</div>
          <button className="btn" onClick={endMatch}>End</button>
        </div>
      </div>

      {/* Search + Add Team */}
      <AddTeamBar onAdd={(name, slot, file) => toDataURL(file, (logo) => addTeam(name, slot, logo))} count={teams.length} />

      {/* Grid */}
      <div className="grid">
        {teams.map((team, idx) => (
          <div key={team.id} className="card" style={{ borderTopColor: colorByIndex(idx) }}>
            {/* Card header */}
            <div className="card-head">
              <div className="left">
                <div className="slot">#{team.slot}</div>
                <input
                  className="team-name-input"
                  value={team.team_name}
                  onChange={(e) => updateTeam(team.id, { team_name: e.target.value })}
                />
              </div>
              <div className="right">
                <div className="kbadge">K: {team.players.reduce((s,p)=>s+(p.kills||0),0)}</div>
                <div className={`pill ${team.eliminated ? "pill-elim" : "pill-alive"}`}>
                  {team.eliminated ? `#${team.position ?? "-"}` : "ALIVE"}
                </div>
              </div>
            </div>

            {/* Players table */}
            <div className="rows">
              {team.players.map((p, i) => (
                <div key={i} className="row">
                  <div className="pname">
                    <input
                      value={p.name}
                      onChange={(e) => updatePlayer(team.id, i, { name: e.target.value })}
                    />
                  </div>

                  <label className="chk">
                    <input type="checkbox" checked={!!p.knocked} onChange={(e)=>setKnock(team.id, i, e.target.checked)} />
                    <span>KNOCK</span>
                  </label>

                  <label className="chk">
                    <input type="checkbox" checked={!p.alive} onChange={(e)=>setElim(team.id, i, e.target.checked)} />
                    <span>ELIM</span>
                  </label>

                  <div className="kills">
                    <button className="btn-mini" onClick={()=>bumpKills(team.id, i, -1)}>–</button>
                    <div className="kills-num">{p.kills}</div>
                    <button className="btn-mini" onClick={()=>bumpKills(team.id, i, +1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Position control */}
            <div className="posbar">
              <span>Update Position</span>
              <select
                value={team.position || ""}
                onChange={(e)=> manualElimAndPosition(team.id, Number(e.target.value))}
              >
                <option value="">—</option>
                {Array.from({ length: 25 }, (_, n) => n + 1).map(n=>(
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>

              <button className="btn ghost" onClick={()=>removeTeam(team.id)}>Remove Team</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- components ---------- */

function Badge({ color, label, sub }) {
  return (
    <div className={`badge badge-${color}`}>
      <div className="b-main">{label}</div>
      <div className="b-sub">{sub}</div>
    </div>
  );
}

function AddTeamBar({ onAdd, count }) {
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("");
  const [file, setFile] = useState(null);

  return (
    <div className="addbar">
      <div className="add-left">
        <input placeholder="Search… (not wired)" className="search" />
      </div>
      <div className="add-right">
        <input
          className="inp"
          placeholder="Team name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />
        <input
          className="inp short"
          placeholder="Slot #"
          value={slot}
          onChange={(e)=>setSlot(e.target.value)}
        />
        <input className="inp" type="file" accept="image/*" onChange={(e)=>setFile(e.target.files?.[0] || null)} />
        <button className="btn btn-primary" onClick={()=>onAdd(name.trim(), Number(slot) || undefined, file)}>+ Add Team</button>
        <div className="count">{count}/25</div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function colorByIndex(i){
  const palette = ["#7c3aed","#0ea5e9","#10b981","#f97316","#06b6d4","#a78bfa","#f59e0b","#22c55e"];
  return palette[i % palette.length];
}
