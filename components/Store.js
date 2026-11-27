"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DAY, dayKey, schedule } from "@/lib/srs";
import { pointsFor } from "@/lib/sentences";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

async function post(url, body, method = "POST") {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (r.status === 401 && !url.startsWith("/api/auth/")) window.dispatchEvent(new Event("gv-logged-out"));
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}

export function StoreProvider({ children }) {
  const [auth, setAuth] = useState(null);   // { user } or { user: null, setup, signup, legacyCards }
  const [data, setData] = useState(null);   // { words, weeks }
  const [state, setState] = useState(null); // { settings, cards, quiz, log }
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(0);
  const stateRef = useRef(null);
  stateRef.current = state;

  const load = useCallback(async () => {
    try {
      const me = await fetch("/api/auth/me").then(r => r.json());
      if (me.error) throw new Error(me.error);
      setAuth(me);
      if (!me.user) { setData(null); setState(null); setError(null); return; }
      const [w, s] = await Promise.all([fetch("/api/words").then(r => r.json()), fetch("/api/state").then(r => r.json())]);
      if (w.error || s.error) throw new Error(w.error || s.error);
      setData(w); setState(s); setError(null);
    } catch (e) { setError("Can't reach the database. Is Docker running? (" + e.message + ")"); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // A save that comes back "please log in" (login expired) shows the login screen again
  useEffect(() => { const f = () => load(); window.addEventListener("gv-logged-out", f); return () => window.removeEventListener("gv-logged-out", f); }, [load]);

  const logout = useCallback(async () => { await post("/api/auth/logout", {}).catch(() => {}); await load(); }, [load]);

  const track = useCallback((p) => { setSaving(n => n + 1); p.catch(e => setError("Save failed: " + e.message)).finally(() => setSaving(n => n - 1)); }, []);

  const derived = useMemo(() => {
    if (!data || !state) return null;
    const byId = Object.fromEntries(data.words.map(w => [w.id, w]));
    const weekNums = Object.keys(data.weeks).map(Number).sort((a, b) => a - b);
    const maxWeek = weekNums.at(-1) || 1;
    const start = new Date(state.settings.startDate + "T00:00:00");
    const dateWeek = Math.max(1, Math.min(maxWeek, Math.floor((Date.now() - start) / (7 * DAY)) + 1));
    const curWeek = state.settings.weekOverride ? Math.min(maxWeek, state.settings.weekOverride) : dateWeek;
    return { byId, weekNums, maxWeek, dateWeek, curWeek };
  }, [data, state]);

  const grade = useCallback((id, g, pts = 0) => {
    const s = stateRef.current, day = dayKey();
    const isNew = !s.cards[id];
    const card = schedule(s.cards[id], g); card.reps = (card.reps || 0) + 1; card.last = Date.now();
    const ok = g > 0;
    const L = { rev: 0, nw: 0, ok: 0, bad: 0, quiz: 0, quizOk: 0, ...(s.log[day] || {}) };
    L.rev++; if (isNew) L.nw++; if (ok) L.ok++; else L.bad++; L.pts = (L.pts || 0) + pts;
    setState({ ...s, cards: { ...s.cards, [id]: card }, log: { ...s.log, [day]: L } });
    track(post("/api/review", { id, card, isNew, ok, day, pts }));
    return card;
  }, [track]);

  const quizResult = useCallback((id, kind, ok) => {
    const s = stateRef.current, day = dayKey();
    const q = { ...(s.quiz[id] || {}) }; const r = { 0: 0, 1: 0, ...(q[kind] || {}) }; r[ok ? 0 : 1]++; q[kind] = r;
    const L = { rev: 0, nw: 0, ok: 0, bad: 0, quiz: 0, quizOk: 0, ...(s.log[day] || {}) }; L.quiz++; if (ok) { L.quizOk++; L.pts = (L.pts || 0) + 2; }
    setState({ ...s, quiz: { ...s.quiz, [id]: q }, log: { ...s.log, [day]: L } });
    track(post("/api/quiz", { id, kind, ok, day }));
  }, [track]);

  // One sentence answer: p = its new schedule, level/run = the learner's adaptive level after it, own = answer marked right
  const sentenceResult = useCallback((s, result, p, { level, run, own } = {}) => {
    const st = stateRef.current, day = dayKey();
    const pts = pointsFor(s.lv, result);
    const L = { rev: 0, nw: 0, ok: 0, bad: 0, quiz: 0, quizOk: 0, ...(st.log[day] || {}) };
    L.sent = (L.sent || 0) + 1; if (result === "right") L.sentOk = (L.sentOk || 0) + 1; L.pts = (L.pts || 0) + pts;
    const prev = st.sent?.[s.id] || {};
    const mine = own ? [...new Set([...(prev.own || []), own])].slice(-10) : prev.own || [];
    setState({ ...st, sent: { ...(st.sent || {}), [s.id]: { ...p, own: mine } }, log: { ...st.log, [day]: L },
      settings: level ? { ...st.settings, sentLevel: level, sentRun: run || "" } : st.settings });
    track(post("/api/sentence", { id: s.id, result, p, day, level, run, own }));
  }, [track]);

  const updateSettings = useCallback((patch) => {
    const s = stateRef.current;
    setState({ ...s, settings: { ...s.settings, ...patch } });
    track(post("/api/settings", patch, "PUT"));
  }, [track]);

  const value = { auth, user: auth?.user || null, logout, data, state, derived, error, saving, reload: load, grade, quizResult, sentenceResult, updateSettings, post };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------- helpers used by pages ---------- */
export function totalPoints(state) { return Object.values(state.log).reduce((s, l) => s + (l.pts || 0), 0); }
export function wordStatus(state, id) {
  const c = state.cards[id];
  if (!c) return "new";
  if (c.s === "learn") return "learning";
  return c.ivl >= 21 ? "mature" : "learned";
}

export function scopeWords(scope, data, state, derived) {
  const c = derived.curWeek, W = data.words;
  if (scope === "cur") return W.filter(w => w.week === c);
  if (scope === "upto") return W.filter(w => w.week <= c);
  if (scope === "started") return W.filter(w => state.cards[w.id]);
  if (scope === "weak") return W.filter(w => { const q = state.quiz[w.id]; return q && Object.values(q).some(r => (r[1] || 0) > 0 && (r[1] || 0) >= (r[0] || 0) / 2); });
  if (scope.startsWith("w")) return W.filter(w => w.week === +scope.slice(1));
  return W;
}

// picks a quiz item, favouring words answered wrong before
export function pickWeighted(list, kind, quiz, avoidId) {
  if (!list.length) return null;
  const pool = [];
  list.forEach(w => { const r = quiz[w.id]?.[kind] || {}; const n = 1 + Math.min(4, Math.max(0, (r[1] || 0) * 2 - (r[0] || 0))); for (let i = 0; i < n; i++) pool.push(w); });
  for (let i = 0; i < 10; i++) { const w = pool[(Math.random() * pool.length) | 0]; if (w.id !== avoidId || list.length === 1) return w; }
  return pool[0];
}
