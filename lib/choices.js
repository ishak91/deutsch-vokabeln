// Multiple-choice fallback for flashcards: checking typed English meanings and picking distractors.
const deFull = (w) => (w.t === "n" ? `${w.art} ${w.de}` : w.de);

const ARTS = ["der", "die", "das"];

// "to do, make" -> ["do", "make"]; "friend (f); girlfriend" -> ["friend", "girlfriend"]
function meanings(en) {
  return String(en).split(/[,;/]/).map(s => normEn(s)).filter(Boolean);
}
function normEn(s) {
  return String(s).toLowerCase().replace(/\([^)]*\)/g, " ").replace(/[.!?"“”'’]/g, "")
    .replace(/^\s*(to|the|a|an)\s+/, "").replace(/\s+/g, " ").trim();
}
// edit distance, to forgive one small typo in longer words
function dist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// German -> English typed answer. Any one of the listed meanings counts. Returns {ok, note}
export function checkMeaning(input, w) {
  const a = normEn(input);
  if (!a) return null;
  const opts = meanings(w.en);
  const full = normEn(w.en);
  if (a === full || opts.includes(a)) return { ok: true, note: "Richtig! +10" };
  if (opts.some(o => o.length >= 5 && dist(o, a) <= 1)) return { ok: true, note: `Richtig (small typo: “${w.en}”). +10` };
  return { ok: false, note: "Not quite. Pick the right one:" };
}

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Builds n options {label, ok, note?} for word w. dir "de": options are English meanings,
// dir "en": options are German words (nouns with article). Distractors use the same word type
// and prefer weeks the learner has already reached, so they look plausible.
export function pickChoices(w, words, dir, curWeek, n = 5) {
  const label = (x) => (dir === "de" ? x.en : deFull(x));
  const mine = new Set(meanings(w.en));
  const seen = new Set([label(w).toLowerCase()]);
  const out = [{ label: label(w), ok: true }];
  // Nouns in English -> German: one option is the same noun with a wrong article, to test der/die/das
  if (dir === "en" && w.t === "n" && ARTS.includes(w.art)) {
    const art = shuffle(ARTS.filter(a => a !== w.art))[0];
    out.push({ label: `${art} ${w.de}`, ok: false, note: `Right word, wrong article: it's ${w.art} ${w.de}.` });
    seen.add(`${art} ${w.de}`.toLowerCase());
  }
  const same = words.filter(x => x.t === w.t && x.id !== w.id);
  const near = shuffle(same.filter(x => x.week <= Math.max(curWeek, w.week)));
  const rest = shuffle(same.filter(x => x.week > Math.max(curWeek, w.week)));
  for (const x of [...near, ...rest]) {
    if (out.length >= n) break;
    const l = label(x);
    // skip synonyms and duplicates, they would make two answers correct
    if (seen.has(l.toLowerCase()) || meanings(x.en).some(m => mine.has(m)) || x.de === w.de) continue;
    seen.add(l.toLowerCase());
    out.push({ label: l, ok: false });
  }
  return shuffle(out);
}
