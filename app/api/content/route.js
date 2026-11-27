import { importContent, exportContent, EXAMPLE } from "@/lib/content";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";

// GET: download all content as JSON (?example=1 for a small sample file). Anyone logged in may download.
export const GET = withUser(async (req) => {
  const example = new URL(req.url).searchParams.has("example");
  const body = JSON.stringify(example ? EXAMPLE : await exportContent(), null, 2);
  const name = example ? "content-example.json" : `deutsch-vokabeln-content-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}"` } });
});

// POST: import a content file (admin only, content is shared). ?save=1 saves; without it, only a preview is returned.
export const POST = withUser(async (req) => {
  const save = new URL(req.url).searchParams.get("save") === "1";
  return Response.json(await importContent(await req.json(), { dry: !save }));
}, { admin: true });
