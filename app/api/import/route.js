import { importState } from "@/lib/db";
import { withUser } from "@/lib/session";
export const POST = withUser(async (req, user) => Response.json({ ok: true, cards: await importState(user.id, await req.json()) }));
