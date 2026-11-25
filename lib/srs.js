// Anki-style SM-2 scheduling. Grades: 0 Again, 1 Hard, 2 Good, 3 Easy.
export const DAY = 86400000;

export function schedule(prev, g, now = Date.now()) {
  const c = { s: "new", ivl: 0, ease: 2.5, step: 0, reps: 0, lapses: 0, ...(prev || {}) };
  if (c.s === "new" || c.s === "learn") {
    if (g === 0) { c.s = "learn"; c.step = 0; c.due = now + 60000; }
    else if (g === 1) { c.s = "learn"; c.due = now + 5 * 60000; }
    else if (g === 2) {
      if (c.step >= 1) { c.s = "review"; c.ivl = Math.max(1, c.ivl || 1); c.due = now + c.ivl * DAY; }
      else { c.s = "learn"; c.step = 1; c.due = now + 10 * 60000; }
    } else { c.s = "review"; c.ivl = Math.max(4, c.ivl || 0); c.due = now + c.ivl * DAY; }
  } else {
    if (g === 0) { c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); c.s = "learn"; c.step = 0; c.ivl = Math.max(1, Math.round(c.ivl * 0.5)); c.due = now + 10 * 60000; }
    else {
      if (g === 1) { c.ivl = Math.max(c.ivl + 1, c.ivl * 1.2); c.ease = Math.max(1.3, c.ease - 0.15); }
      if (g === 2) c.ivl = Math.max(c.ivl + 1, c.ivl * c.ease);
      if (g === 3) { c.ivl = Math.max(c.ivl + 2, c.ivl * c.ease * 1.3); c.ease += 0.15; }
      c.ivl = Math.min(3650, Math.round(c.ivl));
      c.due = now + c.ivl * DAY;
    }
  }
  return c;
}

export function status(card) {
  if (!card) return "new";
  if (card.s === "learn") return "learning";
  return card.ivl >= 21 ? "mature" : "learned";
}

export function fmtIvl(ms) {
  if (ms < 3600000) return Math.max(1, Math.round(ms / 60000)) + " min";
  if (ms < DAY) return Math.round(ms / 3600000) + " h";
  const d = ms / DAY;
  if (d < 30) return Math.round(d) + " d";
  if (d < 365) return (d / 30).toFixed(1).replace(".0", "") + " mo";
  return (d / 365).toFixed(1) + " y";
}

export function dayKey(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
