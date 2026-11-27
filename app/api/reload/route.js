import { seedWords } from "@/lib/db";
import { withUser } from "@/lib/session";
// The word list is shared by everyone, so only an admin reloads it
export const POST = withUser(async () => Response.json(await seedWords(true)), { admin: true });
