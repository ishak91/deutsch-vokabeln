import { exportState } from "@/lib/db";
import { dayKey } from "@/lib/srs";
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(JSON.stringify(await exportState(), null, 1), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="german-progress-${dayKey()}.json"` },
  });
}
