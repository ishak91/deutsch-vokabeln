// Answer checking for typed drills.
function norm(s) { return String(s).trim().replace(/\s+/g, " ").replace(/^(die|er|sie|es)\s+/i, ""); }
function loose(s) { return norm(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss"); }

export function check(input, answer) {
  const opts = String(answer).split("/").map(s => s.trim()).filter(Boolean);
  const a = norm(input);
  if (!a) return { ok: false };
  if (opts.some(o => norm(o) === a)) return { ok: true };
  if (opts.some(o => loose(o) === loose(a))) return { ok: true, note: "Check capitals / umlauts: " + opts.join(" / ") };
  return { ok: false };
}

export function checkPerf(input, answer) {
  const m = String(answer).match(/^(hat\/ist|ist\/hat|hat|ist)\s+(.+)$/);
  if (!m) return check(input, answer);
  const auxes = m[1].split("/");
  const sp = norm(input).split(" ");
  if (sp.length < 2) return { ok: false };
  if (!auxes.includes(sp[0].toLowerCase())) return { ok: false, note: "Helper verb should be: " + m[1] };
  return check(sp.slice(1).join(" "), m[2]);
}

// Flashcard typing (English -> German). Returns {score: 10 | 5 | 0, note}
const clean = (s) => String(s).trim().replace(/[.,!?;:"“”„]/g, "").replace(/\s+/g, " ");
const fold = (s) => clean(s).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
export function checkTyped(input, w) {
  const target = w.t === "n" ? `${w.art} ${w.de}` : w.de;
  const options = w.t === "n" ? [target] : target.split("/").map(s => s.trim());
  const a = clean(input);
  if (!a) return null;
  if (options.some(o => clean(o) === a)) return { score: 10, note: "Perfekt! +10" };
  if (options.some(o => fold(o) === fold(a))) return { score: 5, note: "Almost: check capitals / umlauts. +5" };
  if (w.t === "n") {
    const parts = a.split(" ");
    if (parts.length >= 2 && fold(parts.slice(1).join(" ")) === fold(w.de)) return { score: 2, note: `Right word, wrong article: it's ${w.art}. +2` };
    if (fold(a) === fold(w.de)) return { score: 2, note: `Don't forget the article: ${w.art} ${w.de}. +2` };
  }
  return { score: 0, note: "Not quite." };
}
