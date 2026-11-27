import { countUsers, getConfig } from "@/lib/auth";
import { legacyCardCount } from "@/lib/db";
import { getUser } from "@/lib/session";
export const dynamic = "force-dynamic";
// Who is logged in. When nobody is, also says whether the first account still has to be set up.
export async function GET(req) {
  const user = await getUser(req);
  if (user) return Response.json({ user });
  const setup = (await countUsers()) === 0;
  return Response.json({ user: null, setup, legacyCards: setup ? await legacyCardCount() : 0, signup: (await getConfig()).signup });
}
