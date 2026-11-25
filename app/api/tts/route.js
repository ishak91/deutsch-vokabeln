// Proxies to the Piper German TTS service (see /tts). Audio is cached there and in the browser.
export const dynamic = "force-dynamic";
const TTS_URL = process.env.TTS_URL || "http://localhost:5002";
export async function GET(req) {
  const text = new URL(req.url).searchParams.get("text")?.slice(0, 300);
  if (!text) return new Response("text required", { status: 400 });
  try {
    const r = await fetch(`${TTS_URL}/tts?text=${encodeURIComponent(text)}`);
    if (!r.ok) throw new Error("tts " + r.status);
    return new Response(r.body, { headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new Response("TTS service unavailable", { status: 503 });
  }
}
