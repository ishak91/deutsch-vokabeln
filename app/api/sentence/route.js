import { getSentences, saveSentence } from "@/lib/db";
import { withUser } from "@/lib/session";
import { LEVELS, pointsFor } from "@/lib/sentences";

// Saves one sentence answer. Points are worked out here from the sentence's own level, not taken from the client.
export const POST = withUser(async (req, user) => {
  const { id, result, p, day, level, run, own } = await req.json();
  const s = getSentences().sentences.find(x => x.id === id);
  if (!s || !["right", "almost", "wrong"].includes(result) || !p || !/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return Response.json({ error: "bad request" }, { status: 400 });
  const lv = LEVELS.includes(level) ? level : null;
  await saveSentence(user.id, id, p, { day, ok: result === "right", pts: pointsFor(s.lv, result), level: lv, run: /^[RAW]{0,3}$/.test(run || "") ? run : "", own: result === "right" ? own : null });
  return Response.json({ ok: true });
});
