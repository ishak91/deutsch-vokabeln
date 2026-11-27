import { getState } from "@/lib/db";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export const GET = withUser(async (req, user) => Response.json(await getState(user.id)));
