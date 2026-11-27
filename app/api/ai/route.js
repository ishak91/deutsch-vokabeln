import { status } from "@/lib/ai";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";

// Is the AI ready? { ok, model, installing }. The UI only shows AI buttons when a model is ready.
export const GET = withUser(async () => Response.json(await status()));
