import { saveSettings } from "@/lib/db";
import { withUser } from "@/lib/session";
export const PUT = withUser(async (req, user) => Response.json(await saveSettings(user.id, await req.json())));
