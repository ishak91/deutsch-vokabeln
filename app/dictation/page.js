"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { SpeakButton, speak } from "@/components/Audio";
import { UmlautBar } from "@/components/Word";
import { useKeys } from "@/components/useKeys";
import SayIt from "@/components/SayIt";
import { compareGerman } from "@/lib/spoken";
import { LEVEL_NAME, LEVEL_CEFR } from "@/lib/sentences";

// Dictation (B1 Hören): the German voice reads a sentence, the learner types what they hear.
// Checked word by word (capital letters and ß count as small mistakes). No AI needed.
export default function Dictation() {
  const { state, derived, quizResult } = useStore();
  const [bank, setBank] = useState(null), [err, setErr] = useState("");
  const [level, setLevel] = useState("");
  const [item, setItem] = useState(null), [input, setInput] = useState(""), [res, setRes] = useState(null);
  const [score, setScore] = useState({ n: 0, ok: 0 });
  const recent = useRef([]), inputRef = useRef(null);

  useEffect(() => {
    fetch("/api/sentences").then(r => r.json()).then(b => { if (b.error) throw new Error(b.error); setBank(b.sentences); })
      .catch(e => setErr("Couldn't load the sentences: " + e.message));
  }, []);
  const pool = bank ? bank.filter(s => s.week <= derived.curWeek && (!level || s.lv === level)) : [];
  // picks a sentence not seen in the last few, favouring ones written wrong before
  const pick = () => {
    const fresh = pool.filter(s => !recent.current.includes(s.id));
    const list = fresh.length ? fresh : pool;
    const weight = (s) => 1 + Math.min(3, state.quiz["s:" + s.id]?.d?.[1] || 0);
    const total = list.reduce((a, s) => a + weight(s), 0);
    let r = Math.random() * total;
    return list.find(s => (r -= weight(s)) < 0) || list[0] || null;
  };
  // play=true only when called from a click (phones only allow sound after a tap)
  const next = (play) => {
    const s = pick();
    setItem(s); setInput(""); setRes(null);
    if (!s) return;
    recent.current = [...recent.current, s.id].slice(-15);
    if (play) speak(s.de);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (bank) { setItem(null); setRes(null); } }, [bank, level]);

  const check = () => {
    if (!item || res || !input.trim()) return;
    const r = compareGerman(item.de, input, { strictCase: true });
    const ok = r.score >= 90;
    setRes(r); setScore(s => ({ n: s.n + 1, ok: s.ok + (ok ? 1 : 0) }));
    quizResult("s:" + item.id, "d", ok);
  };
  useKeys((e) => { if (res && e.key === "Enter") next(true); });

  if (err) return <div className="alert">{err}</div>;
  if (!bank) return <div className="loading">Loading sentences…</div>;
  const small = res?.parts.filter(p => p.ok === 1).length;

  return (
    <div className="panel">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Dictation</h2>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
          <option value="">All levels</option>
          {["E", "M", "H"].map(l => <option key={l} value={l}>{LEVEL_NAME[l]} ({LEVEL_CEFR[l]})</option>)}
        </select>
      </div>
      <p className="small muted">Listen and write the German sentence exactly. Tap the speaker again to hear it slower. Sentences from weeks 1–{derived.curWeek}.</p>
      {!item ? (
        <div className="card">
          {pool.length ? <button type="button" className="btn primary" onClick={() => next(true)}>▶ Start</button>
            : <p className="muted">No sentences for this level yet.</p>}
        </div>
      ) : (
        <div className="sent">
          <div className="row between small muted">
            <span><span className={"lvtag lv" + item.lv}>{LEVEL_NAME[item.lv]} · {LEVEL_CEFR[item.lv]}</span> Week {item.week}</span>
            <span>{score.n ? `${score.ok} / ${score.n} correct` : ""}</span>
          </div>
          <div className="dictplay">
            <SpeakButton text={item.de} label="Play the sentence (tap again for slower)" />
            <span className="small muted">Play again: tap the speaker</span>
          </div>
          <form className="typebox sentbox" onSubmit={(e) => { e.preventDefault(); check(); }}>
            <input ref={inputRef} type="text" lang="de" value={input} readOnly={!!res} placeholder="Write what you hear…" autoComplete="off" autoCapitalize="off" spellCheck={false}
              aria-label="What you hear, in German" onChange={(e) => setInput(e.target.value)} />
            {!res && <button className="btn primary" type="submit" disabled={!input.trim()}>Check</button>}
          </form>
          {!res && <UmlautBar inputRef={inputRef} onInsert={setInput} />}
          {res && (
            <div className="sentres">
              <div className={"verdict " + (res.score >= 90 ? "right" : res.score >= 60 ? "almost" : "wrong")}>
                {res.score >= 90 ? "Richtig! +2" : res.score >= 60 ? "Almost" : "Not quite"} · {res.score}%
              </div>
              <div className="saywords big2" lang="de">
                {res.parts.map((p, i) => <span key={i} className={p.ok === 2 ? "w2" : p.ok === 1 ? "w1" : "w0"} title={p.got ? `you wrote “${p.got}”` : "missing"}>{p.word}</span>)}
                <SpeakButton small text={item.de} />
              </div>
              {res.parts.some(p => p.ok < 2) && <div className="small muted">You wrote: <span lang="de">{input}</span></div>}
              {small > 0 && <div className="small muted">Orange = small mistake (capital letter, umlaut, ß or one letter).</div>}
              <div className="small"><span className="muted">Meaning:</span> {item.en[0]}</div>
              <SayIt text={item.de} label="Now say it" />
              <div className="row" style={{ justifyContent: "center", marginTop: 10 }}>
                <button type="button" className="btn primary" onClick={() => next(true)} autoFocus>Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
