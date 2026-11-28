import {
  chat, sentencePrompt, cardPrompt, wordFacts, writePrompt, talkPrompt, weakPrompt, TALK_FEEDBACK, followUps, MORE,
  streamText, cached, remember, allow, logUse,
} from "@/lib/ai";
import { getSentences, getWords } from "@/lib/content";
import { getState } from "@/lib/db";
import { hintAfter } from "@/lib/hints";
import { conjugate, PRONOUNS } from "@/lib/conjugate";
import { talkById, writeById } from "@/lib/tasks";
import { weakWords, weakSentences } from "@/lib/weak";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";

const MODES = ["learn", "article", "plural", "verb", "word"];
const text = (r) => new Response(r, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
const bad = (error, status = 400) => Response.json({ error }, { status });

// Builds the start of the conversation from the database (never from text the browser sends), plus a cache key
// for the first answer when everyone with the same input gets the same answer.
async function start(b, user) {
  const kind = b.kind || "sentence";
  if (kind === "sentence") {
    const { sentences, grammar } = await getSentences();
    const s = sentences.find(x => x.id === b.id);
    if (!s) throw new Error("Unknown sentence.");
    const a = String(b.answer || "").trim().slice(0, 300);
    return { kind, prompt: sentencePrompt(s, a, b.result, grammar), key: `s|${b.id}|${a.toLowerCase().replace(/\s+/g, " ")}` };
  }
  if (kind === "card") {
    const mode = MODES.includes(b.mode) ? b.mode : "word";
    const { words } = await getWords();
    const w = words.find(x => x.id === b.id);
    if (!w) throw new Error("Unknown word.");
    const h = hintAfter(w, words);
    const c = w.t === "v" ? conjugate(w) : null;
    const facts = wordFacts(w, { hint: h && h.kind !== "mnemo" ? h.text : "", conj: c ? PRONOUNS.map((p, i) => `${p} ${c.pres[i]}`).join(", ") : "" });
    const a = String(b.answer || "").trim().slice(0, 300);
    return { kind: mode === "word" ? "word" : "card", prompt: cardPrompt(w, mode, a, facts), key: `c|${mode}|${b.id}|${a.toLowerCase()}` };
  }
  if (kind === "write") {
    const t = writeById(b.task);
    const body = String(b.text || "").trim().slice(0, 3000);
    if (!t) throw new Error("Unknown task.");
    if (body.split(/\s+/).length < 5) throw new Error("Write a few sentences first.");
    return { kind, prompt: writePrompt(t, body), maxTokens: 650 };
  }
  if (kind === "talk") {
    const t = talkById(b.task);
    if (!t) throw new Error("Unknown situation.");
    return { kind, prompt: talkPrompt(t), key: `t|${t.id}`, maxTokens: 160, keep: 14 };
  }
  if (kind === "weak") {
    const [state, { words }, { sentences }] = await Promise.all([getState(user.id), getWords(), getSentences()]);
    const byId = Object.fromEntries(words.map(w => [w.id, w]));
    const ww = weakWords(state, byId), ss = weakSentences(state.sent, sentences);
    if (!ww.length && !ss.length) throw new Error("Nothing missed often yet. Practise a bit more first.");
    return { kind, prompt: weakPrompt(ww, ss), maxTokens: 600 };
  }
  throw new Error("Unknown request.");
}

// The AI teacher: { kind, ... } -> the answer as streamed plain text.
//   sentence { id, answer, result }   Sentences page ("Ask AI why")
//   card     { id, mode, answer }     Flashcards, Articles, Plurals, Verbs, Words (mode learn/article/plural/verb/word)
//   write    { task, text }           Writing tips
//   talk     { task }                 Speaking partner (role play in German)
//   weak     {}                       Weak spots on the Progress page
// Follow-ups add { history: [answer, question, answer, ...], ask: "question" }, or { more: true } ("Explain more"),
// or for talk { feedback: true }.
export const POST = withUser(async (req, user) => {
  const b = await req.json();
  let st;
  try { st = await start(b, user); } catch (e) { return bad(e.message); }
  const q = b.feedback && st.kind === "talk" ? TALK_FEEDBACK : b.more ? MORE : String(b.ask || "").trim().slice(0, 500);
  if (!q && st.key) {  // the first answer is cached when it only depends on the shared content
    const hit = cached(st.key);
    if (hit) { logUse(st.kind, { cached: true }); return text(hit); }
  }
  if (!allow(user.id, 60)) return bad("That's a lot of questions this hour. Try again later.", 429);
  logUse(st.kind);
  if (!q) return streamText(chat(st.prompt, { maxTokens: st.maxTokens || 400 }), (t) => st.key && remember(st.key, t));
  const past = followUps(b.history, st.keep || 8);
  if (!past.length) return bad("Ask for the explanation first.");
  return streamText(chat([...st.prompt, ...past, { role: "user", content: q }], { maxTokens: b.feedback ? 500 : st.kind === "talk" ? 160 : 500 }));
});
