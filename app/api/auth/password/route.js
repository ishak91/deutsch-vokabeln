import { changeOwnPassword, startSession } from "@/lib/auth";
import { sessionCookie, withUser } from "@/lib/session";
// Changing the password logs out every device, then logs this one back in.
export const POST = withUser(async (req, user) => {
  const { current, next } = await req.json();
  await changeOwnPassword(user.id, current, next);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(req, await startSession(user.id)) } });
});
