"use client";
import { useEffect, useRef, useState } from "react";

// Is a model ready? Asked once per page load; null while unknown.
let known = null;
export function useAiReady() {
  const [ready, setReady] = useState(known);
  useEffect(() => {
    if (known !== null) return;
    fetch("/api/ai").then(r => r.json()).then(s => { known = !!(s.ok && s.model && !s.installing); setReady(known); }).catch(() => setReady(false));
  }, []);
  return ready;
}

// Posts body to url and calls onText with the text so far while the answer streams in
export async function streamAi(url, body, onText, signal) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (!r.ok || (r.headers.get("content-type") || "").includes("json")) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`);
  const reader = r.body.getReader(), dec = new TextDecoder();
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true }); onText(text);
  }
  return text;
}

// "- point" lines from the model become lists; other lines stay paragraphs; **bold** is kept
function Pretty({ text }) {
  const bold = (s) => s.split(/\*\*(.+?)\*\*/g).map((p, i) => i % 2 ? <b key={i}>{p}</b> : p);
  const blocks = [];
  for (const l of text.split("\n").map(l => l.trim()).filter(Boolean)) {
    const item = /^([-*•]|\d+\.)\s+/.test(l) ? l.replace(/^([-*•]|\d+\.)\s+/, "") : null;
    const last = blocks[blocks.length - 1];
    if (item != null) Array.isArray(last) ? last.push(item) : blocks.push([item]);
    else blocks.push(l.replace(/^#+\s*/, ""));
  }
  return blocks.map((b, i) => Array.isArray(b)
    ? <ul key={i}>{b.map((x, j) => <li key={j}>{bold(x)}</li>)}</ul>
    : <p key={i}>{bold(b)}</p>);
}

// The button, then a small chat: the first explanation, "Explain more", and your own follow-up questions.
// body is what the explain route needs; label changes with the situation.
export default function AskAI({ body, label = "Ask AI why" }) {
  const ready = useAiReady();
  const [msgs, setMsgs] = useState([]);           // [{ role: "assistant" | "user", content }]
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [q, setQ] = useState("");
  const ctl = useRef(null), endRef = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);
  if (!ready) return null;

  // extra = {} for the first explanation, { more: true } or { ask } for a follow-up; shown = the question bubble
  const send = async (extra = {}, shown = null) => {
    const history = msgs;
    const base = shown ? [...history, { role: "user", content: shown }] : history;
    setBusy(true); setErr(""); setMsgs([...base, { role: "assistant", content: "" }]);
    ctl.current = new AbortController();
    const show = (t) => setMsgs([...base, { role: "assistant", content: t }]);
    try {
      await streamAi("/api/ai/explain", { ...body, ...extra, history: shown ? history : undefined }, show, ctl.current.signal);
      setQ("");
    } catch (e) {
      if (e.name === "AbortError") return;
      setErr(e.message); setMsgs(history);
    }
    setBusy(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  };
  const askOwn = (e) => { e.preventDefault(); const t = q.trim(); if (t && !busy) send({ ask: t }, t); };

  if (!msgs.length) return (
    <div className="askai">
      <button type="button" className="btn ghost" onClick={() => send()} disabled={busy}><span aria-hidden>✨</span> {label}</button>
      {err && <div className="small fb no">{err}</div>}
    </div>
  );
  return (
    <div className="aibox" aria-live="polite">
      <div className="gtitle">✨ AI teacher</div>
      {msgs.map((m, i) => m.role === "user"
        ? <div key={i} className="aiq">{m.content}</div>
        : m.content ? <div key={i} className="aia"><Pretty text={m.content} /></div>
          : <p key={i} className="muted small thinking">Thinking… this can take up to a minute.</p>)}
      {err && <div className="small fb no">{err}</div>}
      {!busy && <>
        <div className="row aiacts">
          <button type="button" className="btn ghost" onClick={() => send({ more: true }, "Explain it more, please.")}>Explain more</button>
        </div>
        <form className="aiask" onSubmit={askOwn}>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Ask a question about this sentence…"
            aria-label="Ask the AI teacher a question" autoComplete="off" />
          <button className="btn primary" type="submit" disabled={!q.trim()}>Ask</button>
        </form>
        <p className="small muted aifoot">AI can make mistakes. The correct answer above is the checked one.</p>
      </>}
      <div ref={endRef} />
    </div>
  );
}
