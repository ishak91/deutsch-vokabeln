"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Is a model ready (and the voice service)? Asked once per page load; null while unknown.
let known = null;
export function useAiStatus() {
  const [st, setSt] = useState(known);
  useEffect(() => {
    if (known !== null) return;
    fetch("/api/ai").then(r => r.json())
      .then(s => { known = { ready: !!(s.ok && s.model && !s.installing), stt: !!s.stt }; setSt(known); })
      .catch(() => setSt({ ready: false, stt: false }));
  }, []);
  return st || { ready: null, stt: false };
}
export const useAiReady = () => useAiStatus().ready;
export const useSttReady = () => useAiStatus().stt;

// Records from the microphone until stop() (or 60 s), then sends it to Whisper on the server.
// onText(text) gets the transcript. Needs HTTPS (or localhost) and the browser's microphone permission.
// lang: "en" or "de". prompt helps Whisper spell words (don't pass it when checking pronunciation).
export function useRecorder({ lang = "en", prompt = "", onText, onError }) {
  const [mode, setMode] = useState("idle");       // idle | rec | wait
  const [secs, setSecs] = useState(0);
  const rec = useRef(null), cb = useRef({}); cb.current = { onText, onError, lang, prompt };
  useEffect(() => () => { const r = rec.current; if (r?.state === "recording") { r.onstop = null; r.stop(); } r?.stream?.getTracks().forEach(t => t.stop()); }, []);
  useEffect(() => {
    if (mode !== "rec") return;
    const t0 = Date.now();
    const t = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); setSecs(s); if (s >= 60) rec.current?.stop(); }, 250);
    return () => clearInterval(t);
  }, [mode]);

  const start = async () => {
    const { onError: err } = cb.current;
    err("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return err("This browser can't record audio here.");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return err("Please allow the microphone for this site, then try again."); }
    const r = new MediaRecorder(stream), chunks = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: r.mimeType || "audio/webm" });
      if (blob.size < 1000) { setMode("idle"); return; }   // a tap without speech
      setMode("wait");
      const { lang, prompt, onText: done, onError: fail } = cb.current;
      try {
        const res = await fetch(`/api/ai/transcribe?lang=${lang}&prompt=${encodeURIComponent(prompt || "")}`, { method: "POST", body: blob, headers: { "Content-Type": blob.type } });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
        if (j.text) done(j.text.trim()); else fail("I didn't hear anything. Try again a bit closer to the mic.");
      } catch (e) { fail(e.message); }
      setMode("idle");
    };
    rec.current = r; setSecs(0); r.start(); setMode("rec");
  };
  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  return { mode, secs, start, stop };
}
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const MicIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" /></svg>;
export { MicIcon, clock };

// Mic button for a text box: the transcript is added to the box, not sent, so the learner can fix it first.
export function Mic({ onText, prompt, disabled, onError, lang = "en", label = "Speak your question" }) {
  const { mode, secs, start, stop } = useRecorder({ lang, prompt, onText, onError });
  if (mode === "rec") return <button type="button" className="aimic rec" onClick={stop} aria-label="Stop recording">■ <span>{clock(secs)}</span></button>;
  return (
    <button type="button" className="aimic" onClick={start} disabled={disabled || mode === "wait"} aria-label={mode === "wait" ? "Turning your voice into text" : label} title={label}>
      {mode === "wait" ? <span className="thinking">…</span> : <MicIcon />}
    </button>
  );
}

// 👍 / 👎 under an AI answer. Admins see the 👎 ones on the AI page, to spot bad answers.
export function Rate({ kind, refId, q, a }) {
  const [v, setV] = useState(0);
  const send = (vote) => {
    if (v) return;
    setV(vote);
    fetch("/api/ai/rate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, ref: refId, q, a, vote }) }).catch(() => {});
  };
  return (
    <div className="airate">
      {v ? <span className="small muted">{v > 0 ? "Thanks!" : "Thanks. This helps find bad answers."}</span> : <>
        <button type="button" onClick={() => send(1)} aria-label="Good answer" title="Good answer">👍</button>
        <button type="button" onClick={() => send(-1)} aria-label="Bad or wrong answer" title="Bad or wrong answer">👎</button>
      </>}
    </div>
  );
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
export function Pretty({ text }) {
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
// more: show the "Explain more" chip. autoStart: ask right away (the page has its own button). placeholder: input hint.
// onOpen: called when the chat opens (e.g. to stop a drill from moving on by itself).
export default function AskAI({ body, label = "Ask AI why", context = "", more = true, autoStart = false, placeholder, onOpen,
  note = "AI can make mistakes. The correct answer on the page is the checked one." }) {
  const { ready, stt } = useAiStatus();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoStart && ready && !msgs.length) send(); }, [autoStart, ready]);
  if (!ready) return null;

  // extra = {} for the first explanation, { more: true } or { ask } for a follow-up; shown = the question bubble
  const send = async (extra = {}, shown = null) => {
    const history = msgs;
    const base = shown ? [...history, { role: "user", content: shown }] : history;
    stick.current = true;
    onOpen?.();
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
    // events inside the panel stay here (React passes them up through the portal to the page, e.g. a drill's form)
    <aside className={"aichat" + (small ? " small" : "")} aria-label="AI teacher"
      onSubmit={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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
            : m.content ? <div key={i} className="aia"><Pretty text={m.content} />
              {!(busy && i === msgs.length - 1) && <Rate kind={body.kind || "sentence"} refId={body.id || body.task || ""} q={msgs[i - 1]?.content || ""} a={m.content} />}</div>
              : <div key={i} className="aia"><p className="muted small thinking">Thinking… this can take up to a minute.</p></div>)}
          {err && <div className="small fb no">{err}</div>}
          <p className="small muted aifoot">{note}</p>
        </div>
        <div className="aifooter">
          {more && <button type="button" className="aichip" disabled={busy} onClick={() => send({ more: true }, "Explain it more, please.")}>Explain more</button>}
          <form className="aiask" onSubmit={askOwn}>
            {stt && <Mic prompt={context} disabled={busy} onError={setErr}
              onText={(t) => { setQ(v => (v.trim() ? v.trim() + " " : "") + t); inputRef.current?.focus(); }} />}
            <input ref={inputRef} type="text" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder={placeholder || (stt ? "Ask, or tap the mic…" : "Ask a question…")}
              aria-label="Ask the AI teacher a question" autoComplete="off" />
            <button className="btn primary" type="submit" disabled={busy || !q.trim()} aria-label="Send">{busy ? "…" : "Ask"}</button>
          </form>
        </div>
      </>}
    </aside>
  );
  return <>{button}{createPortal(panel, document.body)}</>;
}
