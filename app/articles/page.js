"use client";
import { useEffect, useRef, useState } from "react";
import { useStore, scopeWords, pickWeighted } from "@/components/Store";
import { speak } from "@/components/Audio";
import { ArticleHint, ARTS, ScopeSelect } from "@/components/Word";
import { hintBefore } from "@/lib/hints";
import { useKeys } from "@/components/useKeys";
import AskAI from "@/components/AskAI";

export default function Articles() {
  const { data, state, derived, quizResult } = useStore();
  const [scope, setScope] = useState("cur");
  const [item, setItem] = useState(null);
  const [picked, setPicked] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState({ n: 0, ok: 0 });
  const timer = useRef();

  const pool = () => scopeWords(scope, data, state, derived).filter(w => w.t === "n" && ARTS.includes(w.art) && w.pl !== "(pl)");
  const nextItem = (avoid) => { clearTimeout(timer.current); setItem(pickWeighted(pool(), "a", state.quiz, avoid)); setPicked(null); setShowHint(false); };
  useEffect(() => { nextItem(); setScore({ n: 0, ok: 0 }); /* eslint-disable-next-line */ }, [scope]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const answer = (a) => {
    if (picked || !item) return;
    const ok = a === item.art;
    setPicked(a); setScore(s => ({ n: s.n + 1, ok: s.ok + (ok ? 1 : 0) }));
    quizResult(item.id, "a", ok);
    speak(item.art + " " + item.de);
    if (ok) { const id = item.id; timer.current = setTimeout(() => nextItem(id), 1800); }
  };
  useKeys((e) => {
    if (!picked && "123".includes(e.key)) answer(ARTS[+e.key - 1]);
    else if (!picked && e.key.toLowerCase() === "h") setShowHint(true);
    else if (picked && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); nextItem(item?.id); }
  });

  const ok = picked && picked === item.art;
  return (
    <>
      <div className="panel">
        <div className="row between">
          <h2 style={{ margin: 0 }}>der, die oder das?</h2>
          <ScopeSelect value={scope} onChange={setScope} derived={derived} weeks={data.weeks} />
        </div>
        {!item ? <p className="muted" style={{ marginTop: 16 }}>No nouns in this selection yet.</p> : (
          <div className="card">
            <div className="muted small">{score.n ? `${score.ok} / ${score.n} correct` : " "}</div>
            <div className="big">{picked ? <span className={item.art}>{item.art}</span> : <span className="muted">___</span>} {item.de}</div>
            <div className="muted">{item.en}</div>
            <div className="artbtns">
              {ARTS.map(a => (
                <button key={a} className={`btn ${a} ${picked && a === item.art ? "picked-ok" : picked === a ? "picked-no" : ""}`} onClick={() => answer(a)} disabled={!!picked && picked !== a && a !== item.art}>{a}</button>
              ))}
            </div>
            {!picked && !showHint && <button className="btn ghost small" style={{ marginTop: 12 }} onClick={() => setShowHint(true)}>💡 Hint</button>}
            {!picked && showHint && <div className="hint">💡 {hintBefore(item, data.words)}</div>}
            {picked && (
              <>
                <div className={"fb " + (ok ? "ok" : "no")}>
                  {ok ? "Richtig!" : <>Falsch: it's <span className={item.art}>{item.art}</span> {item.de}.</>}
                  {item.pl && item.pl !== "-" && <span className="muted" style={{ fontWeight: 400 }}> · Plural: die {item.pl}</span>}
                </div>
                <ArticleHint w={item} words={data.words} />
                <AskAI key={item.id} context={`${item.art} ${item.de}`} label={`Ask AI why it's ${item.art}`}
                  body={{ kind: "card", id: item.id, mode: "article", answer: picked }} onOpen={() => clearTimeout(timer.current)} />
                <button className="btn primary" style={{ marginTop: 14 }} onClick={() => nextItem(item.id)}>Next →</button>
              </>
            )}
          </div>
        )}
        <div className="small muted" style={{ textAlign: "center" }}><kbd>1</kbd> der · <kbd>2</kbd> die · <kbd>3</kbd> das · <kbd>H</kbd> hint · <kbd>Enter</kbd> next</div>
      </div>
      <div className="panel">
        <details>
          <summary>Article rules cheat sheet</summary>
          <table style={{ marginTop: 10 }}><tbody>
            <tr><td className="der"><b>der</b></td><td>men and male animals · days, months, seasons · weather (Regen, Schnee) · compass directions · -ling, -ismus, -ist, -ant, -or, -ig · most -er people and machines (Lehrer, Computer)</td></tr>
            <tr><td className="die"><b>die</b></td><td>women · -ung, -heit, -keit, -schaft (always) · -ion, -tät, -ei, -ie, -ik, -ur, -enz, -anz · -in for women (Lehrerin) · about 90% of nouns ending in -e · numbers (die Eins)</td></tr>
            <tr><td className="das"><b>das</b></td><td>-chen, -lein (always) · verbs used as nouns (das Essen) · -ment, -um, -ma · many Ge- words (Gemüse, Gebäude) · many -o words (Auto, Kino) · young beings (das Kind, das Baby) · languages (das Deutsch)</td></tr>
            <tr><td><b>Tip</b></td><td>In compounds the <b>last</b> word decides: das Haus + die Tür → die Haustür; das Auto + der Schlüssel → der Autoschlüssel.</td></tr>
          </tbody></table>
        </details>
      </div>
    </>
  );
}
