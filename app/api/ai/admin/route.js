import { adminInfo, install, remove, chat, streamText } from "@/lib/ai";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";
const ADMIN = { admin: true };

// Admin AI page: service, model on disk, RAM/disk, install progress
export const GET = withUser(async () => Response.json(await adminInfo()), ADMIN);

// { model }: delete the model(s) on disk, then download this one (in the background)
// { test: true }: a short question to see that the model answers and how fast
export const POST = withUser(async (req) => {
  const { model, test } = await req.json();
  if (test) return streamText(chat([{ role: "user", content: "In one short sentence: what does the German word \"Hund\" mean, and which article does it take?" }], { maxTokens: 60 }));
  await install(String(model || "").trim());
  return Response.json({ ok: true });
}, ADMIN);

export const DELETE = withUser(async (req) => {
  await remove(new URL(req.url).searchParams.get("model"));
  return Response.json({ ok: true });
}, ADMIN);
