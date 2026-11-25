// Parses data/vocab-data.txt into word objects. Same ids as the v1 HTML app, so old progress imports cleanly.
export function parseTranslations(text) {
  const m = {};
  for (const raw of (text || "").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.lastIndexOf("|");
    if (i > 0) m[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return m;
}

export function parseVocab(text, translations = {}) {
  const words = [], weeks = {}, seen = new Set();
  let week = 0, order = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || (line.startsWith("#") && !line.startsWith("##"))) continue;
    if (line.startsWith("##")) {
      const [w, theme] = line.slice(2).split("|").map(s => s.trim());
      week = parseInt(w, 10); weeks[week] = theme || ""; continue;
    }
    const f = line.split("|").map(s => s.trim());
    let o = null;
    if (f[0] === "n") o = { t: "n", art: f[1], de: f[2], pl: f[3], en: f[4], ex: f[5] || "", hint: f[6] || "" };
    else if (f[0] === "v") o = { t: "v", de: f[1], pres: f[2], prat: f[3], perf: f[4], en: f[5], ex: f[6] || "" };
    else if (f[0] === "w") o = { t: "w", de: f[1], en: f[2], ex: f[3] || "" };
    else if (f[0] === "p") o = { t: "p", de: f[1], en: f[2], ex: "" };
    if (!o || !o.de) continue;
    o.week = week; o.order = order++;
    if (o.ex && translations[o.ex]) o.exEn = translations[o.ex];
    o.id = o.t + ":" + (o.t === "n" ? o.art + " " : "") + o.de;
    if (seen.has(o.id)) continue;
    seen.add(o.id); words.push(o);
  }
  return { words, weeks };
}
