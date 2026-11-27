import { getSentences } from "@/lib/db";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export const GET = withUser(async () => Response.json(getSentences()));
