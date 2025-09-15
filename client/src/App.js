import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const MAX_TEAMS = 25;
const SQUAD_SIZE = 4;

export default function App() {
  const [teams, setTeams] = useState([]);
  const [matchStatus, setMatchStatus] = useState("waiting");
  const [matchTimer, setMatchTimer] = useState("00:00");
  const [elapsed, setElapsed] = useState(0);
  const [events, setEvents] = useState([]);
  const [intervalId, setIntervalId] = useState(null);

  // Initialize teams
  useEffect(() => {
    const init = [];
    for (let i = 0; i < MAX_TEAMS; i++) {
      init.push({
        id: i + 1,
        team_name: `Team ${i + 1}`,
        logo: "",
        position: null,
        eliminated: false,
        notes: "",
        players: Array.from({ length: SQUAD_SIZE }, (_, j) => ({
          name: `Player ${j + 1}`,
          kills: 0,
          alive: true,
          survival_time: "00:00",
          achievement: null
        }))
      });
    }
    setTeams(init);
  }, []);

  // Match timer logic
  useEffect(() => {
    if (matchStatus === "live") {
      const id = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
      setIntervalId(id);
      return () => clearInterval(id);
    }
  }, [matchStatus]);

  useEffect(() => {
    const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    setMatchTimer(`${mins}:${secs}`);
  }, [elapsed]);

  // Sync with backend
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
      lobby_stats: {
        players_alive: playersAlive,
        teams_alive: teamsAlive,
        total_kills: totalKills
      },
      recent_events: events,
      teams
    });
  };

  useEffect(() => {
    if (matchStatus !== "waiting") syncData();
  }, [teams, events, matchTimer]);

  // Controls
  const startMatch = () => {
    setElapsed(0);
    setMatchStatus("live");
  };

  const endMatch = async () => {
    setMatchStatus("ended");
    clearInterval(intervalId);
    await axios.post(`${API_URL}/end-match`, { teams });
  };

  const resetMatch = () => {
    window.location.reload();
  };

  // Update helpers
  const updatePlayer = (teamId, playerIdx, patch) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              players: t.players.map((p, i) =>
                i === playerIdx ? { ...p, ...patch } : p
              )
            }
          : t
      )
    );
  };

  const updateTeam = (teamId, patch) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, ...patch } : t))
    );
  };

  // Kill & achievement logic
  const addKill = (teamId, playerIdx) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              players: t.players.map((p, i) => {
                if (i === playerIdx) {
                  const kills = p.kills + 1;
                  let achievement = p.achievement;
                  if (kills === 3) achievement = "DOMINATION";
                  if (kills === 5) achievement = "RAMPAGE";
                  if (kills === 7) achievement = "UNSTOPPABLE";

                  if (achievement) {
                    const msg = `${p.name} (${t.team_name}) achieved ${achievement} with ${kills} kills!`;
                    setEvents((prevEv) => [
                      {
                        type: "achievement",
                        message: msg,
                        team: t.team_name,
                        player: p.name,
                        kills,
                        achievement
                      },
                      ...prevEv
                    ]);
                  }
                  return { ...p, kills, achievement };
                }
                return p;
              })
            }
          : t
      )
    );
  };

  // Elimination logic
  const eliminateTeam = (teamId, position) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              eliminated: true,
              position,
              players: t.players.map((p) => ({
                ...p,
                alive: false,
                survival_time: matchTimer
              }))
            }
          : t
      )
    );
    const team = teams.find((t) => t.id === teamId);
    setEvents((prevEv) => [
      {
        type: "elimination",
        message: `${team.team_name} Eliminated – ${position}th Place`,
        team: team.team_name,
        position
      },
      ...prevEv
    ]);
  };

  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl font-bold mb-4">BGMI Tournament Dashboard</h1>

      {/* Controls */}
      <div className="flex gap-2 mb-6">
        <button onClick={startMatch} className="bg-green-500 px-4 py-2 text-white rounded">
          Start Match
        </button>
        <button onClick={endMatch} className="bg-red-500 px-4 py-2 text-white rounded">
          End Match
        </button>
        <button onClick={resetMatch} className="bg-gray-500 px-4 py-2 text-white rounded">
          Reset
        </button>
        <div className="ml-auto font-bold">Match Time: {matchTimer}</div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className={`border rounded p-3 ${
              team.eliminated ? "bg-red-100" : "bg-white"
            }`}
          >
            <input
              className="font-bold mb-2 w-full"
              value={team.team_name}
              onChange={(e) => updateTeam(team.id, { team_name: e.target.value })}
            />

            {/* Players */}
            {team.players.map((p, idx) => (
              <div key={idx} className="flex gap-2 items-center mb-1">
                <input
                  className="flex-1 border px-2"
                  value={p.name}
                  onChange={(e) => updatePlayer(team.id, idx, { name: e.target.value })}
                />
                <span>{p.alive ? "✅ Alive" : "☠️ Dead"}</span>
                <button
                  onClick={() =>
                    updatePlayer(team.id, idx, {
                      alive: !p.alive,
                      survival_time: matchTimer
                    })
                  }
                  className="px-2 bg-yellow-300 rounded"
                >
                  Toggle
                </button>
                <button
                  onClick={() => addKill(team.id, idx)}
                  className="px-2 bg-blue-400 text-white rounded"
                >
                  + Kill
                </button>
                <span>Kills: {p.kills}</span>
                {p.achievement && (
                  <span className="ml-2 font-bold text-purple-600">
                    {p.achievement}
                  </span>
                )}
              </div>
            ))}

            {/* Eliminate team */}
            {!team.eliminated && (
              <div className="mt-2">
                <label>Eliminate as Position: </label>
                <select
                  onChange={(e) =>
                    eliminateTeam(team.id, Number(e.target.value))
                  }
                  defaultValue=""
                >
                  <option value="">-- Select --</option>
                  {Array.from({ length: MAX_TEAMS }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {team.eliminated && (
              <div className="mt-2 font-bold">Position: {team.position}</div>
            )}
          </div>
        ))}
      </div>

      {/* Event Popups */}
      <div className="fixed bottom-4 right-4 w-80">
        {events.slice(0, 3).map((ev, i) => (
          <div key={i} className="bg-black text-white p-2 mb-2 rounded shadow">
            {ev.message}
          </div>
        ))}
      </div>
    </div>
  );
}

