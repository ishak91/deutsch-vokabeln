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

// "- point" lines from the model become a list; **bold** is kept
function Pretty({ text }) {
  const bold = (s) => s.split(/\*\*(.+?)\*\*/g).map((p, i) => i % 2 ? <b key={i}>{p}</b> : p);
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items = lines.filter(l => /^[-*•]\s/.test(l));
  if (items.length && items.length === lines.length) return <ul>{items.map((l, i) => <li key={i}>{bold(l.replace(/^[-*•]\s+/, ""))}</li>)}</ul>;
  return lines.map((l, i) => <p key={i}>{bold(l.replace(/^[-*•]\s+/, "• "))}</p>);
}

// The button plus the answer box. body is what the explain route needs; label changes with the situation.
export default function AskAI({ body, label = "Ask AI why" }) {
  const ready = useAiReady();
  const [text, setText] = useState(""), [state, setState] = useState("idle"), [err, setErr] = useState("");
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);
  if (!ready) return null;

  const ask = async () => {
    setState("asking"); setErr(""); setText("");
    ctl.current = new AbortController();
    try { await streamAi("/api/ai/explain", body, setText, ctl.current.signal); setState("done"); }
    catch (e) { if (e.name !== "AbortError") { setErr(e.message); setState("idle"); } }
  };

  if (state === "idle") return (
    <div className="askai">
      <button type="button" className="btn ghost" onClick={ask}><span aria-hidden>✨</span> {label}</button>
      {err && <div className="small fb no">{err}</div>}
    </div>
  );
  return (
    <div className="aibox" aria-live="polite">
      <div className="gtitle">✨ AI teacher</div>
      {text ? <Pretty text={text} /> : <p className="muted small thinking">Thinking… the small server can take up to a minute.</p>}
      {state === "done" && <p className="small muted aifoot">AI can make mistakes. The correct answer above is the checked one.</p>}
    </div>
  );
}
