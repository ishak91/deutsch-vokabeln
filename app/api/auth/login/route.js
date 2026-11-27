import { login, startSession } from "@/lib/auth";
import { clientIp, sessionCookie } from "@/lib/session";
export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));
  try {
    const user = await login(username, password, clientIp(req));
    return Response.json({ user }, { headers: { "Set-Cookie": sessionCookie(req, await startSession(user.id)) } });
  } catch (e) { return Response.json({ error: e.message }, { status: 401 }); }
}
