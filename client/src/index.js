/* Dark tournament UI */
:root{
  --bg:#0f172a;
  --panel:#111827;
  --panel-2:#1f2937;
  --muted:#94a3b8;
  --text:#e5e7eb;
  --green:#22c55e;
  --orange:#f59e0b;
  --purple:#a855f7;
  --red:#ef4444;
  --blue:#3b82f6;
}
html,body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,system-ui,Arial,sans-serif}

.ui-root{padding:16px}
.topbar{display:flex;align-items:center;gap:16px;margin-bottom:12px}
.match-title{font-size:28px;font-weight:800}
.match-sub{color:var(--muted);margin-top:2px}
.badges{display:flex;gap:8px;margin-left:16px}
.badge{background:var(--panel);border-radius:8px;padding:6px 10px;min-width:90px;text-align:center}
.badge .b-main{font-weight:800}
.badge .b-sub{font-size:11px;color:var(--muted)}
.badge-green{outline:1px solid #14532d}
.badge-orange{outline:1px solid #7c2d12}
.badge-purple{outline:1px solid #4c1d95}
.actions{display:flex;align-items:center;gap:8px;margin-left:auto}
.timer{font-weight:700;opacity:.9}
.btn{background:var(--panel-2);color:var(--text);border:none;border-radius:8px;padding:8px 10px;cursor:pointer}
.btn:hover{opacity:.95}
.btn-primary{background:var(--green);color:#06110a}
.btn-live{background:#ef476f;color:white}
.ghost{background:transparent;outline:1px solid #374151}

.addbar{background:var(--panel);border-radius:10px;padding:10px;display:flex;align-items:center;gap:12px;margin:10px 0}
.add-left{flex:1}
.add-right{display:flex;gap:8px;align-items:center}
.search,.inp{background:var(--panel-2);border:1px solid #374151;border-radius:8px;color:var(--text);padding:8px}
.inp.short{width:90px}
.count{color:var(--muted)}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:12px}
.card{background:var(--panel);border-radius:12px;border-top:4px solid #3b82f6}
.card-head{display:flex;align-items:center;justify-content:space-between;padding:10px 10px 6px}
.left{display:flex;gap:8px;align-items:center}
.slot{background:#0b1220;border:1px solid #334155;padding:2px 6px;border-radius:6px;font-weight:700;color:#93c5fd}
.team-name-input{background:transparent;border:1px solid #334155;border-radius:6px;color:var(--text);padding:6px 8px;min-width:160px}
.right{display:flex;gap:8px;align-items:center}
.kbadge{background:#0b1220;border:1px solid #334155;border-radius:16px;padding:2px 8px;color:#fbbf24;font-weight:800}
.pill{border-radius:8px;padding:4px 8px;font-weight:700}
.pill-alive{background:#064e3b;color:#a7f3d0}
.pill-elim{background:#3f1d1d;color:#fecaca}

.rows{padding:8px 10px 2px;display:flex;flex-direction:column;gap:6px}
.row{display:flex;align-items:center;gap:10px;background:var(--panel-2);border:1px solid #334155;border-radius:8px;padding:6px}
.pname input{background:transparent;border:1px solid #334155;border-radius:6px;color:var(--text);padding:6px 8px;min-width:160px}
.chk{display:flex;align-items:center;gap:6px;color:#cbd5e1;font-size:12px}
.kills{margin-left:auto;display:flex;align-items:center;gap:6px}
.btn-mini{background:#0b1220;border:1px solid #334155;color:#e5e7eb;border-radius:6px;padding:4px 8px;cursor:pointer}
.kills-num{min-width:26px;text-align:center;font-weight:800}

.posbar{display:flex;align-items:center;gap:8px;padding:8px 10px 12px}
.posbar select{background:var(--panel-2);border:1px solid #334155;color:var(--text);border-radius:6px;padding:6px}
