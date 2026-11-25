import { resetProgress } from "@/lib/db";
export async function POST() { await resetProgress(); return Response.json({ ok: true }); }
