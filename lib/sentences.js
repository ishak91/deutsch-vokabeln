// Sentence practice: grading free English translations, the adaptive level, picking the next sentence,
// and tap-a-word meanings. Pure functions, used by the Sentences page (and easy to test in node).

export const LEVELS = ["E", "M", "H"];
export const LEVEL_NAME = { E: "Easy", M: "Medium", H: "Hard" };
export const LEVEL_CEFR = { E: "A1", M: "A2", H: "B1" };
export const POINTS = { E: 4, M: 6, H: 8 };          // a Right answer; Almost gets half
export const pointsFor = (lv, result) => result === "right" ? POINTS[lv] : result === "almost" ? POINTS[lv] / 2 : 0;

/* ---------- normalising English ---------- */
const CONTRACTIONS = [
  [/\bcan['’]?t\b/g, "can not"], [/\bcannot\b/g, "can not"], [/\bwon['’]t\b/g, "will not"], [/\bshan['’]t\b/g, "shall not"],
  [/n['’]t\b/g, " not"], [/['’]re\b/g, " are"], [/['’]ve\b/g, " have"], [/['’]ll\b/g, " will"], [/['’]d\b/g, " would"],
  [/\bi['’]m\b/g, "i am"], [/\b(it|that|there|what|where|he|she|who|here)['’]s\b/g, "$1 is"],
  [/['’]s (called|named|not|very|a|an|the|in|at|from|going|been|married|tired|ill|sick|always|never|often)\b/g, " is $1"], [/['’]s\b/g, ""],
  [/\beveryday\b/g, "every day"],
];
// multi-word phrases that mean the same as one word (applied before splitting into words)
const PHRASES = [
  ["have got", "have"], ["has got", "has"], ["a lot of", "many"], ["lots of", "many"], ["train station", "station"],
  ["railway station", "station"], ["mobile phone", "phone"], ["cell phone", "phone"], ["city centre", "centre"],
  ["town centre", "centre"], ["city center", "centre"], ["town center", "centre"], ["in order to", "to"], ["so that", "so"],
  ["near here", "nearby"], ["around here", "nearby"], ["close by", "nearby"], ["on time", "punctual"],
  ["this evening", "tonight"], ["tv set", "tv"], ["o clock", ""], ["at home", "home"], ["each day", "every day"],
];
// words that mean the same here; the first one is used for comparing
const SYNONYMS = [
  ["flat", "apartment"], ["film", "movie"], ["films", "movies"], ["tv", "television", "telly"], ["holiday", "vacation"],
  ["holidays", "vacations"], ["shop", "store"], ["shops", "stores"], ["mother", "mum", "mom", "mummy"], ["father", "dad", "daddy"],
  ["big", "large"], ["bigger", "larger"], ["small", "little"], ["child", "kid"], ["children", "kids"],
  ["begin", "start"], ["begins", "starts"], ["began", "started"], ["unfortunately", "sadly"],
  ["pullover", "jumper", "sweater"], ["trousers", "pants"], ["pharmacy", "chemist", "drugstore"], ["phone", "mobile", "cellphone"],
  ["present", "gift"], ["tablets", "pills"], ["tablet", "pill"], ["exam", "test"], ["job", "work"], ["study", "learn"],
  ["studying", "learning"], ["think", "believe"], ["until", "till"], ["bike", "bicycle"], ["town", "city"],
  ["leaves", "departs"], ["left", "departed"], ["ill", "sick"], ["on", "at"], ["centre", "center"], ["colour", "color"],
  ["neighbour", "neighbor"], ["favourite", "favorite"], ["switch", "turn"], ["pleased", "happy", "glad"],
  ["really", "very"], ["got", "arrived", "came"], ["each", "every"], ["seaside", "sea"], ["weekend", "weekends"],
];
const NUMBERS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const IGNORE = new Set(["a", "an", "the", "please", "oclock", "some"]);
// small words that change the meaning little: a difference here counts half
const SOFT = new Set(["my", "our", "your", "his", "her", "their", "its", "very", "really", "just", "still", "also", "too",
  "then", "and", "so", "any", "for", "already", "do", "does", "did", "there"]);

function words(s, syn) {
  let t = " " + String(s).toLowerCase().replace(/[’`]/g, "'") + " ";
  for (const [re, r] of CONTRACTIONS) t = t.replace(re, r);
  t = t.replace(/o'clock/g, "oclock").replace(/[^a-z0-9äöüß' ]+/g, " ").replace(/'/g, "").replace(/\s+/g, " ");
  for (const [a, b] of PHRASES) t = t.replace(new RegExp(` ${a} `, "g"), ` ${b} `);
  return t.trim().split(" ").filter(Boolean)
    .map(w => (/^\d+$/.test(w) && NUMBERS[+w]) || w)
    .filter(w => !IGNORE.has(w))
    .map(w => syn.get(w) || w);
}

// edit distance, to forgive one small typo in longer words
function dist(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const same = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && dist(a, b) <= 1);

// Synonym map for one sentence: the built-in list plus the English meanings of the German words in it
// (so "husband" and "man" both count for Mann).
function synonymsFor(sentence, index) {
  const parent = new Map();
  const root = (w) => { while (parent.has(w) && parent.get(w) !== w) w = parent.get(w); return w; };
  const add = (g) => { for (let i = 1; i < g.length; i++) { const a = root(g[0]), b = root(g[i]); parent.set(a, a); if (a !== b) parent.set(b, a); } };
  SYNONYMS.forEach(add);
  if (index) for (const w of glossWords(sentence.de, index)) {
    if (!w || w.t === "f") continue;
    add(String(w.en).split(/[,;/]/).map(m => m.replace(/\([^)]*\)/g, "").replace(/^\s*(to|the|a|an)\s+/i, "").trim().toLowerCase())
      .filter(m => /^[a-z]+$/.test(m)));
  }
  return new Map([...parent.keys()].map(w => [w, root(w)]));
}

// Compares two word lists ignoring order; returns the words of `want` that are missing and the extra words in `got`.
function diff(want, got) {
  const left = [...got], missing = [];
  for (const w of want) {
    const i = left.findIndex(g => same(w, g));
    if (i >= 0) left.splice(i, 1); else missing.push(w);
  }
  return { missing, extra: left };
}
// a missing "not" turns the meaning around, so it counts double
const CRITICAL = new Set(["not", "no", "never", "nothing", "nobody"]);
const weight = (ws) => ws.reduce((s, w) => s + (SOFT.has(w) ? 0.5 : CRITICAL.has(w) ? 2 : 1), 0);

// Grades a typed English answer. own = answers this learner said were right earlier ("I was right").
// Returns {result: "right" | "almost" | "wrong", best: the closest accepted answer, missing: words not found}
export function gradeTranslation(input, sentence, index, own = []) {
  const syn = synonymsFor(sentence, index);
  const got = words(input, syn);
  if (!got.length) return null;
  let best = null;
  for (const ans of [...sentence.en, ...own]) {
    const want = words(ans, syn);
    const d = diff(want, got);
    const score = Math.max(weight(d.missing), weight(d.extra));
    if (!best || score < best.score) best = { ans, want, score, ...d };
  }
  const n = best.want.length;
  const result = best.score <= 0.5 ? "right" : best.score <= (n >= 6 ? 2 : 1) ? "almost" : "wrong";
  // the shown answer: the learner's closest match among the official ones (never their own saved answer)
  const shown = sentence.en.includes(best.ans) ? best.ans : sentence.en[0];
  return { result, best: shown, missing: result === "right" ? [] : best.missing };
}

/* ---------- adaptive level ---------- */
// run = the last results at the current level, e.g. "RAW" (R right, A almost, W wrong). 3 R in a row: up.
// 2 misses in the last 3 (almost = half a miss): down. Easier sentences don't count; a harder one counts if right.
export function nextLevel(level, run, sentenceLevel, result) {
  const li = LEVELS.indexOf(level), si = LEVELS.indexOf(sentenceLevel);
  if (si < li || (si > li && result !== "right")) return { level, run, change: null };
  const mark = result === "right" ? "R" : result === "almost" ? "A" : "W";
  const r = (run + mark).slice(-3);
  if (r === "RRR" && li < 2) return { level: LEVELS[li + 1], run: "", change: "up" };
  const misses = [...r].reduce((s, c) => s + (c === "W" ? 1 : c === "A" ? 0.5 : 0), 0);
  if (misses >= 2 && li > 0) return { level: LEVELS[li - 1], run: "", change: "down" };
  return { level, run: r, change: null };
}
export const rightsInRow = (run) => (run.match(/R*$/) || [""])[0].length;

/* ---------- when a sentence comes back ---------- */
const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
const REST = [3, 7, 21, 60];  // days after 1, 2, 3, 4+ right answers in a row
export function schedule(prev = {}, result, now = Date.now()) {
  const p = { ok: 0, almost: 0, bad: 0, streak: 0, ...prev };
  if (result === "right") { p.ok++; p.streak++; p.due = now + REST[Math.min(p.streak, REST.length) - 1] * DAY; }
  else if (result === "almost") { p.almost++; p.due = now + DAY; }
  else { p.bad++; p.streak = 0; p.due = now + 10 * MIN; }
  p.last = now;
  return p;
}

/* ---------- picking the next sentence ---------- */
// 3 in 4 at the learner's level, 1 in 8 easier, 1 in 8 harder. Sentences that are due (or new) are much more likely,
// and this week's words come up more often than earlier weeks'.
export function pickSentence(sentences, progress, { level, curWeek, onlyWeek = false, avoid = [], now = Date.now(), rand = Math.random }) {
  const pool = sentences.filter(s => onlyWeek ? s.week === curWeek : s.week <= curWeek);
  if (!pool.length) return null;
  const li = LEVELS.indexOf(level), r = rand();
  const want = LEVELS[Math.max(0, Math.min(2, r < 0.75 ? li : r < 0.875 ? li - 1 : li + 1))];
  let cands = pool.filter(s => s.lv === want);
  if (!cands.length) cands = pool.filter(s => s.lv === level);
  if (!cands.length) cands = pool;
  const fresh = cands.filter(s => !avoid.includes(s.id));
  if (fresh.length) cands = fresh;
  const w = cands.map(s => {
    const p = progress[s.id];
    let x = !p ? 4 : p.due <= now ? 6 : 0.3;
    if (s.week === curWeek) x *= 1.5;
    return x;
  });
  let t = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) { t -= w[i]; if (t <= 0) return cands[i]; }
  return cands.at(-1);
}

/* ---------- tap a German word to see its meaning ---------- */
// Small words that are not in the word list (or would match the wrong entry, like mein → meinen).
const FUNCTION = `ich=I|du=you|er=he|sie=she / they|es=it|wir=we|ihr=you (plural) / her|Sie=you (polite)|mich=me|dich=you|mir=(to) me|dir=(to) you|
ihm=(to) him|uns=us|euch=you|ihnen=(to) them|sich=himself / herself / themselves|mein=my|meine=my|meinen=my|meinem=my|meiner=my|dein=your|deine=your|
sein=his / to be|seine=his|unser=our|unsere=our|der=the|die=the|das=the / that|den=the|dem=the|des=of the|ein=a|eine=a|einen=a|einem=a|einer=a|eines=of a|
kein=no|keine=no|keinen=no|nicht=not|und=and|oder=or|aber=but|denn=because|weil=because|dass=that|wenn=if / when|als=when / than / as|ob=whether, if|
obwohl=although|damit=so that|bevor=before|nachdem=after|seit=since, for|seitdem=since|deshalb=that's why|trotzdem=still, anyway|um=at / around / in order to|
zu=to|zum=to the|zur=to the|in=in|im=in the|ins=into the|an=at, on|am=at the / on|ans=to the|auf=on|aus=from, out of|mit=with|nach=to / after|von=from, of / by|
für=for|bei=at, near|ohne=without|über=about, over|bis=until|gegenüber=opposite|zwischen=between|sehr=very|auch=also|noch=still, yet|schon=already|nur=only|
jeden=every|jede=every|jedes=every|diese=this|dieser=this|dieses=this|hier=here|da=there|dort=there|wo=where|was=what|wie=how|wann=when|wer=who|warum=why|
bitte=please|zusammen=together|genug=enough|mehr=more|weniger=less|würde=would|würden=would|hätte=would have|wäre=would be|könnte=could|wird=will / is being|
wurde=was|Hause=home|direkt=directly, right|lange=for a long time|jetzt=now|ja=yes|nein=no`.split("|").map(x => x.trim().split("="));

const deKey = (s) => String(s).toLowerCase().replace(/[.,!?;:"„“”]/g, "");
// Map of every stored form (noun, plural, verb forms, word) to its word, earliest week first.
export function buildGlossIndex(words) {
  const m = new Map();
  const put = (form, w) => { const k = deKey(form); if (k && !m.has(k)) m.set(k, w); };
  for (const [de, en] of FUNCTION) if (de) put(de, { t: "f", de, en });
  for (const w of [...words].sort((a, b) => a.week - b.week || a.order - b.order)) {
    if (w.t === "p") continue;
    if (w.t === "n") { put(w.de, w); String(w.pl || "").split("/").forEach(p => { if (p && p !== "-" && p !== "(pl)") put(p, w); }); continue; }
    if (w.t === "w") { if (!w.de.includes(" ")) put(w.de, w); continue; }
    put(w.de.replace(/^sich /, ""), w);
    // er-forms: the first word (steht of "steht auf"; the particle alone would match prepositions); Perfekt: the participle
    for (const f of [w.pres, w.prat]) for (const alt of String(f || "").split("/")) put(alt.trim().split(" ")[0], w);
    for (const alt of String(w.perf || "").split("/")) { const p = alt.trim().split(" ").at(-1); if (p && !["hat", "ist"].includes(p)) put(p, w); }
    // the stem, so "stehe" or "wohnst" find their verb: steh-, wohn-
    const stem = w.de.replace(/^sich /, "").replace(/(e?n)$/, "");
    if (stem.length >= 3) put(stem, w);
    const first = String(w.pres || "").split(/[ /]/)[0];
    if (first.endsWith("t") && first.length >= 4) put(first.slice(0, -1), w);
  }
  return m;
}
const ENDINGS = ["en", "em", "er", "es", "st", "e", "n", "s", "t"];
export function glossFor(token, index) {
  const k = deKey(token);
  if (!k || k.length < 2) return null;
  if (index.has(k)) return index.get(k);
  for (const e of ENDINGS) if (k.length - e.length >= 3 && k.endsWith(e) && index.has(k.slice(0, -e.length))) return index.get(k.slice(0, -e.length));
  return null;
}
// Separable verbs: a particle at the end of a clause ("Ich stehe … auf.", "Mach … aus,") belongs to an earlier verb,
// so both words show the whole verb (aufstehen, ausmachen) instead of the preposition.
const PARTICLES = new Set(["auf", "an", "aus", "ein", "ab", "mit", "um", "zu", "weh", "fern", "zurück", "vor", "weg", "los", "herunter"]);
export function glossWords(de, index) {
  const toks = de.split(/\s+/), out = toks.map(t => glossFor(t, index));
  toks.forEach((t, i) => {
    const k = deKey(t);
    if (!PARTICLES.has(k)) return;
    const atEnd = i === toks.length - 1 || /[.,!?;:]$/.test(t);
    for (let j = i - 1; j >= 0; j--) {
      const v = out[j];
      if (v?.t !== "v") continue;
      const whole = index.get(k + v.de.replace(/^sich /, "")) || (atEnd && v.de.startsWith(k) ? v : null);
      if (whole) { out[i] = out[j] = whole; break; }
    }
  });
  return out;
}
