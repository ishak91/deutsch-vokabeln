import { endSession } from "@/lib/auth";
import { sessionCookie, tokenOf } from "@/lib/session";
export async function POST(req) {
  await endSession(tokenOf(req));
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(req, null) } });
}
