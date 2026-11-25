import { saveQuiz } from "@/lib/db";
export async function POST(req) {
  const { id, kind, ok, day } = await req.json();
  if (!id || !["a", "p", "v"].includes(kind)) return Response.json({ error: "bad request" }, { status: 400 });
  await saveQuiz(id, kind, !!ok, day, ok ? 2 : 0);
  return Response.json({ ok: true });
}
