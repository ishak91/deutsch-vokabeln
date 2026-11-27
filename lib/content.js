// Learning content (words, sentences, grammar topics, week themes) lives in MongoDB and is shared by all accounts.
// The text files in data/ are only a starting point: on server start their entries are added to the database,
// and entries that came from the files are refreshed from them. Anything imported or changed through the app
// (src: "import") is never overwritten by the files, and nothing is ever deleted automatically, so progress stays safe.
import fs from "node:fs";
import path from "node:path";
import { col } from "./db.js";
import { parseVocab, parseTranslations, parseSentences, parseGrammar } from "./parse.js";

const g = globalThis;
g.__gv = g.__gv || {};

/* ---------- reading the data/ files ---------- */
function dataDir() {
  const f = [process.env.VOCAB_FILE, path.join(process.cwd(), "data", "vocab-data.txt")].filter(Boolean).find(x => fs.existsSync(x));
  return f ? path.dirname(f) : null;
}
const read = (dir, name) => { const f = dir && path.join(dir, name); return f && fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""; };

function fromFiles() {
  const dir = dataDir();
  const { words, weeks } = parseVocab(read(dir, "vocab-data.txt"), parseTranslations(read(dir, "examples-en.txt")));
  const sentences = parseSentences(read(dir, "sentences-data.txt"));
  const grammar = Object.entries(parseGrammar(read(dir, "grammar.txt"))).map(([tag, v]) => ({ tag, ...v }));
  return { words, weeks, sentences, grammar };
}

/* ---------- writing to the database ---------- */
// Upserts docs ({_id, ...}). With src "file", entries that were imported or edited in the app are left alone.
async function upsert(name, docs, src) {
  if (!docs.length) return { added: 0, updated: 0, kept: 0 };
  const c = await col(name);
  const have = new Map((await c.find({ _id: { $in: docs.map(d => d._id) } }).toArray()).map(d => [d._id, d]));
  const write = src === "file" ? docs.filter(d => !have.has(d._id) || (have.get(d._id).src || "file") === "file") : docs;
  if (write.length) await c.bulkWrite(write.map(d => ({ replaceOne: { filter: { _id: d._id }, replacement: { ...d, src }, upsert: true } })));
  const added = write.filter(d => !have.has(d._id)).length;
  return { added, updated: write.length - added, kept: docs.length - write.length };
}

async function mergeWeeks(weeks, overwrite) {
  if (!Object.keys(weeks).length) return;
  const meta = await col("meta");
  const cur = (await meta.findOne({ _id: "weeks" }))?.weeks || {};
  const next = overwrite ? { ...cur, ...weeks } : { ...weeks, ...cur };
  await meta.updateOne({ _id: "weeks" }, { $set: { weeks: next } }, { upsert: true });
}

// Adds what's in data/ to the database. Runs once per server start, and when an admin presses the button.
export async function syncFromFiles(force = false) {
  if (g.__gv.synced && !force) return g.__gv.synced;
  const f = fromFiles();
  const r = {
    words: await upsert("words", f.words.map(w => ({ _id: w.id, ...w })), "file"),
    sentences: await upsert("sentences", f.sentences.map(s => ({ _id: s.id, ...s })), "file"),
    grammar: await upsert("grammar", f.grammar.map(x => ({ _id: x.tag, ...x })), "file"),
  };
  await mergeWeeks(f.weeks, false);
  g.__gv.synced = r;
  return r;
}

const clean = ({ _id, src, ...d }) => d;
export async function getWords() {
  await syncFromFiles();
  const words = (await (await col("words")).find({}).toArray()).map(clean).sort((a, b) => a.week - b.week || a.order - b.order);
  const weeks = (await (await col("meta")).findOne({ _id: "weeks" }))?.weeks || {};
  return { words, weeks };
}

export async function getSentences() {
  await syncFromFiles();
  const sentences = (await (await col("sentences")).find({}).toArray()).map(clean).sort((a, b) => a.week - b.week || a.order - b.order);
  const grammar = Object.fromEntries((await (await col("grammar")).find({}).toArray()).map(({ _id, src, tag, ...x }) => [_id, x]));
  return { sentences, grammar };
}

/* ---------- JSON import / export ---------- */
// The JSON uses friendly field names (see EXAMPLE); these map them to the stored short names and back.
const TYPES = { noun: "n", verb: "v", word: "w", phrase: "p" };
const TYPE_NAME = { n: "noun", v: "verb", w: "word", p: "phrase" };
const str = (v) => (v == null ? "" : String(v).trim());

export function wordFromJson(x) {
  const t = TYPES[str(x.type).toLowerCase()] || (["n", "v", "w", "p"].includes(x.type) ? x.type : null);
  if (!t) return { error: `type must be noun, verb, word or phrase` };
  const week = parseInt(x.week, 10);
  if (!(week >= 1 && week <= 99)) return { error: "week must be a number from 1 to 99" };
  const w = { t, de: str(x.word ?? x.de), en: str(x.en ?? x.english), week, ex: str(x.example), exEn: str(x.exampleEn) };
  if (!w.de || !w.en) return { error: "word and en (English) are required" };
  if (t === "n") {
    w.art = str(x.article ?? x.art).toLowerCase();
    if (!["der", "die", "das"].includes(w.art)) return { error: `${w.de}: article must be der, die or das` };
    w.pl = str(x.plural ?? x.pl) || "-"; w.hint = str(x.hint);
  }
  if (t === "v") {
    w.pres = str(x.present ?? x.pres); w.prat = str(x.past ?? x.prat); w.perf = str(x.perfect ?? x.perf);
    if (!w.pres || !w.prat || !w.perf) return { error: `${w.de}: verbs need present, past and perfect (er/sie forms, e.g. geht, ging, ist gegangen)` };
  }
  if (t === "p") w.ex = "";
  if (!w.exEn) delete w.exEn;
  w.id = w.t + ":" + (w.t === "n" ? w.art + " " : "") + w.de; // same id rule as parseVocab: never change it
  return { word: w };
}
export function wordToJson(w) {
  const o = { type: TYPE_NAME[w.t], week: w.week };
  if (w.t === "n") Object.assign(o, { article: w.art, word: w.de, plural: w.pl });
  else o.word = w.de;
  if (w.t === "v") Object.assign(o, { present: w.pres, past: w.prat, perfect: w.perf });
  o.en = w.en;
  if (w.ex) o.example = w.ex;
  if (w.exEn) o.exampleEn = w.exEn;
  if (w.hint) o.hint = w.hint;
  return o;
}

export function sentenceFromJson(x) {
  const week = parseInt(x.week, 10), lv = str(x.level).toUpperCase().slice(0, 1);
  const en = (Array.isArray(x.en) ? x.en : str(x.en).split(" / ")).map(str).filter(Boolean);
  const s = { id: str(x.id), week, lv, de: str(x.de ?? x.german), en, tags: (Array.isArray(x.tags) ? x.tags : str(x.tags).split(",")).map(str).filter(Boolean), note: str(x.note) };
  if (!(week >= 1 && week <= 99)) return { error: "week must be a number from 1 to 99" };
  if (!"EMH".includes(lv) || !lv) return { error: `${s.de || "sentence"}: level must be E, M or H (easy, medium, hard)` };
  if (!s.de || !en.length) return { error: "de (German) and en (at least one English answer) are required" };
  if (s.id && !/^[\w-]{1,40}$/.test(s.id)) return { error: `${s.id}: id may only use letters, digits, - and _` };
  return { sentence: s };
}
const sentenceToJson = (s) => ({ id: s.id, week: s.week, level: s.lv, de: s.de, en: s.en, tags: s.tags, note: s.note });

export function grammarFromJson(x) {
  const t = { tag: str(x.tag), level: str(x.level), title: str(x.title), text: str(x.text) };
  if (!/^[\w-]{1,40}$/.test(t.tag) || !t.title || !t.text) return { error: "grammar needs tag, title and text" };
  return { grammar: t };
}

// Checks a content file and, unless dry, saves it. Imported entries are added or replace the same id; nothing is deleted.
export async function importContent(data, { dry = true } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("This isn't a content file (expected a JSON object).");
  if (data.app === "deutsch-vokabeln" && data.cards) throw new Error("This is a progress backup. Import it under \"Your progress\" instead.");
  const errors = [], words = [], sentences = [], grammar = [];
  const take = (list, conv, key, label) => (Array.isArray(list) ? list : []).forEach((x, i) => {
    const r = conv(x || {});
    if (r.error) errors.push(`${label} ${i + 1}: ${r.error}`); else key.push(r[Object.keys(r)[0]]);
  });
  take(data.words, wordFromJson, words, "Word");
  take(data.sentences, sentenceFromJson, sentences, "Sentence");
  take(data.grammar, grammarFromJson, grammar, "Grammar");
  const weeks = {};
  for (const [k, v] of Object.entries(data.weeks || {})) { const n = parseInt(k, 10); if (n >= 1 && n <= 99 && str(v)) weeks[n] = str(v); }
  if (!words.length && !sentences.length && !grammar.length && !Object.keys(weeks).length && !errors.length)
    throw new Error("Nothing to import: the file needs a words, sentences, grammar or weeks list.");

  await syncFromFiles();
  const [wc, sc, gc] = await Promise.all(["words", "sentences", "grammar"].map(col));
  const existing = async (c, ids) => new Set((await c.find({ _id: { $in: ids } }).toArray()).map(d => d._id));
  // New words go after everything else in their week; new sentences without an id get the next free one, e.g. 18e03
  const allWords = await wc.find({}).toArray();
  let order = allWords.reduce((m, w) => Math.max(m, w.order || 0), 0);
  const haveW = await existing(wc, words.map(w => w.id));
  for (const w of words) { const old = allWords.find(o => o._id === w.id); w.order = old ? old.order : ++order; }
  const allS = await sc.find({}).toArray();
  const usedIds = new Set(allS.map(s => s._id));
  let sOrder = allS.reduce((m, s) => Math.max(m, s.order || 0), 0);
  for (const s of sentences) {
    if (!s.id) { let n = 1; while (usedIds.has(`${s.week}${s.lv.toLowerCase()}${String(n).padStart(2, "0")}`)) n++; s.id = `${s.week}${s.lv.toLowerCase()}${String(n).padStart(2, "0")}`; }
    usedIds.add(s.id);
    const old = allS.find(o => o._id === s.id); s.order = old ? old.order : ++sOrder;
  }
  const haveS = await existing(sc, sentences.map(s => s.id));
  const haveG = await existing(gc, grammar.map(x => x.tag));
  const unknownTags = [...new Set(sentences.flatMap(s => s.tags))].filter(t => !grammar.some(x => x.tag === t));
  const knownTags = await existing(gc, unknownTags);
  const warnings = unknownTags.filter(t => !knownTags.has(t)).map(t => `Grammar tag "${t}" has no explanation yet (add it under grammar).`);
  const count = (list, have, id) => ({ add: list.filter(x => !have.has(id(x))).length, update: list.filter(x => have.has(id(x))).length });
  const summary = {
    words: count(words, haveW, w => w.id), sentences: count(sentences, haveS, s => s.id), grammar: count(grammar, haveG, x => x.tag),
    weeks: Object.keys(weeks).length, errors, warnings, saved: false,
  };
  if (dry || errors.length) return summary;
  await upsert("words", words.map(w => ({ _id: w.id, ...w })), "import");
  await upsert("sentences", sentences.map(s => ({ _id: s.id, ...s })), "import");
  await upsert("grammar", grammar.map(x => ({ _id: x.tag, ...x })), "import");
  await mergeWeeks(weeks, true);
  return { ...summary, saved: true };
}

export async function exportContent() {
  const { words, weeks } = await getWords();
  const { sentences, grammar } = await getSentences();
  return {
    app: "deutsch-vokabeln-content", version: 1, exported: new Date().toISOString(), weeks,
    words: words.map(wordToJson), sentences: sentences.map(sentenceToJson),
    grammar: Object.entries(grammar).map(([tag, x]) => ({ tag, level: x.level, title: x.title, text: x.text })),
  };
}

// A small file showing every kind of entry. Download it, edit, import.
export const EXAMPLE = {
  app: "deutsch-vokabeln-content", version: 1,
  weeks: { 18: "Beispiel: Essen und Trinken" },
  words: [
    { type: "noun", week: 18, article: "der", word: "Löffel", plural: "Löffel", en: "spoon", example: "Ich brauche einen Löffel.", exampleEn: "I need a spoon.", hint: "" },
    { type: "verb", week: 18, word: "schmecken", present: "schmeckt", past: "schmeckte", perfect: "hat geschmeckt", en: "to taste", example: "Die Suppe schmeckt gut.", exampleEn: "The soup tastes good." },
    { type: "word", week: 18, word: "lecker", en: "tasty, delicious", example: "Der Kuchen ist lecker.", exampleEn: "The cake is delicious." },
    { type: "phrase", week: 18, word: "Guten Appetit!", en: "Enjoy your meal!" },
  ],
  sentences: [
    { week: 18, level: "E", de: "Ich möchte bitte eine Suppe.", en: ["I would like a soup please", "I would like some soup please"], tags: ["moechten"], note: "möchte = would like; it takes an object in the accusative: eine Suppe." },
  ],
  grammar: [
    { tag: "moechten", level: "A1", title: "möchten (would like)", text: "The polite way to ask for something: ich möchte, du möchtest, er möchte. Ich möchte einen Kaffee." },
  ],
};
