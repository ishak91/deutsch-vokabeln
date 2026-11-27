// Self-hosted AI through Ollama (the "ollama" service in docker-compose.yml).
// Only one model is kept on disk: installing a model first deletes every other one, because the server's disk
// and RAM are small. The AI only explains answers; it never writes the German content or grades answers.
import os from "node:os";
import { statfs } from "node:fs/promises";
import { col } from "./db.js";

const URL_ = () => (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
export const DEFAULT_MODEL = process.env.AI_MODEL || "gemma4:e4b";
const MODELS_DIR = process.env.OLLAMA_MODELS_DIR || "/ollama-models"; // the model volume, mounted read-only into web
const GB = 1024 ** 3;

// Models that suit this app. size = download, ram = memory needed to run with our short context (both rough, GB).
export const CATALOG = [
  { id: "gemma3:1b", name: "Gemma 3 1B", size: 0.8, ram: 1.5, note: "Fast, but weak explanations. Only for very small servers." },
  { id: "gemma3:4b", name: "Gemma 3 4B", size: 3.3, ram: 4.5, note: "Good explanations. Fits a 6 GB server, slow on 1 CPU." },
  { id: "gemma4:e2b", name: "Gemma 4 E2B", size: 7.2, ram: 8, note: "Newer Gemma, about as good as Gemma 3 4B." },
  { id: "gemma4:e4b", name: "Gemma 4 E4B", size: 9.6, ram: 11, note: "Best of these. Needs about 12 GB RAM or more." },
];
export const MODEL_RE = /^[a-z0-9][a-z0-9._\-/]{0,80}(:[a-z0-9._\-]{1,40})?$/i;

async function ollama(path, { method = "GET", body, timeout = 15000 } = {}) {
  const r = await fetch(URL_() + path, {
    method, headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || `AI service answered ${r.status}`);
  return r;
}

// Reads Ollama's streamed answer: one JSON object per line
async function* lines(r) {
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line) yield JSON.parse(line);
    }
  }
  if (buf.trim()) yield JSON.parse(buf);
}

export const installed = async () => (await (await ollama("/api/tags")).json()).models || [];
const version = async () => (await (await ollama("/api/version", { timeout: 4000 })).json()).version;

// --- which model is active (shared by everyone, kept in meta "ai") ---
const meta = async () => (await (await col("meta")).findOne({ _id: "ai" }))?.value || {};
const setMeta = async (value) => (await col("meta")).updateOne({ _id: "ai" }, { $set: { value } }, { upsert: true });

// The chosen model if it is on disk, otherwise whatever is on disk (e.g. pulled by deploy/ai-model.sh)
async function activeModel(list) {
  const { model } = await meta();
  const names = list.map(m => m.name);
  return names.includes(model) ? model : names[0] || null;
}

// --- the install job (one at a time, kept in memory; survives page reloads, not a server restart) ---
const job = globalThis.__aiJob ||= { state: "idle" };

export async function status() {
  try {
    const list = await installed();
    return { ok: true, model: await activeModel(list), installing: busy() ? job.model : null };
  } catch { return { ok: false, model: null, installing: busy() ? job.model : null }; }
}

const busy = () => job.state === "deleting" || job.state === "downloading";

// Everything the admin page shows
export async function adminInfo() {
  let disk = null;
  for (const p of [MODELS_DIR, "/"]) {
    try { const s = await statfs(p); disk = { free: s.bavail * s.bsize / GB, total: s.blocks * s.bsize / GB }; break; } catch {}
  }
  const info = { ram: { total: os.totalmem() / GB, free: os.freemem() / GB }, cpus: os.cpus().length, disk, catalog: CATALOG,
    defaultModel: DEFAULT_MODEL, job: { ...job } };
  try {
    const [v, list] = await Promise.all([version(), installed()]);
    return { ...info, ok: true, version: v, models: list.map(m => ({ name: m.name, size: m.size / GB })), model: await activeModel(list) };
  } catch (e) {
    return { ...info, ok: false, error: "The AI service isn't reachable: " + e.message, models: [], model: null };
  }
}

// Deletes every model on disk, then downloads the new one. Runs in the background; the page polls adminInfo().
export async function install(model) {
  if (!MODEL_RE.test(model || "")) throw new Error("That isn't a valid model name, e.g. gemma3:4b");
  if (busy()) throw new Error(`Already installing ${job.model}. Wait until it finishes.`);
  Object.assign(job, { state: "deleting", model, started: Date.now(), done: 0, total: 0, error: null, removed: [], status: "" });
  // fails early if the AI service is down, before anything is deleted
  try { await installed(); } catch (e) { Object.assign(job, { state: "error", error: e.message }); throw e; }
  run(model).catch(e => Object.assign(job, { state: "error", error: e.message }));
}

async function run(model) {
  for (const m of await installed()) {
    await ollama("/api/delete", { method: "DELETE", body: { model: m.name } });
    job.removed.push(m.name);
  }
  await setMeta({ model: null });
  job.state = "downloading";
  const r = await ollama("/api/pull", { method: "POST", body: { model, stream: true }, timeout: 6 * 3600e3 });
  const parts = {};
  for await (const l of lines(r)) {
    if (l.error) throw new Error(l.error);
    if (l.digest && l.total) { parts[l.digest] = [l.completed || 0, l.total]; }
    const v = Object.values(parts);
    job.done = v.reduce((a, p) => a + p[0], 0); job.total = v.reduce((a, p) => a + p[1], 0);
    job.status = l.status;
  }
  const got = (await installed()).find(m => m.name === model || m.name === model + ":latest");
  if (!got) throw new Error("The download ended but the model isn't there.");
  await setMeta({ model: got.name });
  Object.assign(job, { state: "done", finished: Date.now() });
}

export async function remove(model) {
  if (busy()) throw new Error("Wait until the install finishes.");
  await ollama("/api/delete", { method: "DELETE", body: { model } });
}

// --- asking the model ---

// Thinking models (Gemma 4, Qwen 3) would first "think" silently for a long time; we switch that off.
const caps = globalThis.__aiCaps ||= new Map();
async function canThink(model) {
  if (!caps.has(model)) {
    const s = await (await ollama("/api/show", { method: "POST", body: { model } })).json().catch(() => ({}));
    caps.set(model, (s.capabilities || []).includes("thinking"));
  }
  return caps.get(model);
}

// The server has few CPUs, so only one answer is written at a time; a short queue waits for its turn.
let chain = Promise.resolve(), waiting = 0;
const MAX_WAITING = 3;

// Streams the model's answer as plain text pieces
export async function* chat(messages, { maxTokens = 260 } = {}) {
  if (busy()) throw new Error("The AI model is being installed. Try again when it's done.");
  const model = await activeModel(await installed());
  if (!model) throw new Error("No AI model is installed yet. An admin can install one on the AI page.");
  if (waiting >= MAX_WAITING) throw new Error("The AI is busy with other questions. Try again in a minute.");
  waiting++;
  let release;
  const turn = chain; chain = new Promise(r => (release = r));
  try {
    await turn;
    const think = (await canThink(model)) ? { think: false } : {};
    const r = await ollama("/api/chat", {
      method: "POST", timeout: 5 * 60e3,
      body: { model, messages, stream: true, keep_alive: "30m", ...think,
        options: { temperature: 0.3, num_ctx: 2048, num_predict: maxTokens } },
    });
    for await (const l of lines(r)) {
      if (l.error) throw new Error(l.error);
      if (l.message?.content) yield l.message.content;
    }
  } finally { waiting--; release(); }
}

// Wraps chat() in a text response that the browser reads piece by piece. Problems before the first word
// (no model, busy) come back as a JSON error instead.
export async function streamText(gen, onDone) {
  let first;
  try { first = await gen.next(); }
  catch (e) { return Response.json({ error: e.message }, { status: 503 }); }
  const enc = new TextEncoder();
  let text = "";
  return new Response(new ReadableStream({
    async pull(ctl) {
      try {
        const { value, done } = first || await gen.next();
        first = null;
        if (done) { onDone?.(text); return ctl.close(); }
        text += value; ctl.enqueue(enc.encode(value));
      } catch (e) { ctl.enqueue(enc.encode(`\n\n⚠️ ${e.message}`)); ctl.close(); }
    },
    cancel() { gen.return?.(); },
  }), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}

// --- prompts ---

const SYSTEM = `You are a patient German teacher. Your student speaks English and is at level A1 to A2, preparing for the B1 exam.
Rules:
- Write simple English, at most 90 words, as 2 to 4 short bullet points starting with "- ".
- Quote the German words you talk about, in "quotes".
- Only talk about this sentence. Never invent grammar rules. If you are not sure, say so.
- The accepted translations are correct. If the student's answer means the same, say it is fine.
- No greeting and no summary at the end.`;

export function sentencePrompt(s, answer, result, grammar = {}) {
  const topics = (s.tags || []).map(t => grammar[t]?.title).filter(Boolean).join(", ");
  const user = [
    `German sentence: ${s.de}`,
    `Accepted English translations: ${s.en.join(" | ")}`,
    answer ? `Student's answer: ${answer}` : "The student didn't know the answer.",
    answer ? `The app graded it as: ${result === "almost" ? "almost right" : "wrong"}.` : "",
    s.note ? `Teacher's grammar note: ${s.note}` : "",
    topics ? `Grammar topics: ${topics}` : "",
    "",
    answer ? "Explain what is different or wrong in the student's answer, and how the German sentence works."
      : "Explain how the German sentence works, word by word where it helps.",
  ].filter(x => x !== "").join("\n");
  return [{ role: "system", content: SYSTEM }, { role: "user", content: user }];
}

// --- small helpers for routes ---

// Answers to the same question are kept, so asking twice costs nothing
const cache = globalThis.__aiCache ||= new Map();
export const cached = (key) => cache.get(key);
export function remember(key, text) {
  if (!text || text.includes("⚠️")) return;
  cache.set(key, text);
  if (cache.size > 500) cache.delete(cache.keys().next().value);
}

// At most 40 questions per user per hour (1 CPU: keeps one person from blocking everyone)
const uses = globalThis.__aiUses ||= new Map();
export function allow(u, limit = 40) {
  const now = Date.now(), list = (uses.get(u) || []).filter(t => now - t < 3600e3);
  if (list.length >= limit) return false;
  list.push(now); uses.set(u, list); return true;
}
