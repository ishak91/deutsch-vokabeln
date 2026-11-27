import { chat, sentencePrompt, followUps, MORE, streamText, cached, remember, allow } from "@/lib/ai";
import { getSentences } from "@/lib/content";
import { withUser } from "@/lib/session";
export const dynamic = "force-dynamic";

// "Ask AI why" on the Sentences page: { id, answer, result } -> the explanation as streamed plain text.
// Follow-ups add { history: [answer, question, answer, ...], ask: "question" } or { more: true } ("Explain more").
// The sentence comes from the database (not the client), so the prompt always has the checked answers.
export const POST = withUser(async (req, user) => {
  const { id, answer = "", result, history, ask, more } = await req.json();
  const { sentences, grammar } = await getSentences();
  const s = sentences.find(x => x.id === id);
  if (!s) return Response.json({ error: "Unknown sentence." }, { status: 400 });
  const a = String(answer).trim().slice(0, 300);
  const q = more ? MORE : String(ask || "").trim().slice(0, 500);
  const prompt = sentencePrompt(s, a, result, grammar);
  const key = `s|${id}|${a.toLowerCase().replace(/\s+/g, " ")}`;
  if (!q) {  // the first explanation is the same for everyone with the same answer, so it is cached
    const hit = cached(key);
    if (hit) return new Response(hit, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  if (!allow(user.id)) return Response.json({ error: "That's a lot of questions this hour. Try again later." }, { status: 429 });
  if (!q) return streamText(chat(prompt), (text) => remember(key, text));
  const past = followUps(history);
  if (!past.length) return Response.json({ error: "Ask for the explanation first." }, { status: 400 });
  return streamText(chat([...prompt, ...past, { role: "user", content: q }], { maxTokens: 500 }));
});
