"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore, wordStatus } from "@/components/Store";
import { schedule, fmtIvl, dayKey } from "@/lib/srs";
import { SpeakButton, speak } from "@/components/Audio";
import { DeWord, Forms, ArticleHint, deFull, Example, UmlautBar } from "@/components/Word";
import { checkTyped } from "@/lib/check";
import { checkMeaning, pickChoices } from "@/lib/choices";
import { useKeys } from "@/components/useKeys";
import AskAI from "@/components/AskAI";
import SayIt from "@/components/SayIt";

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default function Learn() {
  const { data, state, derived, grade, updateSettings } = useStore();
  const [session, setSession] = useState(null);
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedRes, setTypedRes] = useState(null);
  const [dontKnow, setDontKnow] = useState(false);
  // Multiple choice: shown after a wrong typed answer or "I don't know". mc = {opts, picked}
  const [mc, setMc] = useState(null);
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
  useEffect(() => { setShown(false); setTyped(""); setTypedRes(null); setDontKnow(false); setMc(null); if (w && session.dir === "de" && state.settings.autoSpeak) speak(deFull(w)); /* eslint-disable-next-line */ }, [session?.cur, session?.done]);

  // Typed answer: DE->EN checks the English meaning (+5), EN->DE the German word (+10/+5/+2).
  // A wrong answer doesn't reveal yet: it offers multiple choice first.
  const checkAnswer = () => {
    let r;
    if (session.dir === "de") { const m = checkMeaning(typed, w); r = { score: m?.ok ? 10 : 0, pts: m?.ok ? 5 : 0, note: m?.note || "Not quite." }; if (m?.ok) r.note = r.note.replace("+10", "+5"); }
    else { r = checkTyped(typed, w) || { score: 0, note: "Not quite." }; r.pts = r.score; if (!r.score) r.note = "Not quite. Pick the right one:"; }
    setTypedRes(r);
    if (r.score) reveal(); else openChoices();
  };
  const openChoices = () => setMc({ opts: pickChoices(w, data.words, session.dir, derived.curWeek), picked: null });
  const giveUp = () => { if (!mc) return openChoices(); setDontKnow(true); reveal(); };
  const pick = (i) => {
    if (!mc || mc.picked != null || !mc.opts[i]) return;
    setMc({ ...mc, picked: i });
    if (!mc.opts[i].ok) setDontKnow(true);
    reveal();
  };
  const mcOk = mc?.picked != null && mc.opts[mc.picked].ok;
  const reveal = () => { setShown(true); if (w && session.dir === "en" && state.settings.autoSpeak) speak(deFull(w)); };
  // A right multiple-choice pick is a weaker pass than typing it: graded Hard, +2 points
  const doGrade = (g) => {
    const card = grade(w.id, g, mcOk ? 2 : dontKnow ? 0 : typedRes?.pts || 0);
    stateRef.current = { ...stateRef.current, cards: { ...stateRef.current.cards, [w.id]: card } };
    const learning = card.s === "learn" && card.due - Date.now() < 30 * 60000 ? [...session.learning, w.id] : session.learning;
    setSession(next({ ...session, learning, done: session.done + 1 }));
  };
  useKeys((e) => {
    if (!w) return;
    if (mc && !shown) {
      if ("12345".includes(e.key)) pick(+e.key - 1);
      else if (e.key.toLowerCase() === "d") giveUp();
      return;
    }
    if (shown && mcOk && (e.key === " " || e.key === "Enter")) { e.preventDefault(); doGrade(1); return; }
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
        <span>{mc && !shown ? <><kbd>1</kbd>–<kbd>{mc.opts.length}</kbd> pick · <kbd>D</kbd> still don't know</> : <><kbd>Space</kbd> show · <kbd>D</kbd> don't know · <kbd>1</kbd>–<kbd>4</kbd> grade</>}</span>
      </div>
      <div className="panel">
        <div className="card">
          {session.dir === "de" ? (
            <>
              <div className="big"><DeWord w={w} /><SpeakButton text={deFull(w)} /></div>
              <div className="muted small">What does it mean?{w.t === "n" ? " Plural?" : w.t === "v" ? " Präteritum and Perfekt?" : ""} Type the English for points</div>
              {!shown && !mc && (
                <form className="typebox" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) checkAnswer(); }}>
                  <input ref={inputRef} type="text" placeholder="Type the English (optional)" value={typed}
                    onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                  <button className="btn" type="submit" disabled={!typed.trim()}>Check</button>
                </form>
              )}
              {typedRes && <div className={"typeres s" + typedRes.score}><span className="muted" style={{ fontWeight: 400 }}>You typed “{typed}”. </span>{typedRes.note}</div>}
            </>
          ) : (
            <>
              <div className="big">{w.en}</div>
              <div className="muted small">Say it in German{w.t === "n" ? " with the article" : ""}, or type it for points</div>
              {!shown && !mc && (
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
          {mc && (
            <div className="choices" role="group" aria-label="Pick the right answer">
              {!typedRes && <div className="muted small">No problem. Which one is it?</div>}
              {mc.opts.map((o, i) => {
                const cls = mc.picked == null ? "" : o.ok ? " picked-ok" : i === mc.picked ? " picked-no" : " faded";
                return (
                  <button key={o.label} type="button" className={"btn choice" + cls} disabled={mc.picked != null} onClick={() => pick(i)}>
                    <kbd>{i + 1}</kbd><span>{o.label}</span>
                  </button>
                );
              })}
              {mc.picked != null && <div className={"fb " + (mcOk ? "ok" : "no")}>{mcOk ? "Richtig! +2" : mc.opts[mc.picked].note || "Not this one. The right answer is marked green."}</div>}
            </div>
          )}
          {shown && (
            <div style={{ width: "100%" }}>
              <hr className="divider" />
              {session.dir === "en" ? <div className="big"><DeWord w={w} /><SpeakButton text={deFull(w)} /></div> : <div className="meaning">{w.en}</div>}
              <Forms w={w} />
              <ArticleHint w={w} words={data.words} />
              <Example w={w} />
              <SayIt text={deFull(w)} />
              <AskAI key={w.id} context={deFull(w)} label="Ask AI about this word"
                body={{ kind: "card", id: w.id, mode: "learn", answer: typed.trim() ? `${typed.trim()} (${session.dir === "de" ? "English meaning" : "German word"}${typedRes ? typedRes.score ? ", the app accepted it" : ", the app said it is wrong" : ""})` : "" }} />
            </div>
          )}
        </div>
        {!shown && mc ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
            <button key="still" className="btn ghost" onClick={giveUp}>I still don't know</button>
          </div>
        ) : !shown ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
            <button className="btn primary" onClick={reveal}>Show answer</button>
            <button className="btn ghost" onClick={giveUp}>I don't know</button>
          </div>
        ) : mcOk ? (
          <div className="row" style={{ justifyContent: "center", marginTop: 16, flexDirection: "column" }}>
            <p className="small muted" style={{ margin: 0 }}>You recognised it. Picking counts as “Hard”, so it comes back sooner than a typed answer.</p>
            <button className="btn primary" onClick={() => doGrade(1)}>Next · again in {previews[1]}</button>
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
