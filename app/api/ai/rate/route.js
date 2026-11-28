import { rate, allow } from "@/lib/ai";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";

// 👍 / 👎 on an AI answer: { kind, ref, q, a, vote: 1 | -1 }. Admins see the 👎 answers on the AI page.
export const POST = withUser(async (req, user) => {
  if (!allow("rate:" + user.id, 200)) return Response.json({ error: "Too many ratings this hour." }, { status: 429 });
  const b = await req.json();
  if (![1, -1].includes(b.vote) || !b.a) return Response.json({ error: "Nothing to rate." }, { status: 400 });
  await rate(user.id, b);
  return Response.json({ ok: true });
});
