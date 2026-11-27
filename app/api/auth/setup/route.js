import { countUsers, createUser, startSession } from "@/lib/auth";
import { sessionCookie } from "@/lib/session";
// Creates the first account (admin). It takes over the progress saved before accounts existed.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    if ((await countUsers()) > 0) throw new Error("Setup is already done. Please log in.");
    const user = await createUser({ ...body, admin: true });
    return Response.json({ user }, { headers: { "Set-Cookie": sessionCookie(req, await startSession(user.id)) } });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
