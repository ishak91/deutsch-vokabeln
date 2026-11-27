import { transcribe, allow } from "@/lib/ai";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";
const MAX = 10 * 1024 * 1024; // about 10 minutes of compressed speech; the mic button stops after 60 s anyway

// Mic button: the recording as the request body -> { text }. ?lang=en|de, ?prompt= the German sentence (for spelling)
export const POST = withUser(async (req, user) => {
  if (!allow("stt:" + user.id, 120)) return Response.json({ error: "That's a lot of recordings this hour. Try again later." }, { status: 429 });
  const audio = Buffer.from(await req.arrayBuffer());
  if (!audio.length || audio.length > MAX) return Response.json({ error: "The recording is empty or too long." }, { status: 400 });
  const u = new URL(req.url).searchParams;
  const lang = ["en", "de"].includes(u.get("lang")) ? u.get("lang") : "en";
  const { text } = await transcribe(audio, { lang, prompt: u.get("prompt") || "" });
  return Response.json({ text: text || "" });
});
