// Builds full conjugation tables (Präsens, Präteritum, Perfekt) for every pronoun
// from the four forms stored per verb: infinitive, er-present, er-Präteritum, er-Perfekt.

export const PRONOUNS = ["ich", "du", "er/sie/es", "wir", "ihr", "sie/Sie"];
const REFL = ["mich", "dich", "sich", "uns", "euch", "sich"];

const IRREG_PRES = {
  sein: ["bin", "bist", "ist", "sind", "seid", "sind"],
  haben: ["habe", "hast", "hat", "haben", "habt", "haben"],
  werden: ["werde", "wirst", "wird", "werden", "werdet", "werden"],
  wissen: ["weiß", "weißt", "weiß", "wissen", "wisst", "wissen"],
  können: ["kann", "kannst", "kann", "können", "könnt", "können"],
  müssen: ["muss", "musst", "muss", "müssen", "müsst", "müssen"],
  dürfen: ["darf", "darfst", "darf", "dürfen", "dürft", "dürfen"],
  sollen: ["soll", "sollst", "soll", "sollen", "sollt", "sollen"],
  wollen: ["will", "willst", "will", "wollen", "wollt", "wollen"],
  mögen: ["mag", "magst", "mag", "mögen", "mögt", "mögen"],
  möchten: ["möchte", "möchtest", "möchte", "möchten", "möchtet", "möchten"],
  tun: ["tue", "tust", "tut", "tun", "tut", "tun"],
};
const AUX = {
  hat: IRREG_PRES.haben,
  ist: IRREG_PRES.sein,
};

const first = (s) => (s || "").split("/")[0].trim();
const sibilant = (s) => /(s|ß|z|x)$/.test(s) && !/sch$/.test(s);
// ihr/er need an extra e: arbeit-et, find-et, öffn-et, rechn-et (but not lern-t, wohn-t)
const needsE = (stem) => /[dt]$/.test(stem) || /(ch|[^aeiouäöülrmnh])[mn]$/.test(stem);

// Replace "sich" with the right reflexive pronoun for person i
const tailFor = (tokens, i) => tokens.map((t) => (t === "sich" ? REFL[i] : t)).join(" ");
const join = (a, b) => (b ? `${a} ${b}` : a);

function presentForms(lemma, er) {
  if (IRREG_PRES[lemma]) return IRREG_PRES[lemma];
  let stem, ich, wir = lemma;
  const erEl = /[^e]e(r|l)n$/.test(lemma);
  if (erEl) {
    stem = lemma.slice(0, -1); // ärger, sammel
    ich = /eln$/.test(lemma) ? lemma.slice(0, -3) + "le" : stem + "e";
  } else if (lemma.endsWith("en")) {
    stem = lemma.slice(0, -2);
    ich = stem + "e";
  } else {
    stem = lemma.slice(0, -1);
    ich = stem + "e";
  }
  // du comes from the er form so vowel changes carry over (spricht -> sprichst, fährt -> fährst)
  let du;
  if (/dt$/.test(er)) du = er.slice(0, -1) + "st"; // lädt -> lädst
  else if (/[dt]$/.test(stem) && /[^e]t$/.test(er) && !er.startsWith(stem)) du = er + "st"; // hält -> hältst
  else {
    const base = er.endsWith("t") ? er.slice(0, -1) : er;
    du = sibilant(base) ? base + "t" : base + "st";
  }
  const ihr = stem + (!erEl && needsE(stem) ? "et" : "t");
  return [ich, du, er, wir, ihr, wir];
}

function pastForms(p) {
  if (p.endsWith("e")) return [p, p + "st", p, p + "n", p + "t", p + "n"]; // machte, wurde, konnte
  const du = /[dtsßz]$/.test(p) ? p + "est" : p + "st";
  const ihr = /[dt]$/.test(p) ? p + "et" : p + "t";
  return [p, du, p, p + "en", ihr, p + "en"];
}

export function conjugate(w) {
  if (!w || w.t !== "v" || !w.pres) return null;
  let inf = w.de.replace(/\(.*?\)/g, "").trim();
  inf = inf.replace(/^sich\s+/, "").replace(/\s+(um|an|auf|für|mit|über)$/, "").trim();

  const presTok = first(w.pres).split(/\s+/);
  const pratTok = (w.prat || "").trim().split(/\s+/);
  const perfTok = (w.perf || "").replace(/^(hat|ist)\/(hat|ist)\s+/, "$1/$2 ").split(/\s+/);

  const er = presTok[0];
  const presTail = presTok.slice(1);
  const pratTail = pratTok.slice(1);

  // The verb that actually conjugates: drop a separable prefix or a word in front
  let lemma = inf;
  if (inf.includes(" ")) lemma = inf.split(/\s+/).pop(); // Rad fahren, geboren werden
  else {
    const particle = presTail.filter((t) => t !== "sich").pop();
    if (particle && inf.toLowerCase().startsWith(particle.toLowerCase()) && inf.length > particle.length + 2)
      lemma = inf.slice(particle.length); // aufstehen -> stehen, kennenlernen -> lernen
  }

  const pres = presentForms(lemma, er);
  const pratAlts = pratTok[0].split("/").map(pastForms); // hängte/hing
  const prat = pratAlts[0].map((_, i) => pratAlts.map((a) => a[i]).join("/"));

  const aux = perfTok[0].split("/");
  const perfRest = perfTok.slice(1);
  const auxForms = (i) => aux.map((a) => (AUX[a] || AUX.hat)[i]).join("/");

  return {
    pres: PRONOUNS.map((p, i) => join(pres[i], tailFor(presTail, i))),
    prat: PRONOUNS.map((p, i) => join(prat[i], tailFor(pratTail, i))),
    perf: PRONOUNS.map((p, i) => join(auxForms(i), tailFor(perfRest, i))),
  };
}
