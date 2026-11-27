"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

// The button, then a chat panel: fixed on the right on wide screens, a sheet from the bottom on phones.
// The chat scrolls inside the panel, so the page stays where it is. It belongs to one sentence and closes on Next.
// body is what the explain route needs; context is the German sentence shown in the panel header.
export default function AskAI({ body, label = "Ask AI why", context = "" }) {
  const ready = useAiReady();
  const [msgs, setMsgs] = useState([]);           // [{ role: "assistant" | "user", content }]
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [q, setQ] = useState("");
  const [open, setOpen] = useState(false), [small, setSmall] = useState(false);   // small = minimised on a phone
  const ctl = useRef(null), listRef = useRef(null), stick = useRef(true), inputRef = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);
  // the page makes room for the panel while it is open
  useEffect(() => {
    document.body.classList.toggle("ai-open", open && !small);
    document.body.classList.toggle("ai-mini", open && small);
    return () => document.body.classList.remove("ai-open", "ai-mini");
  }, [open, small]);
  // follow the newest text, unless the learner scrolled up to read
  useEffect(() => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [msgs, busy, open, small]);
  if (!ready) return null;

  // extra = {} for the first explanation, { more: true } or { ask } for a follow-up; shown = the question bubble
  const send = async (extra = {}, shown = null) => {
    const history = msgs;
    const base = shown ? [...history, { role: "user", content: shown }] : history;
    stick.current = true;
    setOpen(true); setSmall(false); setBusy(true); setErr(""); setMsgs([...base, { role: "assistant", content: "" }]);
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
    // on a phone the keyboard would cover half the chat, so focus only on wide screens
    if (window.matchMedia("(min-width: 1000px)").matches) inputRef.current?.focus();
  };
  const askOwn = (e) => { e.preventDefault(); const t = q.trim(); if (t && !busy) send({ ask: t }, t); };
  const onScroll = (e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; };

  const button = (
    <div className="askai">
      {!msgs.length
        ? <button type="button" className="btn ghost" onClick={() => send()} disabled={busy}><span aria-hidden>✨</span> {label}</button>
        : !open || small ? <button type="button" className="btn ghost" onClick={() => { setOpen(true); setSmall(false); }}><span aria-hidden>✨</span> Open AI teacher</button>
          : <span className="small muted aiopenhint">✨ The AI teacher is open</span>}
      {err && !open && <div className="small fb no">{err}</div>}
    </div>
  );
  if (!open) return button;

  const panel = (
    <aside className={"aichat" + (small ? " small" : "")} aria-label="AI teacher">
      <header className="aihead">
        <button type="button" className="aititle" onClick={() => setSmall(!small)} aria-expanded={!small}>
          <b>✨ AI teacher</b>{context && <span lang="de">{context}</span>}
        </button>
        <button type="button" className="aix aimin" onClick={() => setSmall(!small)} aria-label={small ? "Show the chat" : "Make the chat smaller"}>{small ? "▴" : "▾"}</button>
        <button type="button" className="aix" onClick={() => setOpen(false)} aria-label="Close the AI teacher">×</button>
      </header>
      {!small && <>
        <div className="aimsgs" ref={listRef} onScroll={onScroll} aria-live="polite">
          {msgs.map((m, i) => m.role === "user"
            ? <div key={i} className="aiq">{m.content}</div>
            : m.content ? <div key={i} className="aia"><Pretty text={m.content} /></div>
              : <div key={i} className="aia"><p className="muted small thinking">Thinking… this can take up to a minute.</p></div>)}
          {err && <div className="small fb no">{err}</div>}
          <p className="small muted aifoot">AI can make mistakes. The correct answer on the page is the checked one.</p>
        </div>
        <div className="aifooter">
          <button type="button" className="aichip" disabled={busy} onClick={() => send({ more: true }, "Explain it more, please.")}>Explain more</button>
          <form className="aiask" onSubmit={askOwn}>
            <input ref={inputRef} type="text" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="Ask about this sentence…"
              aria-label="Ask the AI teacher a question" autoComplete="off" />
            <button className="btn primary" type="submit" disabled={busy || !q.trim()} aria-label="Send">{busy ? "…" : "Ask"}</button>
          </form>
        </div>
      </>}
    </aside>
  );
  return <>{button}{createPortal(panel, document.body)}</>;
}
