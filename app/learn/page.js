"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore, wordStatus } from "@/components/Store";
import { schedule, fmtIvl, dayKey } from "@/lib/srs";
import { SpeakButton, speak } from "@/components/Audio";
import { DeWord, Forms, ArticleHint, deFull, Example, UmlautBar } from "@/components/Word";
import { checkTyped } from "@/lib/check";
import { useKeys } from "@/components/useKeys";

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default function Learn() {
  const { data, state, derived, grade, updateSettings } = useStore();
  const [session, setSession] = useState(null);
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedRes, setTypedRes] = useState(null);
  const [dontKnow, setDontKnow] = useState(false);
  const inputRef = useRef(null);
  const stateRef = useRef(state); stateRef.current = state;

  const build = () => {
    const s = stateRef.current, now = Date.now();
    const due = shuffle(Object.keys(s.cards).filter(id => derived.byId[id] && s.cards[id].due <= now));
    const left = Math.max(0, s.settings.newPerDay - (s.log[dayKey()]?.nw || 0));
    const news = data.words.filter(w => w.week <= derived.curWeek && !s.cards[w.id]).slice(0, left).map(w => w.id);
    return next({ queue: [...due, ...news], learning: [], cur: null, done: 0 });
  };
  const next = (S) => {
    const s = stateRef.current, now = Date.now();
    const learning = [...S.learning].sort((a, b) => s.cards[a].due - s.cards[b].due);
    const queue = [...S.queue];
    let id = null;
    if (learning.length && s.cards[learning[0]].due <= now) id = learning.shift();
    else if (queue.length) id = queue.shift();
    else if (learning.length) id = learning.shift();
    const w = id && derived.byId[id];
    const dirSet = s.settings.direction;
    const dir = !w ? null : w.t === "p" ? "en" : dirSet === "mixed" ? (Math.random() < 0.5 ? "de" : "en") : dirSet;
    return { ...S, queue, learning, cur: id, dir };
  };

  useEffect(() => { setSession(build()); /* eslint-disable-next-line */ }, []);
  const w = session?.cur ? derived.byId[session.cur] : null;
  useEffect(() => { setShown(false); setTyped(""); setTypedRes(null); setDontKnow(false); if (w && session.dir === "de" && state.settings.autoSpeak) speak(deFull(w)); /* eslint-disable-next-line */ }, [session?.cur, session?.done]);

  const checkAnswer = () => {
    const r = checkTyped(typed, w);
    setTypedRes(r || { score: 0, note: "Not quite." });
    reveal();
  };
  const giveUp = () => { setDontKnow(true); reveal(); };
  const reveal = () => { setShown(true); if (w && session.dir === "en" && state.settings.autoSpeak) speak(deFull(w)); };
  const doGrade = (g) => {
    const card = grade(w.id, g, typedRes?.score || 0);
    stateRef.current = { ...stateRef.current, cards: { ...stateRef.current.cards, [w.id]: card } };
    const learning = card.s === "learn" && card.due - Date.now() < 30 * 60000 ? [...session.learning, w.id] : session.learning;
    setSession(next({ ...session, learning, done: session.done + 1 }));
  };
  useKeys((e) => {
    if (!w) return;
    if (!shown && e.key.toLowerCase() === "d") { giveUp(); return; }
    if (shown && dontKnow && (e.key === " " || e.key === "Enter")) { e.preventDefault(); doGrade(0); return; }
    if (!shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); }
    else if (shown && "1234".includes(e.key)) doGrade(+e.key - 1);
    else if (shown && (e.key === " " || e.key === "Enter")) { e.preventDefault(); doGrade(2); }
  });

  const previews = useMemo(() => (w ? [0, 1, 2, 3].map(g => fmtIvl(schedule(state.cards[w.id], g).due - Date.now())) : []), [w, state.cards]);

  if (!session) return null;
  if (!w) {
    const left = Math.max(0, state.settings.newPerDay - (state.log[dayKey()]?.nw || 0));
    return (
      <div className="panel card">
        <div className="big">🎉 Fertig!</div>
        <p className="muted">No more cards due right now.{left === 0 ? " You've done today's new words." : ""}</p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn primary" href="/articles">Drill articles</Link>
          <button className="btn" onClick={() => { updateSettings({ newPerDay: (state.log[dayKey()]?.nw || 0) + 10 }); stateRef.current = { ...stateRef.current, settings: { ...stateRef.current.settings, newPerDay: (state.log[dayKey()]?.nw || 0) + 10 } }; setSession(build()); }}>Learn 10 more</button>
        </div>
      </div>
    );
  }
  const st = wordStatus(state, w.id);
  const remaining = session.queue.length + session.learning.length + 1;
  return (
    <>
      <div className="row between small muted" style={{ marginBottom: 10 }}>
        <span>{remaining} left · week {w.week} · <span className={"tag " + st}>{st}</span></span>
        <span><kbd>Space</kbd> show · <kbd>D</kbd> don't know · <kbd>1</kbd>–<kbd>4</kbd> grade</span>
      </div>
      <div className="panel">
        <div className="card">
          {session.dir === "de" ? (
            <>
              <div className="big"><DeWord w={w} /><SpeakButton text={deFull(w)} /></div>
              <div className="muted small">What does it mean?{w.t === "n" ? " Plural?" : w.t === "v" ? " Präteritum and Perfekt?" : ""}</div>
            </>
          ) : (
            <>
              <div className="big">{w.en}</div>
              <div className="muted small">Say it in German{w.t === "n" ? " with the article" : ""}, or type it for points</div>
              {!shown && (
                <>
                  <form className="typebox" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) checkAnswer(); }}>
                    <input ref={inputRef} type="text" placeholder={w.t === "n" ? "e.g. der Tisch (optional)" : "Type the German (optional)"} value={typed}
                      onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                    <button className="btn" type="submit" disabled={!typed.trim()}>Check</button>
                  </form>
                  <UmlautBar inputRef={inputRef} onInsert={setTyped} />
                </>
              )}
              {typedRes && <div className={"typeres s" + typedRes.score}>{typed && <span className="muted" style={{ fontWeight: 400 }}>You typed “{typed}”. </span>}{typedRes.note}</div>}
            </>
          )}
          {shown && (
            <div style={{ width: "100%" }}>
              <hr className="divider" />
              {session.dir === "en" ? <div className="big"><DeWord w={w} /><SpeakButton text={deFull(w)} /></div> : <div className="meaning">{w.en}</div>}
              <Forms w={w} />
              <ArticleHint w={w} words={data.words} />
              <Example w={w} />
            </div>
          )}
        </div>
        {!shown ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
            <button className="btn primary" onClick={reveal}>Show answer</button>
            <button className="btn ghost" onClick={giveUp}>I don't know</button>
          </div>
        ) : dontKnow ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 16, flexDirection: "column" }}>
            <p className="small muted" style={{ margin: 0 }}>No problem. Read it, listen to it, and I'll ask you again in a minute.</p>
            <button className="btn primary" onClick={() => doGrade(0)}>Got it, ask me again later</button>
          </div>
        ) : (
          <div className="grades">
            {["Again", "Hard", "Good", "Easy"].map((l, g) => (
              <button key={l} className={"btn g" + g + (typedRes && ((typedRes.score >= 10 && g === 2) || (typedRes.score < 5 && g === 0)) ? " suggest" : "")} onClick={() => doGrade(g)}>{l}<small>{previews[g]}</small></button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
