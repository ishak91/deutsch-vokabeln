import { exportState } from "@/lib/db";
import { withUser } from "@/lib/session";
import { dayKey } from "@/lib/srs";
export const dynamic = "force-dynamic";
export const GET = withUser(async (req, user) => new Response(JSON.stringify(await exportState(user.id), null, 1), {
  headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="german-progress-${user.id}-${dayKey()}.json"` },
}));
