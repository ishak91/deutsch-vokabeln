"use client";
import { useState } from "react";
import { useSttReady, useRecorder, MicIcon, clock } from "./AskAI";
import { compareGerman } from "@/lib/spoken";
import { SpeakButton } from "./Audio";

// Pronunciation check: the learner says the German, Whisper writes down what it heard, and the app compares
// it word by word (no AI model judges it). Whisper gets no hint of the right sentence, so it can't "help".
export default function SayIt({ text, label = "Say it" }) {
  const stt = useSttReady();
  const [res, setRes] = useState(null), [err, setErr] = useState("");
  const { mode, secs, start, stop } = useRecorder({
    lang: "de", onError: setErr,
    onText: (heard) => setRes({ heard, ...compareGerman(text, heard) }),
  });
  if (!stt || !text) return null;
  const verdict = !res ? null : res.score >= 90 ? ["ok", "Sehr gut! That was clear."]
    : res.score >= 60 ? ["almost", "Good. Practise the words in red, then try again."]
      : ["no", "Listen once more, then say it slowly."];
  return (
    <div className="sayit">
      <div className="row">
        {mode === "rec"
          ? <button type="button" className="btn sayrec" onClick={stop}>■ Stop <span className="small">{clock(secs)}</span></button>
          : <button type="button" className="btn ghost" onClick={() => { setRes(null); start(); }} disabled={mode === "wait"}>
            {mode === "wait" ? <span className="thinking">Listening back…</span> : <><MicIcon /> {res ? "Try again" : label}</>}
          </button>}
        {mode === "idle" && !res && <span className="small muted">Say the German, then tap Stop.</span>}
      </div>
      {err && <div className="small fb no">{err}</div>}
      {res && (
        <div className={"sayres " + verdict[0]}>
          <div className="saywords" lang="de">
            {res.parts.map((p, i) => <span key={i} className={p.ok === 2 ? "w2" : p.ok === 1 ? "w1" : "w0"} title={p.ok === 2 ? "clear" : p.got ? `heard “${p.got}”` : "not heard"}>{p.word}</span>)}
            <SpeakButton small text={text} />
          </div>
          <div className="small"><b>{res.score}%</b> · {verdict[1]}</div>
          <div className="small muted">I heard: <span lang="de">“{res.heard}”</span></div>
        </div>
      )}
    </div>
  );
}
