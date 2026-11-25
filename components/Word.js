"use client";
import { useState } from "react";
import { hintAfter } from "@/lib/hints";
import { SpeakButton } from "@/components/Audio";
import { conjugate, PRONOUNS } from "@/lib/conjugate";

export const ARTS = ["der", "die", "das"];
export const deFull = (w) => (w.t === "n" ? `${w.art} ${w.de}` : w.de);

export function DeWord({ w }) {
  if (w.t !== "n") return <>{w.de}</>;
  return <><span className={ARTS.includes(w.art) ? w.art : ""}>{w.art}</span> {w.de}</>;
}

export function Forms({ w }) {
  if (w.t === "n") {
    if (w.pl === "(pl)") return <div className="forms muted">plural-only noun</div>;
    if (!w.pl || w.pl === "-") return <div className="forms muted">no plural</div>;
    return <div className="forms withaudio">Plural <b>die {w.pl}</b><SpeakButton small text={"die " + w.pl.split("/")[0]} label="Listen to the plural" /></div>;
  }
  if (w.t === "v") return (<>
    <div className="forms verbforms">
      <span><small>er/sie</small><b>{w.pres}<SpeakButton small text={"er " + w.pres.split("/")[0]} /></b></span>
      <span><small>Präteritum</small><b>{w.prat}<SpeakButton small text={"er " + w.prat.split("/")[0]} /></b></span>
      <span><small>Perfekt</small><b>{w.perf}<SpeakButton small text={"er " + w.perf.replace(/^(hat|ist)\/(hat|ist)/, "$1").split("/")[0]} /></b></span>
    </div>
    <ConjTable w={w} />
  </>);
  return null;
}

export function ArticleHint({ w, words }) {
  const h = hintAfter(w, words);
  if (!h) return null;
  return (
    <div className={"hint " + h.kind}>
      <div>{h.kind === "exception" ? "⚠️ " : "💡 "}{h.text}</div>
      {h.own && <div>🧠 {h.own}</div>}
    </div>
  );
}

export function UmlautBar({ inputRef, onInsert }) {
  return (
    <div className="uml">
      {["ä", "ö", "ü", "ß"].map(c => (
        <button key={c} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => {
          const i = inputRef.current; if (!i) return;
          const s = i.selectionStart ?? i.value.length, e = i.selectionEnd ?? s;
          const v = i.value.slice(0, s) + c + i.value.slice(e);
          onInsert(v); requestAnimationFrame(() => { i.focus(); i.setSelectionRange(s + 1, s + 1); });
        }}>{c}</button>
      ))}
    </div>
  );
}

export function ScopeSelect({ value, onChange, derived, weeks }) {
  const c = derived.curWeek;
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="cur">This week ({c})</option>
      <option value="upto">Weeks 1–{c}</option>
      <option value="started">Words I've started</option>
      <option value="weak">My weak words</option>
      <option value="all">All weeks</option>
      {derived.weekNums.map(w => <option key={w} value={"w" + w}>Week {w}: {weeks[w]}</option>)}
    </select>
  );
}

// Example sentence with audio and a tap-to-show English translation
export function Example({ w }) {
  const [open, setOpen] = useState(false);
  if (!w.ex) return null;
  return (
    <div className="exwrap">
      <div className="ex">{w.ex}<SpeakButton text={w.ex} label="Listen to the sentence (click again for slower)" /></div>
      {w.exEn && (open
        ? <div className="exen">“{w.exEn}”</div>
        : <button type="button" className="linkbtn" onClick={() => setOpen(true)}>Show English</button>)}
    </div>
  );
}

// Full conjugation for every pronoun, switchable between Präsens, Präteritum and Perfekt
const TENSES = [["pres", "Präsens"], ["prat", "Präteritum"], ["perf", "Perfekt"]];
const SAY_PRON = ["ich", "du", "er", "wir", "ihr", "sie"];
export function ConjTable({ w }) {
  const [tense, setTense] = useState("pres");
  const c = conjugate(w);
  if (!c) return null;
  return (
    <div className="conj">
      <div className="seg" role="tablist">
        {TENSES.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tense === k}
            className={tense === k ? "on" : ""} onClick={() => setTense(k)}>{l}</button>
        ))}
      </div>
      <div className="conjgrid">
        {PRONOUNS.map((p, i) => (
          <div key={p} className="conjrow">
            <span className="pron">{p}</span>
            <b>{c[tense][i]}</b>
            <SpeakButton small text={SAY_PRON[i] + " " + c[tense][i].split("/")[0]} label={`Listen: ${SAY_PRON[i]} ${c[tense][i]}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
