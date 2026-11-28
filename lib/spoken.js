// Compares German text the learner said (Whisper's transcript) or typed (dictation) with the right sentence,
// word by word. No AI: plain matching, so the result can be trusted.

const NUM = { 0: "null", 1: "eins", 2: "zwei", 3: "drei", 4: "vier", 5: "fünf", 6: "sechs", 7: "sieben", 8: "acht",
  9: "neun", 10: "zehn", 11: "elf", 12: "zwölf", 20: "zwanzig", 100: "hundert" };

// The words of a sentence, as shown (keeps capitals and punctuation for display)
export const words = (s) => String(s || "").split(/\s+/).filter(t => /[\p{L}\p{N}]/u.test(t));

// For comparing: lower case, no punctuation, ß = ss, digits as words ("3" = "drei"), "ein" = "eins"
export function norm(t, { keepCase = false } = {}) {
  let x = String(t).replace(/[^\p{L}\p{N}'-]/gu, "").replace(/^['-]+|['-]+$/g, "");
  if (!keepCase) x = x.toLowerCase().replace(/ß/g, "ss");
  if (/^\d+$/.test(x) && NUM[+x]) x = NUM[+x];
  return x;
}

function dist(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// 2 = same, 1 = close (one letter off in a word of 5+ letters, or umlaut written as plain vowel), 0 = different
function same(a, b) {
  if (a === b) return 2;
  const plain = (s) => s.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u");
  if (plain(a) === plain(b)) return 1;
  return a.length >= 5 && dist(a, b) <= 1 ? 1 : 0;
}

// target: the right German; got: what was said or typed.
// -> { parts: [{ word, ok: 2|1|0, got }], extra: [words in got that aren't in target], score: 0..100 }
// Words are lined up with a longest-common-subsequence match, so one missing word doesn't mark the rest wrong.
export function compareGerman(target, got, { strictCase = false } = {}) {
  const T = words(target), G = words(got);
  const tn = T.map(t => norm(t)), gn = G.map(t => norm(t));
  const n = T.length, m = G.length;
  const L = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = same(tn[i], gn[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const parts = [], extra = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    const s = same(tn[i], gn[j]);
    if (s && L[i][j] === L[i + 1][j + 1] + 1) {
      let ok = s;
      // dictation: a lower-case noun, a capitalised other word or "ss" for "ß" is a small mistake
      if (strictCase && ok === 2 && norm(T[i], { keepCase: true }) !== norm(G[j], { keepCase: true })) ok = 1;
      parts.push({ word: T[i], ok, got: G[j] }); i++; j++;
    } else if (L[i + 1][j + 1] === L[i][j]) { parts.push({ word: T[i], ok: 0, got: G[j] }); i++; j++; }  // said another word here
    else if (L[i + 1][j] >= L[i][j + 1]) { parts.push({ word: T[i], ok: 0, got: "" }); i++; }
    else { extra.push(G[j]); j++; }
  }
  while (i < n) parts.push({ word: T[i++], ok: 0, got: "" });
  while (j < m) extra.push(G[j++]);
  const pts = parts.reduce((a, p) => a + (p.ok === 2 ? 1 : p.ok === 1 ? 0.6 : 0), 0);
  const score = n ? Math.round(100 * Math.max(0, pts - extra.length * 0.5) / n) : 0;
  return { parts, extra, score };
}
