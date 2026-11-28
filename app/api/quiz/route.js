import { saveQuiz } from "@/lib/db";
import { withUser } from "@/lib/session";
// kinds: a article, p plural, v verb forms, d dictation (id "s:<sentence id>")
export const POST = withUser(async (req, user) => {
  const { id, kind, ok, day } = await req.json();
  if (!id || !["a", "p", "v", "d"].includes(kind)) return Response.json({ error: "bad request" }, { status: 400 });
  await saveQuiz(user.id, id, kind, !!ok, day, ok ? 2 : 0);
  return Response.json({ ok: true });
});
