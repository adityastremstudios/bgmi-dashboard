import React, { useEffect, useState } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const MAX_TEAMS = 25;
const SQUAD_SIZE = 4;

export default function App() {
  const [teams, setTeams] = useState([]);            // start empty
  const [matchStatus, setMatchStatus] = useState("waiting");
  const [elapsed, setElapsed] = useState(0);
  const [matchTimer, setMatchTimer] = useState("00:00");
  const [events, setEvents] = useState([]);          // only for backend/vMix, not shown
  const [activeTab, setActiveTab] = useState("Score");

  // ---------- Timer ----------
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

  // ---------- Derived stats ----------
  const playersAlive = teams.reduce((sum, t) => sum + t.players.filter(p => p.alive).length, 0);
  const teamsAlive   = teams.filter(t => t.players.some(p => p.alive)).length;
  const totalPlayers = teams.length * SQUAD_SIZE;
  const totalKills   = teams.reduce((sum, t) => sum + t.players.reduce((s,p)=>s+(p.kills||0),0), 0);

  // ---------- Sync to backend ----------
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

  // ---------- Controls ----------
  const startMatch = () => { setElapsed(0); setMatchStatus("live"); };
  const endMatch   = async () => {
    setMatchStatus("ended");
    await axios.post(`${API_URL}/end-match`, { teams }).catch(() => {});
  };

  // ---------- Team helpers ----------
  const addTeam = (team_name, slot) => {
    if (teams.length >= MAX_TEAMS) return alert("Max 25 teams.");
    const t = {
      id: Date.now() + Math.random(),
      team_name: team_name || `Team ${teams.length + 1}`,
      slot: slot || teams.length + 1,
      eliminated: false,
      position: null,
      players: Array.from({ length: SQUAD_SIZE }, (_, j) => ({
        name: `PLAYER ${j + 1}`,
        kills: 0,
        achievement: null, // backend only
        knocked: false,
        alive: true,
        survival_time: "00:00"
      }))
    };
    setTeams(prev => [...prev, t]);
  };

  const seedTeams = () => {
    if (teams.length) return;
    ["AK MENACE","4MV","2A","A1","4MERICAL VIBES","4 THRIVES"]
      .slice(0, 6)
      .forEach((name, i) => addTeam(name, i+1));
  };

  const updateTeam   = (id, patch) =>
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));

  const removeTeam   = (id) => setTeams(prev => prev.filter(t => t.id !== id));

  const updatePlayer = (teamId, idx, patch) =>
    setTeams(prev => prev.map(t =>
      t.id === teamId ? { ...t, players: t.players.map((p, i) => i === idx ? { ...p, ...patch } : p) } : t
    ));

  // ---------- Kills (UI visible) ----------
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

  // ---------- Knock / Elim ----------
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

  // ---------- UI ----------
  return (
    <div style={s.root}>
      {/* Tabs */}
      <div style={s.tabs}>
        {["Details","Teams","Score","Widgets"].map(tab => (
          <button key={tab}
            onClick={()=>setActiveTab(tab)}
            style={{...s.tab, ...(activeTab===tab?s.tabActive:{} )}}>
            {tab}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={s.topbar}>
        <div>
          <div style={s.title}>MATCH 1</div>
          <div style={s.sub}>GRAND FINALS — customize this</div>
        </div>
        <div style={s.badges}>
          <Badge color="#22c55e" label={`${teamsAlive}`} sub="TEAMS ALIVE" />
          <Badge color="#f59e0b" label={`${totalKills}`} sub="KILL COUNT" />
          <Badge color="#a855f7" label={`${playersAlive}/${totalPlayers||0}`} sub="PLAYERS" />
        </div>
        <div style={s.actions}>
          <button className="btn btn-primary" onClick={startMatch}>Start</button>
          <div className="timer">⏱ {matchTimer}</div>
          <button className="btn" onClick={resetTimer}>Reset</button>
          <button className="btn danger" onClick={endMatch}>End & Push to Sheets</button>
        </div>
      </div>

      {/* Quick seed button (remove later) */}
      <div style={{marginBottom:10}}>
        <button onClick={seedTeams} style={btn("#0ea5e9")}>+ Add 6 Sample Teams (for testing)</button>
      </div>

      {/* Score Grid */}
      {activeTab==="Score" && (
        <div style={s.grid}>
          {teams.map((team, idx) => (
            <div key={team.id} style={{...s.card, borderTop: `4px solid ${colorByIndex(idx)}`}}>
              {/* Card head */}
              <div style={s.cardHead}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={s.slot}>#{team.slot}</div>
                  <input
                    value={team.team_name}
                    onChange={(e)=>updateTeam(team.id,{team_name:e.target.value})}
                    style={s.teamInput}
                  />
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={s.kBadge}>K: {team.players.reduce((s,p)=>s+(p.kills||0),0)}</div>
                  <div style={{
                    ...s.pill,
                    background: team.eliminated ? "#3f1d1d" : "#064e3b",
                    color: team.eliminated ? "#fecaca" : "#a7f3d0"
                  }}>
                    {team.eliminated ? `#${team.position ?? "-"}` : "ALIVE"}
                  </div>
                </div>
              </div>

              {/* Players */}
              <div style={s.rows}>
                {team.players.map((p, i) => (
                  <div key={i} style={s.row}>
                    <input value={p.name}
                      onChange={(e)=>updatePlayer(team.id,i,{name:e.target.value})}
                      style={s.playerInput}/>
                    <label style={s.chk}>
                      <input type="checkbox" checked={!!p.knocked}
                        onChange={(e)=>setKnock(team.id,i,e.target.checked)} />
                      <span>KNOCK</span>
                    </label>
                    <label style={s.chk}>
                      <input type="checkbox" checked={!p.alive}
                        onChange={(e)=>setElim(team.id,i,e.target.checked)} />
                      <span>ELIM</span>
                    </label>
                    <div style={s.kills}>
                      <button onClick={()=>bumpKills(team.id,i,-1)} style={btnMini()}>–</button>
                      <div style={s.killsNum}>{p.kills}</div>
                      <button onClick={()=>bumpKills(team.id,i, +1)} style={btnMini()}>+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Position */}
              <div style={s.posbar}>
                <span>Update Position</span>
                <select
                  value={team.position || ""}
                  onChange={(e)=>manualElimAndPosition(team.id, Number(e.target.value))}
                  style={s.select}
                >
                  <option value="">—</option>
                  {Array.from({length:25},(_,n)=>n+1).map(n=>(
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <button onClick={()=>removeTeam(team.id)} style={btn("#0b1220","#e5e7eb","#334155")}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- tiny stateless comps ---------- */
function Badge({ color, label, sub }) {
  return (
    <div style={{background:"#111827",borderRadius:8,padding:"6px 10px",minWidth:100,textAlign:"center",outline:`1px solid ${color}`}}>
      <div style={{fontWeight:800,color}}>{label}</div>
      <div style={{fontSize:11,color:"#94a3b8"}}>{sub}</div>
    </div>
  );
}

/* ---------- styles & helpers ---------- */
const s = {
  root:{padding:16,background:"#0f172a",color:"#e5e7eb",minHeight:"100vh",fontFamily:"Inter, system-ui, Arial, sans-serif"},
  tabs:{display:"flex",gap:6,marginBottom:10},
  tab:{background:"#111827",border:"1px solid #334155",color:"#cbd5e1",borderRadius:8,padding:"8px 10px",cursor:"pointer"},
  tabActive:{boxShadow:"inset 0 0 0 2px #6366f1",color:"#fff"},
  topbar:{display:"flex",alignItems:"center",gap:12,marginBottom:12},
  title:{fontSize:26,fontWeight:800},
  sub:{color:"#94a3b8"},
  badges:{display:"flex",gap:8,marginLeft:16},
  actions:{display:"flex",gap:8,alignItems:"center",marginLeft:"auto"},
  grid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(360px,1fr))",gap:12},
  card:{background:"#111827",borderRadius:12},
  cardHead:{display:"flex",justifyContent:"space-between",padding:"10px 10px 6px"},
  slot:{background:"#0b1220",border:"1px solid #334155",padding:"2px 6px",borderRadius:6,fontWeight:700,color:"#93c5fd"},
  teamInput:{background:"transparent",border:"1px solid #334155",borderRadius:6,color:"#e5e7eb",padding:"6px 8px",minWidth:160},
  kBadge:{background:"#0b1220",border:"1px solid #334155",borderRadius:16,padding:"2px 8px",color:"#fbbf24",fontWeight:800},
  pill:{borderRadius:8,padding:"4px 8px",fontWeight:700},
  rows:{padding:"8px 10px 2px",display:"flex",flexDirection:"column",gap:6},
  row:{display:"flex",alignItems:"center",gap:10,background:"#1f2937",border:"1px solid #334155",borderRadius:8,padding:6},
  playerInput:{background:"transparent",border:"1px solid #334155",borderRadius:6,color:"#e5e7eb",padding:"6px 8px",minWidth:160},
  chk:{display:"flex",alignItems:"center",gap:6,color:"#cbd5e1",fontSize:12},
  kills:{marginLeft:"auto",display:"flex",alignItems:"center",gap:6},
  killsNum:{minWidth:26,textAlign:"center",fontWeight:800},
  posbar:{display:"flex",alignItems:"center",gap:8,padding:"8px 10px 12px"},
  select:{background:"#1f2937",border:"1px solid #334155",color:"#e5e7eb",borderRadius:6,padding:6}
};

function btn(bg,color="#fff",border="#0000"){ return {background:bg,color,border:`1px solid ${border}`,borderRadius:8,padding:"8px 10px",cursor:"pointer"}; }
function btnMini(){ return {background:"#0b1220",border:"1px solid #334155",color:"#e5e7eb",borderRadius:6,padding:"4px 8px",cursor:"pointer"}; }
function colorByIndex(i){ const p=["#7c3aed","#0ea5e9","#10b981","#f97316","#06b6d4","#a78bfa","#f59e0b","#22c55e"]; return p[i%p.length]; }
