// Article hints: ending rules, compound words, and the word's own memory hint.
const DAYS = ["montag","dienstag","mittwoch","donnerstag","freitag","samstag","sonntag","sonnabend"];
const MONTHS = ["januar","februar","märz","april","mai","juni","juli","august","september","oktober","november","dezember"];
const SEASONS = ["frühling","sommer","herbst","winter"];
const WEATHER = ["regen","schnee","wind","nebel","sturm","hagel","frost","donner","blitz"];
const DIRS = ["norden","süden","osten","westen"];
const ART_RULES = [
  // [test(lowercase word, w), article, short rule, reliability]
  [x=>DAYS.includes(x), "der", "Days of the week are der", "always"],
  [x=>MONTHS.includes(x), "der", "Months are der", "always"],
  [x=>SEASONS.includes(x), "der", "Seasons are der", "always"],
  [x=>WEATHER.includes(x), "der", "Weather words (Regen, Schnee, Wind) are der", "almost always"],
  [x=>DIRS.includes(x), "der", "Compass directions are der", "always"],
  [x=>/(chen|lein)$/.test(x), "das", "-chen / -lein (small things) are das", "always"],
  [x=>/(ung|heit|keit|schaft)$/.test(x), "die", "-ung, -heit, -keit, -schaft are die", "always"],
  [x=>/(tion|sion|ion)$/.test(x), "die", "-ion is die", "almost always"],
  [x=>/(tät|ität)$/.test(x), "die", "-tät is die", "always"],
  [x=>/(ei|erei)$/.test(x) && x.length>3, "die", "-ei is die (Bäckerei, Polizei)", "almost always"],
  [x=>/(ie)$/.test(x) && x.length>3, "die", "-ie is die (Familie, Biologie)", "almost always"],
  [x=>/(ik)$/.test(x), "die", "-ik is die (Musik, Politik)", "usually"],
  [x=>/(ur)$/.test(x) && !/eur$/.test(x) && x.length>4, "die", "-ur is die (Natur, Kultur)", "usually"],
  [x=>/(enz|anz)$/.test(x), "die", "-enz / -anz are die", "usually"],
  [x=>/(er|ist|ant|ent|ör|är|arzt|ärzt|chef|freund|nachbar|koch|köch|kolleg)in$/.test(x), "die", "-in for a woman (Lehrerin) is die", "always"],
  [x=>/(ling|ismus)$/.test(x), "der", "-ling, -ismus are der", "always"],
  [x=>/(ist|ant)$/.test(x) && x.length>5, "der", "-ist / -ant (people) are der", "usually"],
  [x=>/(ment|[^a]um)$/.test(x) && x.length>4, "das", "-ment, -um are das (Dokument, Zentrum)", "usually"],
  [x=>/nis$/.test(x), "das", "-nis is mostly das (Ergebnis); some are die (Erlaubnis)", "often"],
  [x=>/(ma)$/.test(x), "das", "-ma is mostly das (Thema, Klima)", "often"],
  [x=>/o$/.test(x), "das", "Many words ending in -o are das (Auto, Kino, Büro)", "often"],
  [(x,w)=>/en$/.test(x) && w.pl==="-" && !/(husten|schnupfen|frieden|regen|norden|süden|osten|westen|rücken|magen|garten)$/.test(x), "das", "A verb used as a noun is das (das Essen, das Schwimmen)", "always"],
  [x=>/(ig|ich|ling|or)$/.test(x), "der", "-ig, -ich, -or are usually der (Honig, Teppich, Motor)", "usually"],
  [x=>/e$/.test(x) && !/ee$/.test(x), "die", "Most nouns ending in -e are die (about 90%)", "usually"],
];
export const ART_MNEMO = { der: "🔵 der: picture it as a man / something blue", die: "🔴 die: picture it as a woman / something red", das: "🟢 das: picture it as a child / something green" };
const ARTS = ["der", "die", "das"];

// find a known noun that this noun ends with (Kühlschrank -> Schrank)
export function compoundPart(w, words) {
  const x = w.de.toLowerCase(); let best = null;
  for (const o of words) {
    if (o.t !== "n" || o.id === w.id || o.pl === "(pl)" || !ARTS.includes(o.art) || o.de.includes(" ")) continue;
    const y = o.de.toLowerCase();
    if (y.length >= 3 && x.length - y.length >= 2 && x.endsWith(y) && (!best || y.length > best.de.length)) best = o;
  }
  return best;
}

export function artHint(w, words) {
  const x = w.de.split(/[\s-]/).pop().toLowerCase();
  let r = null, part = null;
  if (/^(mann|vater|bruder|sohn|onkel|opa|großvater|junge|herr|freund|kollege)$/.test(x)) r = { rule: "Male people are der", ruleArt: "der", rel: "always" };
  else if (/^(frau|mutter|schwester|tochter|tante|oma|großmutter|dame)$/.test(x)) r = { rule: "Female people are die", ruleArt: "die", rel: "always" };
  else {
    part = compoundPart(w, words);
    if (part) r = { rule: `Compound word: the last part decides (${part.art} ${part.de} → ${w.art} ${w.de})`, ruleArt: part.art, rel: "always" };
  }
  if (!r) for (const [test, art, rule, rel] of ART_RULES) { if (test(x, w)) { r = { rule, ruleArt: art, rel }; break; } }
  return { ...(r || { rule: null }), fits: r ? r.ruleArt === w.art : false, part, own: w.hint || "" };
}

// Text shown before answering
export function hintBefore(w, words) {
  const h = artHint(w, words);
  if (h.part) return `Compound word: the last part decides. Which article does "${h.part.de}" have?`;
  if (h.rule) return `${h.rule} (${h.rel})`;
  return "No ending rule for this one. Learn it as a pair with its colour and say it out loud 3 times.";
}

// Structured explanation shown after answering
export function hintAfter(w, words) {
  if (w.t !== "n" || !ARTS.includes(w.art)) return null;
  const h = artHint(w, words);
  let kind = "mnemo", text = ART_MNEMO[w.art];
  if (h.rule && h.fits) { kind = "rule"; text = h.rule + "."; }
  else if (h.rule) { kind = "exception"; text = `Exception: ${h.rule.replace(/ (are|is) .*$/, "")} usually takes ${h.ruleArt}, but this one is ${w.art}.`; }
  return { kind, text, own: h.own };
}
