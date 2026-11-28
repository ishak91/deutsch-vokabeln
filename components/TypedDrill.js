"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, scopeWords, pickWeighted } from "@/components/Store";
import { SpeakButton, speak } from "@/components/Audio";
import { DeWord, ScopeSelect, UmlautBar, deFull, Example, ConjTable } from "@/components/Word";
import { useKeys } from "@/components/useKeys";
import AskAI from "@/components/AskAI";

// Generic typed drill. fields: [{key, label, answer(w), check(input, w) -> {ok, note}}]
export default function TypedDrill({ title, kind, filter, fields, extraControls, intro, sayAfter }) {
  const { data, state, derived, quizResult } = useStore();
  const [scope, setScope] = useState("cur");
  const [item, setItem] = useState(null);
  const [vals, setVals] = useState({});
  const [res, setRes] = useState(null);
  const [score, setScore] = useState({ n: 0, ok: 0 });
  const refs = useRef({});

  const nextItem = (avoid) => {
    setItem(pickWeighted(scopeWords(scope, data, state, derived).filter(filter), kind, state.quiz, avoid));
    setVals({}); setRes(null);
    setTimeout(() => refs.current[fields[0]?.key]?.focus(), 0);
  };
  const fieldKeys = fields.map(f => f.key).join();
  useEffect(() => { nextItem(); setScore({ n: 0, ok: 0 }); /* eslint-disable-next-line */ }, [scope, fieldKeys]);

  const submit = () => {
    if (res) return nextItem(item.id);
    const r = Object.fromEntries(fields.map(f => [f.key, f.check(vals[f.key] || "", item)]));
    const all = Object.values(r).every(x => x.ok);
    setRes(r); setScore(s => ({ n: s.n + 1, ok: s.ok + (all ? 1 : 0) }));
    quizResult(item.id, kind, all);
    if (sayAfter) speak(sayAfter(item));
  };
  useKeys((e) => { if (res && e.key === "Enter") submit(); });

  return (
    <div className="panel">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div className="row">{extraControls}<ScopeSelect value={scope} onChange={setScope} derived={derived} weeks={data.weeks} /></div>
      </div>
      {intro && <p className="small muted" style={{ marginTop: 10 }}>{intro}</p>}
      {!item ? <p className="muted" style={{ marginTop: 16 }}>Nothing to drill in this selection yet.</p> : (
        <div className="card">
          <div className="muted small">{score.n ? `${score.ok} / ${score.n} correct` : " "}</div>
          <div className="big"><DeWord w={item} /><SpeakButton text={deFull(item)} /></div>
          <div className="muted">{item.en}</div>
          <form className="inputs" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {fields.map((f, i) => (
              <div key={f.key}>
                <label htmlFor={"in-" + f.key}>{f.label}</label>
                <input id={"in-" + f.key} type="text" autoComplete="off" autoCapitalize="off" spellCheck={false} ref={el => (refs.current[f.key] = el)}
                  value={vals[f.key] || ""} readOnly={!!res} onChange={(e) => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !res && i < fields.length - 1) { e.preventDefault(); refs.current[fields[i + 1].key]?.focus(); } }} />
                {!res && <UmlautBar inputRef={{ get current() { return refs.current[f.key]; } }} onInsert={(v) => setVals(x => ({ ...x, [f.key]: v }))} />}
                {res && <div className={"fb small " + (res[f.key].ok ? "ok" : "no")}>{res[f.key].ok ? "✓ " : "✗ "}{f.answer(item)}<SpeakButton small text={f.say ? f.say(item) : f.answer(item)} />{res[f.key].note && <span className="muted" style={{ fontWeight: 400 }}> · {res[f.key].note}</span>}</div>}
              </div>
            ))}
            {res && item.t === "v" && <ConjTable w={item} />}
            {res && <Example w={item} />}
            {res && <AskAI key={item.id} context={deFull(item)} label={Object.values(res).every(x => x.ok) ? "Ask AI how these forms work" : "Ask AI why"}
              body={{ kind: "card", id: item.id, mode: kind === "p" ? "plural" : "verb",
                answer: fields.map(f => `${f.label} "${vals[f.key] || ""}" (${res[f.key].ok ? "right" : "wrong"})`).join("; ") }} />}
            <div><button className="btn primary" type="submit">{res ? "Next →" : "Check"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
