// Database layer. MongoDB in Docker; MONGODB_URI=memory runs an in-memory store (for quick tests without Mongo).
import { MongoClient } from "mongodb";

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "german_vocab";
export const DEFAULT_SETTINGS = { startDate: "2026-11-30", newPerDay: 20, direction: "mixed", autoSpeak: false, weekOverride: null, sentLevel: "E", sentRun: "" };

const g = globalThis;
g.__gv = g.__gv || {};

/* ---------- tiny in-memory collection with the subset of the Mongo API we use ---------- */
// Filters: plain equality, or {$in}, {$nin}, {$exists}, {$lt} on top-level fields.
function matches(doc, q = {}) {
  return Object.entries(q).every(([k, c]) => {
    const v = doc[k];
    if (c && typeof c === "object" && !Array.isArray(c)) {
      if ("$in" in c && !c.$in.includes(v)) return false;
      if ("$nin" in c && c.$nin.includes(v)) return false;
      if ("$exists" in c && (v !== undefined) !== c.$exists) return false;
      if ("$lt" in c && !(v < c.$lt)) return false;
      return true;
    }
    return v === c;
  });
}
function memCollection() {
  const m = new Map();
  const all = (q) => [...m.values()].filter(d => matches(d, q));
  return {
    find: (q) => ({ toArray: async () => all(q).map(d => structuredClone(d)) }),
    findOne: async (q) => structuredClone(all(q)[0] ?? null),
    countDocuments: async (q) => all(q).length,
    insertOne: async (d) => { if (m.has(d._id)) throw new Error("duplicate key"); m.set(d._id, structuredClone(d)); },
    updateOne: async (q, u, o) => {
      const cur = all(q)[0] || (o?.upsert ? { ...q } : null);
      if (!cur) return;
      if (u.$set) for (const [k, v] of Object.entries(u.$set)) setPath(cur, k, v);
      if (u.$inc) for (const [k, v] of Object.entries(u.$inc)) setPath(cur, k, (getPath(cur, k) || 0) + v);
      if (u.$setOnInsert && !m.has(cur._id)) Object.assign(cur, u.$setOnInsert);
      m.set(cur._id, cur);
    },
    bulkWrite: async (ops) => { for (const op of ops) { const r = op.replaceOne; m.set(r.filter._id, structuredClone(r.replacement)); } },
    insertMany: async (docs) => docs.forEach(d => m.set(d._id, structuredClone(d))),
    deleteOne: async (q) => { const d = all(q)[0]; if (d) m.delete(d._id); },
    deleteMany: async (q = {}) => { for (const d of all(q)) m.delete(d._id); },
    createIndex: async () => {},
  };
}
function setPath(o, p, v) { const ks = p.split("."); let c = o; ks.slice(0, -1).forEach(k => c = c[k] = c[k] || {}); c[ks.at(-1)] = v; }
function getPath(o, p) { return p.split(".").reduce((c, k) => c?.[k], o); }

async function db() {
  if (g.__gv.db) return g.__gv.db;
  if (URI === "memory") {
    const cols = {};
    g.__gv.db = { collection: (n) => (cols[n] = cols[n] || memCollection()) };
  } else {
    g.__gv.client = g.__gv.client || new MongoClient(URI, { serverSelectionTimeoutMS: 10000 });
    await g.__gv.client.connect();
    g.__gv.db = g.__gv.client.db(DB_NAME);
    const d = g.__gv.db;
    for (const n of PROGRESS) await d.collection(n).createIndex({ u: 1 });
    await d.collection("sessions").createIndex({ exp: 1 }, { expireAfterSeconds: 0 }); // Mongo drops expired logins
  }
  return g.__gv.db;
}
export const col = async (n) => (await db()).collection(n);

// Words, sentences and grammar topics: see lib/content.js

/* ---------- progress, always per user ---------- */
// Each progress doc carries u (user id) and k (card id or day); _id is "<user>/<k>" so it stays unique per user.
// Usernames can't contain "/", so the prefix is unambiguous. Settings live in "settings" with _id = user id.
const PROGRESS = ["cards", "quiz", "log", "sent"];  // sent = sentence practice
const pid = (u, k) => `${u}/${k}`;
const strip = (docs) => Object.fromEntries(docs.map(({ _id, u, k, ...d }) => [k, d]));

export async function getState(u) {
  const [cards, quiz, log, sent, settings] = await Promise.all([...PROGRESS, "settings"].map(col));
  const s = await settings.findOne({ _id: u });
  return {
    settings: { ...DEFAULT_SETTINGS, ...(s?.value || {}) },
    cards: strip(await cards.find({ u }).toArray()),
    quiz: strip(await quiz.find({ u }).toArray()),
    log: strip(await log.find({ u }).toArray()),
    sent: strip(await sent.find({ u }).toArray()),
  };
}

const keys = (u, k) => ({ $set: { u, k } });
export async function saveReview(u, id, card, { isNew, ok, day, pts = 0 }) {
  await (await col("cards")).updateOne({ _id: pid(u, id) }, { $set: { ...card, u, k: id } }, { upsert: true });
  await (await col("log")).updateOne({ _id: pid(u, day) }, { ...keys(u, day), $inc: { rev: 1, nw: isNew ? 1 : 0, ok: ok ? 1 : 0, bad: ok ? 0 : 1, pts } }, { upsert: true });
}

export async function saveQuiz(u, id, kind, ok, day, pts = 0) {
  await (await col("quiz")).updateOne({ _id: pid(u, id) }, { ...keys(u, id), $inc: { [`${kind}.${ok ? 0 : 1}`]: 1 } }, { upsert: true });
  await (await col("log")).updateOne({ _id: pid(u, day) }, { ...keys(u, day), $inc: { quiz: 1, quizOk: ok ? 1 : 0, pts } }, { upsert: true });
}

// One translated sentence: its schedule and tallies (p, built by lib/sentences.js schedule()), the day's counters,
// and the learner's adaptive level. "own" keeps answers the learner marked as right ("I was right").
export async function saveSentence(u, id, p, { day, ok, pts = 0, level, run, own }) {
  const sent = await col("sent");
  const cur = await sent.findOne({ _id: pid(u, id) });
  const acc = [...new Set([...(cur?.own || []), ...(own ? [String(own).slice(0, 200)] : [])])].slice(-10);
  const doc = { ...pick(p, ["ok", "almost", "bad", "streak", "due", "last"]), own: acc, u, k: id };
  await sent.updateOne({ _id: pid(u, id) }, { $set: doc }, { upsert: true });
  await (await col("log")).updateOne({ _id: pid(u, day) }, { ...keys(u, day), $inc: { sent: 1, sentOk: ok ? 1 : 0, pts } }, { upsert: true });
  if (level) await saveSettings(u, { sentLevel: level, sentRun: run || "" });
}

export async function saveSettings(u, value) {
  const settings = await col("settings");
  const cur = (await settings.findOne({ _id: u }))?.value || {};
  const next = { ...DEFAULT_SETTINGS, ...cur, ...pick(value, Object.keys(DEFAULT_SETTINGS)) };
  await settings.updateOne({ _id: u }, { $set: { value: next } }, { upsert: true });
  return next;
}
const pick = (o, ks) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => ks.includes(k)));

export async function resetProgress(u) {
  for (const n of PROGRESS) await (await col(n)).deleteMany({ u });
}

// Deletes everything a user owns (used when the admin removes an account).
export async function deleteUserData(u) {
  await resetProgress(u);
  await (await col("settings")).deleteOne({ _id: u });
  await (await col("sessions")).deleteMany({ u });
}

// Import a progress file from the v1 HTML app (or an export from this app). Replaces this user's progress.
export async function importState(u, data) {
  if (!data || data.app !== "deutsch-vokabeln" || typeof data.cards !== "object") throw new Error("This isn't a German vocab progress file.");
  await resetProgress(u);
  const put = async (name, obj, fix = (v) => v) => {
    const docs = Object.entries(obj || {}).map(([k, v]) => ({ ...fix(v), _id: pid(u, k), u, k }));
    if (docs.length) await (await col(name)).insertMany(docs);
    return docs.length;
  };
  // Mongo can't $inc into array positions of a doc created by insert unless they're arrays; store quiz as {a:[r,w]}
  const n = await put("cards", data.cards);
  await put("quiz", data.quiz, (q) => Object.fromEntries(Object.entries(q).map(([k, r]) => [k, { 0: r[0] || 0, 1: r[1] || 0 }])));
  await put("log", data.log);
  await put("sent", data.sent);
  if (data.settings) await saveSettings(u, data.settings);
  return n;
}

export async function exportState(u) {
  const s = await getState(u);
  const quiz = Object.fromEntries(Object.entries(s.quiz).map(([id, q]) => [id, Object.fromEntries(Object.entries(q).map(([k, r]) => [k, [r[0] || 0, r[1] || 0]]))]));
  return { app: "deutsch-vokabeln", version: 2, exported: new Date().toISOString(), user: u, ...s, quiz };
}

// Before accounts existed, progress docs had no owner (no "u" field) and settings sat in meta "settings".
// The first account created takes all of it over, so the learner's history is kept. Safe to run more than once.
export async function adoptLegacyProgress(u) {
  let moved = 0;
  for (const n of PROGRESS) {
    const c = await col(n);
    const old = await c.find({ u: { $exists: false } }).toArray();
    if (!old.length) continue;
    await c.insertMany(old.map(({ _id, ...d }) => ({ ...d, _id: pid(u, _id), u, k: _id })));
    await c.deleteMany({ _id: { $in: old.map(d => d._id) } });
    moved += n === "cards" ? old.length : 0;
  }
  const meta = await col("meta");
  const s = await meta.findOne({ _id: "settings" });
  if (s?.value) { await saveSettings(u, s.value); await meta.deleteOne({ _id: "settings" }); }
  return moved;
}

// How much progress is waiting for the first account (shown on the setup screen).
export async function legacyCardCount() {
  return (await col("cards")).countDocuments({ u: { $exists: false } });
}

export async function userStats(u) {
  const [cards, log] = await Promise.all([col("cards"), col("log")]);
  const days = await log.find({ u }).toArray();
  return { cards: await cards.countDocuments({ u }), points: days.reduce((s, l) => s + (l.pts || 0), 0), lastDay: days.map(d => d.k).sort().at(-1) || null };
}
