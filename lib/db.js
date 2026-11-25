// Database layer. MongoDB in Docker; MONGODB_URI=memory runs an in-memory store (for quick tests without Mongo).
import fs from "node:fs";
import path from "node:path";
import { MongoClient } from "mongodb";
import { parseVocab, parseTranslations } from "./parse.js";

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "german_vocab";
export const DEFAULT_SETTINGS = { startDate: "2026-11-30", newPerDay: 20, direction: "mixed", autoSpeak: false, weekOverride: null };

const g = globalThis;
g.__gv = g.__gv || {};

/* ---------- tiny in-memory collection with the subset of the Mongo API we use ---------- */
function memCollection() {
  const m = new Map();
  return {
    find: () => ({ toArray: async () => [...m.values()].map(d => structuredClone(d)) }),
    findOne: async (q) => structuredClone(m.get(q._id) ?? null),
    updateOne: async (q, u, o) => {
      const cur = m.get(q._id) || (o?.upsert ? { _id: q._id } : null);
      if (!cur) return;
      if (u.$set) for (const [k, v] of Object.entries(u.$set)) setPath(cur, k, v);
      if (u.$inc) for (const [k, v] of Object.entries(u.$inc)) setPath(cur, k, (getPath(cur, k) || 0) + v);
      m.set(q._id, cur);
    },
    bulkWrite: async (ops) => { for (const op of ops) { const r = op.replaceOne; m.set(r.filter._id, structuredClone(r.replacement)); } },
    insertMany: async (docs) => docs.forEach(d => m.set(d._id, structuredClone(d))),
    deleteMany: async (q = {}) => { if (q._id?.$nin) { for (const k of [...m.keys()]) if (!q._id.$nin.includes(k)) m.delete(k); } else m.clear(); },
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
  }
  return g.__gv.db;
}
const col = async (n) => (await db()).collection(n);

/* ---------- words ---------- */
function vocabFile() {
  const candidates = [process.env.VOCAB_FILE, path.join(process.cwd(), "data", "vocab-data.txt")].filter(Boolean);
  return candidates.find(f => fs.existsSync(f));
}

// Loads the word file into the "words" collection (upsert by id). Runs once per server start, or on demand.
export async function seedWords(force = false) {
  if (g.__gv.seeded && !force) return g.__gv.seeded;
  const text = fs.readFileSync(vocabFile(), "utf8");
  const trFile = path.join(path.dirname(vocabFile()), "examples-en.txt");
  const tr = fs.existsSync(trFile) ? parseTranslations(fs.readFileSync(trFile, "utf8")) : {};
  const { words, weeks } = parseVocab(text, tr);
  const words_ = await col("words");
  await words_.bulkWrite(words.map(w => ({ replaceOne: { filter: { _id: w.id }, replacement: { _id: w.id, ...w }, upsert: true } })));
  await words_.deleteMany({ _id: { $nin: words.map(w => w.id) } });
  const meta = await col("meta");
  await meta.updateOne({ _id: "weeks" }, { $set: { weeks } }, { upsert: true });
  g.__gv.seeded = { count: words.length, weeks: Object.keys(weeks).length };
  return g.__gv.seeded;
}

export async function getWords() {
  await seedWords();
  const words = (await (await col("words")).find({}).toArray()).map(({ _id, ...w }) => w).sort((a, b) => a.order - b.order);
  const weeks = (await (await col("meta")).findOne({ _id: "weeks" }))?.weeks || {};
  return { words, weeks };
}

/* ---------- progress ---------- */
const strip = (docs) => Object.fromEntries(docs.map(({ _id, ...d }) => [_id, d]));

export async function getState() {
  const [cards, quiz, log, meta] = await Promise.all(["cards", "quiz", "log", "meta"].map(col));
  const s = await meta.findOne({ _id: "settings" });
  return {
    settings: { ...DEFAULT_SETTINGS, ...(s?.value || {}) },
    cards: strip(await cards.find({}).toArray()),
    quiz: strip(await quiz.find({}).toArray()),
    log: strip(await log.find({}).toArray()),
  };
}

export async function saveReview(id, card, { isNew, ok, day, pts = 0 }) {
  await (await col("cards")).updateOne({ _id: id }, { $set: card }, { upsert: true });
  await (await col("log")).updateOne({ _id: day }, { $inc: { rev: 1, nw: isNew ? 1 : 0, ok: ok ? 1 : 0, bad: ok ? 0 : 1, pts } }, { upsert: true });
}

export async function saveQuiz(id, kind, ok, day, pts = 0) {
  await (await col("quiz")).updateOne({ _id: id }, { $inc: { [`${kind}.${ok ? 0 : 1}`]: 1 } }, { upsert: true });
  await (await col("log")).updateOne({ _id: day }, { $inc: { quiz: 1, quizOk: ok ? 1 : 0, pts } }, { upsert: true });
}

export async function saveSettings(value) {
  const meta = await col("meta");
  const cur = (await meta.findOne({ _id: "settings" }))?.value || {};
  const next = { ...DEFAULT_SETTINGS, ...cur, ...value };
  await meta.updateOne({ _id: "settings" }, { $set: { value: next } }, { upsert: true });
  return next;
}

export async function resetProgress() {
  for (const n of ["cards", "quiz", "log"]) await (await col(n)).deleteMany({});
}

// Import a progress file from the v1 HTML app (or an export from this app). Replaces current progress.
export async function importState(data) {
  if (!data || data.app !== "deutsch-vokabeln" || typeof data.cards !== "object") throw new Error("This isn't a German vocab progress file.");
  await resetProgress();
  const put = async (name, obj, fix = (v) => v) => {
    const docs = Object.entries(obj || {}).map(([k, v]) => ({ _id: k, ...fix(v) }));
    if (docs.length) await (await col(name)).insertMany(docs);
    return docs.length;
  };
  // Mongo can't $inc into array positions of a doc created by insert unless they're arrays; store quiz as {a:[r,w]}
  const n = await put("cards", data.cards);
  await put("quiz", data.quiz, (q) => Object.fromEntries(Object.entries(q).map(([k, r]) => [k, { 0: r[0] || 0, 1: r[1] || 0 }])));
  await put("log", data.log);
  if (data.settings) await saveSettings(data.settings);
  return n;
}

export async function exportState() {
  const s = await getState();
  const quiz = Object.fromEntries(Object.entries(s.quiz).map(([id, q]) => [id, Object.fromEntries(Object.entries(q).map(([k, r]) => [k, [r[0] || 0, r[1] || 0]]))]));
  return { app: "deutsch-vokabeln", version: 2, exported: new Date().toISOString(), ...s, quiz };
}
