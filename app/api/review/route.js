import { saveReview } from "@/lib/db";
export async function POST(req) {
  const { id, card, isNew, ok, day, pts } = await req.json();
  if (!id || !card) return Response.json({ error: "id and card required" }, { status: 400 });
  await saveReview(id, card, { isNew, ok, day, pts: Math.max(0, Math.min(20, +pts || 0)) });
  return Response.json({ ok: true });
}
