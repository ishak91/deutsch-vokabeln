import { resetProgress } from "@/lib/db";
import { withUser } from "@/lib/session";
export const POST = withUser(async (req, user) => { await resetProgress(user.id); return Response.json({ ok: true }); });
