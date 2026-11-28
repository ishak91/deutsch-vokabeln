"use client";
import { useEffect, useRef, useState } from "react";
import { useAiStatus, streamAi, Mic, Rate, Pretty } from "@/components/AskAI";
import { SpeakButton, speak } from "@/components/Audio";
import { UmlautBar } from "@/components/Word";
import { TALKS } from "@/lib/tasks";

// A reply is German, then "EN: translation", maybe "Tipp: correction". Works on half-streamed text too.
function parse(text) {
  const de = [], en = [], tip = [];
  for (const l of text.split("\n").map(l => l.trim()).filter(Boolean)) {
    if (/^\**EN\**\s*:/i.test(l)) en.push(l.replace(/^\**EN\**\s*:\s*/i, ""));
    else if (/^\**Tipp?\**\s*:/i.test(l)) tip.push(l.replace(/^\**Tipp?\**\s*:\s*/i, ""));
    else de.push(l.replace(/\*\*/g, ""));
  }
  return { de: de.join(" "), en: en.join(" "), tip: tip.join(" ") };
}

// Speaking partner (B1 Sprechen): the AI plays a role and answers in simple German, read aloud by the German voice.
// The learner speaks (Whisper, German) or types. At the end the AI gives feedback in English.
export default function Speak() {
  const { ready, stt } = useAiStatus();
  const [task, setTask] = useState(null);
  const [msgs, setMsgs] = useState([]);              // [{ role, content, feedback? }]
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [q, setQ] = useState("");
  const [showEn, setShowEn] = useState(true), [voice, setVoice] = useState(true);
  const ctl = useRef(null), listRef = useRef(null), inputRef = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, busy]);

  // extra: {} opens the talk; { ask } is the learner's turn; { feedback: true } ends it with feedback
  const send = async (t, history, extra = {}, shown = null) => {
    const base = shown ? [...history, { role: "user", content: shown }] : history;
    setBusy(true); setErr(""); setMsgs([...base, { role: "assistant", content: "", feedback: !!extra.feedback }]);
    ctl.current?.abort(); ctl.current = new AbortController();
    try {
      const text = await streamAi("/api/ai/explain", { kind: "talk", task: t.id, ...extra, history: history.length ? history.filter((m, i) => !m.feedback && !history[i + 1]?.feedback) : undefined },
        (text) => setMsgs([...base, { role: "assistant", content: text, feedback: !!extra.feedback }]), ctl.current.signal);
      setQ("");
      if (voice && !extra.feedback) speak(parse(text).de);
    } catch (e) {
      if (e.name === "AbortError") return;
      setErr(e.message); setMsgs(history);
    }
    setBusy(false);
  };
  const begin = (t) => { setTask(t); setMsgs([]); setQ(""); send(t, []); };
  const say = (e) => { e.preventDefault(); const t = q.trim(); if (t && !busy) send(task, msgs, { ask: t }, t); };
  const turns = msgs.filter(m => m.role === "user").length;

  if (ready === null) return <div className="loading">Loading…</div>;
  if (!ready) return <div className="panel"><h2>Speaking partner</h2><p className="muted">The AI teacher isn't available right now. An admin can install a model on the AI page.</p></div>;

  if (!task) return (
    <div className="panel">
      <h2>Speaking partner</h2>
      <p className="small muted">Practise speaking for the B1 exam. The AI plays a role and answers in simple German, out loud.
        {stt ? " Tap the mic and speak German, or type." : " Type your answers in German."} At the end, ask for feedback on your German.</p>
      <div className="tasks">
        {TALKS.map(t => (
          <button key={t.id} type="button" className="taskcard" onClick={() => begin(t)}>
            <span className="small muted">{t.part}</span>
            <b lang="de">{t.title}</b>
            <span className="small">{t.en}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="panel talk">
      <div className="row between">
        <div><div className="small muted">{task.part}</div><h2 style={{ margin: 0 }} lang="de">{task.title}</h2></div>
        <button type="button" className="btn ghost" onClick={() => { ctl.current?.abort(); setTask(null); setBusy(false); }}>Other situation</button>
      </div>
      <p className="small muted">{task.en}</p>
      <div className="row small">
        <label className="check"><input type="checkbox" checked={showEn} onChange={(e) => setShowEn(e.target.checked)} /> Show English</label>
        <label className="check"><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Read replies aloud</label>
      </div>
      <div className="talkmsgs" ref={listRef} aria-live="polite">
        {msgs.map((m, i) => {
          if (m.role === "user") return <div key={i} className="aiq" lang="de">{m.content}</div>;
          if (!m.content) return <div key={i} className="aia"><p className="muted small thinking">{m.feedback ? "Looking at your German…" : "Thinking…"} this can take up to a minute.</p></div>;
          const done = !(busy && i === msgs.length - 1);
          if (m.feedback) return <div key={i} className="aia"><div className="gtitle">Feedback</div><Pretty text={m.content} />{done && <Rate kind="talk" refId={task.id} q="feedback" a={m.content} />}</div>;
          const p = parse(m.content);
          return (
            <div key={i} className="aia">
              <p lang="de" className="talkde">{p.de}{done && p.de && <SpeakButton small text={p.de} />}</p>
              {showEn && p.en && <p className="small muted">{p.en}</p>}
              {p.tip && <p className="small talktip">💡 {p.tip}</p>}
              {done && <Rate kind="talk" refId={task.id} q={msgs[i - 1]?.content || ""} a={m.content} />}
            </div>
          );
        })}
        {err && <div className="small fb no">{err}</div>}
      </div>
      <form className="aiask talkask" onSubmit={say}>
        {stt && <Mic lang="de" prompt={task.title} disabled={busy} onError={setErr} label="Speak German"
          onText={(t) => { setQ(v => (v.trim() ? v.trim() + " " : "") + t); inputRef.current?.focus(); }} />}
        <input ref={inputRef} type="text" lang="de" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500}
          placeholder={stt ? "Tap the mic and speak, or type German…" : "Type your answer in German…"} aria-label="Your answer in German" autoComplete="off" />
        <button className="btn primary" type="submit" disabled={busy || !q.trim()}>{busy ? "…" : "Send"}</button>
      </form>
      <UmlautBar inputRef={inputRef} onInsert={setQ} />
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className="btn" disabled={busy || turns < 2} onClick={() => send(task, msgs, { feedback: true }, "How was my German?")}
          title={turns < 2 ? "Answer at least twice first" : ""}>Feedback on my German</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => begin(task)}>Start again</button>
      </div>
      <p className="small muted aifoot">AI can make mistakes, especially in the tips. Use them as hints, not as rules.</p>
    </div>
  );
}
