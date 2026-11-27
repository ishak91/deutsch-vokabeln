import { createUser, getConfig, startSession } from "@/lib/auth";
import { sessionCookie } from "@/lib/session";
// Self sign-up, only when an admin has switched it on. New accounts are never admins.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    if (!(await getConfig()).signup) throw new Error("Sign-up is closed. Ask the admin for an account.");
    const user = await createUser({ ...body, admin: false });
    return Response.json({ user }, { headers: { "Set-Cookie": sessionCookie(req, await startSession(user.id)) } });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
