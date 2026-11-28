"use client";
import { useEffect, useRef, useState } from "react";
import AskAI, { useAiReady } from "@/components/AskAI";
import { SpeakButton } from "@/components/Audio";
import { UmlautBar } from "@/components/Word";
import { WRITES } from "@/lib/tasks";

const KEY = (id) => "write-draft-" + id;
const load = (id) => { try { return localStorage.getItem(KEY(id)) || ""; } catch { return ""; } };
const save = (id, v) => { try { localStorage.setItem(KEY(id), v); } catch {} };

// Writing practice (B1 Schreiben): an exam-style task, the learner writes, the AI gives tips (never a score).
// Drafts stay in this browser, so a half-written email isn't lost.
export default function Write() {
  const ai = useAiReady();
  const [task, setTask] = useState(WRITES[0]);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(null);           // { text, n }: the version the AI is looking at
  const ref = useRef(null);
  useEffect(() => { setText(load(task.id)); setSent(null); }, [task]);
  const change = (v) => { setText(v); save(task.id, v); };
  const n = text.split(/\s+/).filter(Boolean).length;
  const target = task.words;

  return (
    <div className="panel">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Writing practice</h2>
        <select value={task.id} onChange={(e) => setTask(WRITES.find(t => t.id === e.target.value))} aria-label="Task">
          {WRITES.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.part}</option>)}
        </select>
      </div>
      <div className="task">
        <div className="small muted">{task.part} · about {target} words</div>
        <p lang="de" className="taskde">{task.de}<SpeakButton small text={task.de} /></p>
        {task.points.length > 0 && <ul lang="de">{task.points.map(p => <li key={p}>{p}</li>)}</ul>}
        <details className="small"><summary>In English</summary><p>{task.en}</p></details>
      </div>
      <textarea ref={ref} className="writebox" lang="de" value={text} onChange={(e) => change(e.target.value)} rows={9}
        placeholder={task.words > 50 ? "Liebe Anna, …" : "Sehr geehrte Damen und Herren, …"} aria-label="Your text" spellCheck={false} />
      <UmlautBar inputRef={ref} onInsert={change} />
      <div className="row between small">
        <span className={n >= target * 0.8 && n <= target * 1.3 ? "fb ok" : "muted"}>{n} / ~{target} words</span>
        <span className="muted">Saved in this browser</span>
      </div>
      {ai ? (
        <div className="row" style={{ marginTop: 10 }}>
          <button type="button" className="btn primary" disabled={n < 5 || sent?.text === text}
            onClick={() => setSent({ text, n: (sent?.n || 0) + 1 })}>{sent ? "Get new tips" : "Get tips from the AI"}</button>
          {sent && sent.text !== text && <span className="small muted">You changed the text. Get new tips for this version.</span>}
        </div>
      ) : ai === false && <p className="small muted">The AI teacher isn't available right now, but you can still write here.</p>}
      {sent && <AskAI key={task.id + sent.n} autoStart more={false} context={task.part} label="Get tips again" placeholder="Ask about your text…" note="AI can make mistakes. Check corrections that look odd."
        body={{ kind: "write", task: task.id, text: sent.text }} />}
      <p className="small muted aifoot">The AI gives tips, not a score. It can be wrong, so check corrections that look odd.</p>
    </div>
  );
}
