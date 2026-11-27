import { chat, sentencePrompt, streamText, cached, remember, allow } from "@/lib/ai";
import { getSentences } from "@/lib/content";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";

// "Ask AI why" on the Sentences page: { id, answer, result } -> the explanation as streamed plain text.
// The sentence comes from the database (not the client), so the prompt always has the checked answers.
export const POST = withUser(async (req, user) => {
  const { id, answer = "", result } = await req.json();
  const { sentences, grammar } = await getSentences();
  const s = sentences.find(x => x.id === id);
  if (!s) return Response.json({ error: "Unknown sentence." }, { status: 400 });
  const a = String(answer).trim().slice(0, 300);
  const key = `s|${id}|${a.toLowerCase().replace(/\s+/g, " ")}`;
  const hit = cached(key);
  if (hit) return new Response(hit, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (!allow(user.id)) return Response.json({ error: "That's a lot of questions this hour. Try again later." }, { status: 429 });
  return streamText(chat(sentencePrompt(s, a, result, grammar)), (text) => remember(key, text));
});
