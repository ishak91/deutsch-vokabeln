import { getSentences } from "@/lib/content";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export const GET = withUser(async () => Response.json(await getSentences()));
