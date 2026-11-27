import { syncFromFiles } from "@/lib/content";
import { withUser } from "@/lib/session";
// Adds new entries from the data/ files to the shared database (admin only). Imported entries are kept as they are.
export const POST = withUser(async () => Response.json(await syncFromFiles(true)), { admin: true });
