import { saveReview } from "@/lib/db";
import { withUser } from "@/lib/session";
export const POST = withUser(async (req, user) => {
  const { id, card, isNew, ok, day, pts } = await req.json();
  if (!id || !card) return Response.json({ error: "id and card required" }, { status: 400 });
  const { _id, u, k, ...clean } = card; // never let the client pick the owner
  await saveReview(user.id, id, clean, { isNew, ok, day, pts: Math.max(0, Math.min(20, +pts || 0)) });
  return Response.json({ ok: true });
});
