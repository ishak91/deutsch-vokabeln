import { importState } from "@/lib/db";
export async function POST(req) {
  try { return Response.json({ ok: true, cards: await importState(await req.json()) }); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
