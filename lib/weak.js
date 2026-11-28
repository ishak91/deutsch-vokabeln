// The learner's weak spots: words and sentences missed most, recently. Used by the Progress page (list) and
// by the AI (to find patterns). Pure functions on the state the app already has, so client and server agree.
import { DAY } from "./srs.js";

const DRILL = { a: "article", p: "plural", v: "verb forms", d: "dictation" };

// words: [{w, score, misses: ["article", ...], wrong, right}] most-missed first
export function weakWords(state, byId, { days = 14, max = 15, now = Date.now() } = {}) {
  const out = [];
  const ids = new Set([...Object.keys(state.quiz || {}), ...Object.keys(state.cards || {})]);
  for (const id of ids) {
    const w = byId[id]; if (!w) continue;
    const c = state.cards?.[id], q = state.quiz?.[id] || {};
    let wrong = 0, right = 0;
    const misses = [];
    for (const [k, r] of Object.entries(q)) {
      wrong += r[1] || 0; right += r[0] || 0;
      if ((r[1] || 0) > 0 && (r[1] || 0) >= (r[0] || 0) / 2 && DRILL[k]) misses.push(DRILL[k]);
    }
    const lapses = c?.lapses || 0;
    if (lapses) misses.unshift("meaning (flashcards)");
    const recent = c?.last && now - c.last < days * DAY;
    const score = lapses * 2 + wrong - right / 2 + (recent && c?.s === "learn" ? 1 : 0);
    if (score > 0 && misses.length) out.push({ w, score, misses, wrong: wrong + lapses, right });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

// sentences: [{s, bad, almost}] missed recently
export function weakSentences(sent, sentences, { days = 14, max = 8, now = Date.now() } = {}) {
  const byId = Object.fromEntries(sentences.map(s => [s.id, s]));
  return Object.entries(sent || {}).map(([id, p]) => ({ s: byId[id], bad: p.bad || 0, almost: p.almost || 0, ok: p.ok || 0, last: p.last || 0 }))
    .filter(x => x.s && x.bad + x.almost / 2 > x.ok / 3 && (x.bad || x.almost) && now - x.last < days * DAY)
    .sort((a, b) => (b.bad + b.almost / 2) - (a.bad + a.almost / 2)).slice(0, max);
}
