import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Starfield from "./Starfield";
import Crawl from "./Crawl";
import Galaxy, { layoutGalaxy, GROUP_COLORS } from "./Galaxy";
import { DeathStar } from "./Art";
import "./App.css";

const WARP_MS = 5000;
const API = "http://localhost:8000/api";
const THEMES = { jedi: "Light Side", sith: "Dark Side", rebel: "Rebel Alliance" };
const FACTIONS = Object.keys(GROUP_COLORS);
const EMPTY = { q: "", user_id: "", faction: "", date_from: "", date_to: "" };

async function api(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null));
  const res = await fetch(`${API}${path}?${qs}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function Highlight({ text, q }) {
  const toks = q.match(/\w+/g) || [];
  if (!toks.length) return text;
  const parts = text.split(new RegExp(`\\b((?:${toks.join("|")})\\w*)`, "gi"));
  return parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));
}
const Snip = ({ text }) => text.split(/\[\[(.*?)\]\]/).map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p));

const fmt = (ts) => new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const Badge = ({ faction }) => <span className={`badge f-${faction}`}>{faction}</span>;

function Scene({ fireKey, charged }) {
  return (
    <div className="scene">
      <div className="deathstar-wrap"><DeathStar charged={charged} /></div>
      {fireKey > 0 && <div key={fireKey} className="beam" />}
    </div>
  );
}

function ChatPanel({ convId, q, aroundId, onClose }) {
  const [data, setData] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [offset, setOffset] = useState(0);
  const bodyRef = useRef(null);
  const focusRef = useRef(null);
  const keep = useRef(null);
  const url = `/conversations/${convId}/messages`;

  useEffect(() => {
    let stale = false;
    setData(null); setMsgs([]);
    api(url, aroundId ? { around: aroundId, limit: 60 } : { offset: -1, limit: 60 }).then((d) => {
      if (stale) return;
      setData(d); setMsgs(d.messages); setOffset(d.offset);
      requestAnimationFrame(() => {
        if (focusRef.current) focusRef.current.scrollIntoView({ block: "center" });
        else if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      });
    });
    return () => { stale = true; };
  }, [convId, aroundId]);

  useLayoutEffect(() => {
    if (keep.current != null && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight - keep.current;
      keep.current = null;
    }
  }, [msgs]);

  const older = async () => {
    const n = Math.max(0, offset - 60);
    const d = await api(url, { offset: n, limit: offset - n });
    keep.current = bodyRef.current.scrollHeight;
    setMsgs((m) => [...d.messages, ...m]); setOffset(n);
  };
  const newer = async () => {
    const d = await api(url, { offset: offset + msgs.length, limit: 60 });
    setMsgs((m) => [...m, ...d.messages]);
  };

  return (
    <>
      <div className="drawer-head">
        <div>
          <h3>{data ? data.conversation.title : "Establishing link..."}</h3>
          {data && <div className="chips">{data.conversation.participants.map((p) => (
            <span key={p.id} className="chip">{p.name} <Badge faction={p.faction} /></span>
          ))}</div>}
        </div>
        <button className="x" onClick={onClose} title="Zoom out (Esc)">×</button>
      </div>
      <div className="drawer-body" ref={bodyRef}>
        {offset > 0 && <button className="more" onClick={older}>▲ Earlier ({offset})</button>}
        {msgs.map((m) => (
          <div key={m.id} ref={m.id === aroundId ? focusRef : null}
               className={`hmsg ${m.id === aroundId ? "focus" : ""}`}>
            <div className="mhead">
              <span className="who">{m.user}</span><Badge faction={m.faction} />
              <span className="time">{fmt(m.ts)}</span>
            </div>
            <p><Highlight text={m.text} q={q} /></p>
          </div>
        ))}
        {data && offset + msgs.length < data.total && (
          <button className="more" onClick={newer}>▼ Later ({data.total - offset - msgs.length})</button>
        )}
      </div>
    </>
  );
}

export default function App() {
  const [phase, setPhase] = useState(sessionStorage.getItem("seen") ? "ready" : "crawl");
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "jedi");
  const [filters, setFilters] = useState(EMPTY);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [convs, setConvs] = useState([]);
  const [hits, setHits] = useState(null);
  const [results, setResults] = useState({ total: 0, items: [] });
  const [selected, setSelected] = useState(null);
  const [aroundId, setAroundId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [hidden, setHidden] = useState(new Set());
  const [fireKey, setFireKey] = useState(0);
  const [error, setError] = useState("");
  const galaxy = useRef(null);

  const f = useDebounced(filters);
  const searching = !!(f.q.trim() || f.user_id || f.faction || f.date_from || f.date_to);
  const graph = useMemo(() => layoutGalaxy(convs), [convs]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    Promise.all([api("/stats"), api("/users"), api("/galaxy")])
      .then(([s, u, g]) => { setStats(s); setUsers(u); setConvs(g); })
      .catch(() => setError("Cannot reach the Holonet API on port 8000."));
  }, []);

  useEffect(() => {
    if (!searching) { setHits(null); setResults({ total: 0, items: [] }); setShowResults(false); return; }
    let stale = false;
    Promise.all([api("/search/hits", f), api("/search", { ...f, limit: 30, offset: 0 })]).then(([h, r]) => {
      if (stale) return;
      setHits(new Map(h.hits.map((x) => [x.id, x.n])));
      setResults({ total: r.total, items: r.results });
      setShowResults(true);
    });
    return () => { stale = true; };
  }, [f, searching]);

  const loadMore = async () => {
    const r = await api("/search", { ...f, limit: 30, offset: results.items.length });
    setResults((p) => ({ total: r.total, items: [...p.items, ...r.results] }));
  };

  const dive = (id, msgId = null) => {
    setAroundId(msgId); setSelected(id); setChatOpen(false);
    galaxy.current?.flyTo(id);
  };
  const closeChat = () => { setChatOpen(false); galaxy.current?.flyHome(); };

  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape" || phase !== "ready") return;
      if (chatOpen) closeChat(); else setShowResults(false);
    };
    addEventListener("keydown", h);
    return () => removeEventListener("keydown", h);
  }, [phase, chatOpen]);

  const finishIntro = () => {
    sessionStorage.setItem("seen", "1");
    setPhase((p) => {
      if (p !== "crawl") return p;
      setTimeout(() => setPhase("ready"), WARP_MS);
      return "warp";
    });
  };

  const set = (k) => (e) => setFilters((p) => ({ ...p, [k]: e.target.value }));
  const toggleGroup = (g) => setHidden((p) => { const n = new Set(p); n.has(g) ? n.delete(g) : n.add(g); return n; });
  const maxDay = Math.max(1, ...(stats?.per_day || []).map((d) => d.count));
  const groupCounts = graph.centers;

  return (
    <div className="app" data-phase={phase}>
      <Starfield warp={phase === "warp"} />
      <Scene fireKey={fireKey} charged={searching} />

      <Galaxy ref={galaxy} graph={graph} hits={hits} hidden={hidden} theme={theme}
              active={phase === "ready"} selectedId={selected} locked={selected != null}
              onPick={(id) => dive(id)} onArrive={() => setChatOpen(true)}
              onHome={() => setSelected(null)} />

      {phase === "crawl" && <Crawl stats={stats} onDone={finishIntro} />}

      {phase !== "crawl" && (
        <div className={`overlay ${phase === "warp" ? "hidden" : "show"} ${selected != null ? "diving" : ""}`}>
          <header className="hud">
            <h1 className="logo">HOLONET</h1>
            <div className="readouts">
              <div className="readout"><b>{stats?.messages ?? "–"}</b><span>Transmissions</span></div>
              <div className="readout"><b>{stats?.conversations ?? "–"}</b><span>Stars</span></div>
              <div className="readout"><b>{stats?.users ?? "–"}</b><span>Operatives</span></div>
              <div className="spark" title="Messages per day, last 14 days">
                {(stats?.per_day || []).map((d) => (
                  <i key={d.day} style={{ height: `${(d.count / maxDay) * 100}%` }} />
                ))}
              </div>
            </div>
            <div className="hud-actions">
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => { sessionStorage.removeItem("seen"); setPhase("crawl"); }}>
                Replay intro
              </button>
            </div>
          </header>

          {error && <div className="error">{error}</div>}

          <section className="targeting">
            <span className="tlabel">TARGETING</span>
            <input className="grow" placeholder="Scan all transmissions... (Enter fires the superlaser)"
                   value={filters.q} onChange={set("q")}
                   onKeyDown={(e) => e.key === "Enter" && setFireKey((k) => k + 1)} />
            <select value={filters.user_id} onChange={set("user_id")}>
              <option value="">All operatives</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={filters.faction} onChange={set("faction")}>
              <option value="">All factions</option>
              {FACTIONS.map((x) => <option key={x}>{x}</option>)}
            </select>
            <input type="date" value={filters.date_from} onChange={set("date_from")} />
            <input type="date" value={filters.date_to} onChange={set("date_to")} />
            <button onClick={() => setFilters(EMPTY)}>Clear</button>
            {searching && (
              <button className="accent" onClick={() => setShowResults((s) => !s)}>
                {results.total} hits
              </button>
            )}
          </section>

          <div className="legend">
            {FACTIONS.map((g) => (
              <button key={g} className={hidden.has(g) ? "off" : ""} onClick={() => toggleGroup(g)}>
                <i style={{ background: GROUP_COLORS[g] }} />
                {g} <small>{groupCounts[g]?.count ?? 0}</small>
              </button>
            ))}
          </div>

          <div className="zoomctl">
            <button onClick={() => galaxy.current?.zoomBy(1.6)}>+</button>
            <button onClick={() => galaxy.current?.zoomBy(1 / 1.6)}>−</button>
            <button onClick={() => galaxy.current?.reset()}>⟲</button>
          </div>

          <p className="hint">Scroll to zoom · drag to pan · click a star to dive in · Esc to zoom out</p>
        </div>
      )}

      <aside className={`drawer left holo ${showResults && searching && selected == null && phase === "ready" ? "open" : ""}`}>
        <div className="drawer-head">
          <h3>Intercepted ({results.total})</h3>
          <button className="x" onClick={() => setShowResults(false)}>×</button>
        </div>
        <div className="drawer-body">
          {results.items.length === 0 && <p className="time">No signals in this sector.</p>}
          {results.items.map((r) => (
            <button key={r.id} className="hmsg result" onClick={() => dive(r.conversation_id, r.id)}>
              <div className="mhead">
                <span className="who">{r.user}</span><Badge faction={r.faction} />
              </div>
              <p>{f.q.trim() ? <Snip text={r.snip} /> : r.snip}</p>
              <span className="time">{r.conversation} · {fmt(r.ts)}</span>
            </button>
          ))}
          {results.items.length < results.total && (
            <button className="more" onClick={loadMore}>
              Load more ({results.total - results.items.length})
            </button>
          )}
        </div>
      </aside>

      <aside className={`drawer wide holo ${chatOpen && phase === "ready" ? "open" : ""}`}>
        {chatOpen && selected != null && (
          <ChatPanel convId={selected} q={f.q} aroundId={aroundId} onClose={closeChat} />
        )}
      </aside>
    </div>
  );
}
