"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/components/Store";
import { SpeakButton, speak } from "@/components/Audio";
import { useKeys } from "@/components/useKeys";
import { ARTS } from "@/components/Word";
import AskAI from "@/components/AskAI";
import {
  LEVELS, LEVEL_NAME, LEVEL_CEFR, pointsFor, gradeTranslation, nextLevel, rightsInRow, schedule, pickSentence,
  buildGlossIndex, glossWords,
} from "@/lib/sentences";

const ROUND = 10;
const VERDICT = { right: "Right!", almost: "Almost", wrong: "Not quite" };

export default function Sentences() {
  const { data, state, derived, sentenceResult } = useStore();
  const [bank, setBank] = useState(null);          // { sentences, grammar }
  const [err, setErr] = useState("");
  const [scope, setScope] = useState("upto");
  const [round, setRound] = useState({ n: 0, results: [], recent: [], retry: [] });
  const [item, setItem] = useState(null);
  const [input, setInput] = useState("");
  const [res, setRes] = useState(null);            // grading result + final (after "I was right")
  const [gloss, setGloss] = useState(null);        // index of the tapped word
  const [openTag, setOpenTag] = useState(null);
  const [flash, setFlash] = useState(null);        // level change message
  const inputRef = useRef(null);

  const index = useMemo(() => buildGlossIndex(data.words), [data.words]);
  const level = LEVELS.includes(state.settings.sentLevel) ? state.settings.sentLevel : "E";
  const run = state.settings.sentRun || "";
  const progress = state.sent || {};

  useEffect(() => {
    fetch("/api/sentences").then(r => r.json()).then(b => { if (b.error) throw new Error(b.error); setBank(b); })
      .catch(e => setErr("Couldn't load the sentences: " + e.message));
  }, []);

  const pick = (r, lv = level) => {
    const due = r.retry.find(x => x.at <= r.n);
    if (due) return { s: bank.sentences.find(s => s.id === due.id), retry: r.retry.filter(x => x !== due) };
    return { s: pickSentence(bank.sentences, progress, { level: lv, curWeek: derived.curWeek, onlyWeek: scope === "cur", avoid: r.recent }), retry: r.retry };
  };
  const show = (s) => {
    setItem(s); setInput(""); setRes(null); setGloss(null); setOpenTag(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const startRound = () => {
    const r = { n: 0, results: [], recent: [], retry: [] };
    const { s } = pick(r);
    setRound(r); setFlash(null); show(s);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (bank) startRound(); }, [bank, scope, derived.curWeek]);

  const check = () => {
    if (res || !item) return;
    const own = progress[item.id]?.own || [];
    const g = gradeTranslation(input, item, index, own);
    if (!g) return;
    setRes({ ...g, final: g.result });
    speak(item.de);
  };
  const dontKnow = () => { if (!res) setRes({ result: "wrong", final: "wrong", best: item.en[0], missing: [], skipped: true }); };

  // Saves the answer (after a possible "I was right") and moves on
  const next = () => {
    if (!res) return;
    const result = res.final;
    const p = schedule(progress[item.id], result);
    const lv = nextLevel(level, run, item.lv, result);
    sentenceResult(item, result, p, { level: lv.level, run: lv.run, own: res.overridden ? input.trim() : null });
    const n = round.n + 1;
    // a missed sentence comes back 3 to 5 sentences later in this round
    const retry = result === "wrong" && !round.retry.some(x => x.id === item.id)
      ? [...round.retry, { id: item.id, at: n + 3 + Math.floor(Math.random() * 3) }] : round.retry;
    const r = { n, results: [...round.results, { lv: item.lv, result }], recent: [...round.recent, item.id].slice(-12), retry };
    setFlash(lv.change === "up" ? `Nice! Moving up to ${LEVEL_NAME[lv.level]} (${LEVEL_CEFR[lv.level]}).`
      : lv.change === "down" ? `Let's practise ${LEVEL_NAME[lv.level]} (${LEVEL_CEFR[lv.level]}) a bit more first.` : null);
    if (n >= ROUND) { setRound(r); setItem(null); return; }
    const { s, retry: rest } = pick(r, lv.level);
    setRound({ ...r, retry: rest });
    show(s);
  };
  useKeys((e) => { if (res && e.key === "Enter") next(); });

  if (err) return <div className="alert">{err}</div>;
  if (!bank) return <div className="loading">Loading sentences…</div>;

  const toGo = 3 - rightsInRow(run);
  const levelLine = level === "H" ? "the top level" : `${toGo} right in a row to move up`;
  const finished = !item && round.n >= ROUND;
  const tokens = item ? item.de.split(/\s+/) : [];
  const glossed = item ? glossWords(item.de, index) : [];
  const g = gloss != null ? glossed[gloss] : null;

  return (
    <div className="panel">
      <div className="row between">
        <h2 style={{ margin: 0 }}>Translate the sentence</h2>
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Which weeks">
          <option value="upto">Weeks 1–{derived.curWeek}</option>
          <option value="cur">This week only ({derived.curWeek})</option>
        </select>
      </div>
      <div className="lvbar">
        <div className="lvpills" aria-label="Your level">
          {LEVELS.map(l => <span key={l} className={l === level ? "on" : ""}>{LEVEL_NAME[l]}</span>)}
        </div>
        <span className="small muted">{LEVEL_CEFR[level]} grammar · {levelLine}</span>
      </div>
      {flash && <div className="flash">{flash}</div>}

      {finished ? <Summary round={round} level={level} onAgain={startRound} /> : !item ? (
        <p className="muted" style={{ marginTop: 16 }}>No sentences for these weeks yet.</p>
      ) : (
        <div className="sent">
          <div className="row between small muted">
            <span><span className={"lvtag lv" + item.lv}>{LEVEL_NAME[item.lv]} · {LEVEL_CEFR[item.lv]}</span> Week {item.week}</span>
            <span>Sentence {round.n + 1} of {ROUND}</span>
          </div>
          <div className="sentde" lang="de">
            {tokens.map((t, i) => (
              <span key={i}>
                {glossed[i]
                  ? <button type="button" className={"sw" + (gloss === i || (g && glossed[i] === g) ? " on" : "")} onClick={() => setGloss(gloss === i ? null : i)}>{t}</button>
                  : t}{" "}
              </span>
            ))}
            <SpeakButton text={item.de} label="Listen to the sentence (click again for slower)" />
          </div>
          <div className="gloss small">
            {g ? <><b lang="de">{g.t === "n" ? <><span className={ARTS.includes(g.art) ? g.art : ""}>{g.art}</span> {g.de}</> : g.de}</b> = {g.en}
              {g.t !== "f" && <SpeakButton small text={g.t === "n" ? `${g.art} ${g.de}` : g.de} />}</>
              : <span className="muted">Tap a word to see what it means.</span>}
          </div>

          <form className="typebox sentbox" onSubmit={(e) => { e.preventDefault(); check(); }}>
            <input ref={inputRef} type="text" value={input} readOnly={!!res} placeholder="Type the English meaning…" autoComplete="off" autoCapitalize="off" spellCheck={false}
              aria-label="Your English translation" onChange={(e) => setInput(e.target.value)} />
            {!res && <button className="btn primary" type="submit" disabled={!input.trim()}>Check</button>}
          </form>
          {!res && <button type="button" className="linkbtn" onClick={dontKnow}>I don't know</button>}

          {res && <Result item={item} res={res} input={input} grammar={bank.grammar} openTag={openTag} setOpenTag={setOpenTag}
            onOverride={() => setRes(r => ({ ...r, final: "right", overridden: true }))} onNext={next} />}
        </div>
      )}
    </div>
  );
}

function Result({ item, res, input, grammar, openTag, setOpenTag, onOverride, onNext }) {
  const pts = pointsFor(item.lv, res.final);
  const others = item.en.filter(a => a !== res.best).slice(0, 3);
  return (
    <div className="sentres">
      <div className={"verdict " + res.final}>
        {res.overridden ? "Counted as right" : VERDICT[res.final]}{pts ? ` +${pts}` : ""}
      </div>
      {!res.skipped && res.final !== "right" && <div className="small"><span className="muted">You wrote:</span> {input}</div>}
      <div className="answer"><span className="muted small">{res.final === "right" && !res.overridden ? "Answer" : "Correct answer"}</span><b>{res.best}</b></div>
      {res.final === "almost" && res.missing.length > 0 && <div className="small muted">Missing or different: {res.missing.join(", ")}</div>}
      {others.length > 0 && <div className="small muted">Also right: {others.join(" · ")}</div>}

      <div className="grammar">
        <div className="gtitle">Grammar</div>
        <div lang="de" className="gde">{item.de}<SpeakButton small text={item.de} /></div>
        <p>{item.note}</p>
        <div className="row">
          {item.tags.map(t => grammar[t] && (
            <button key={t} type="button" className={"gtag" + (openTag === t ? " on" : "")} onClick={() => setOpenTag(openTag === t ? null : t)}>
              {grammar[t].title} <small>{grammar[t].level}</small>
            </button>
          ))}
        </div>
        {openTag && grammar[openTag] && <p className="gmore">{grammar[openTag].text}</p>}
      </div>
      {res.final !== "right" && <AskAI body={{ id: item.id, answer: res.skipped ? "" : input, result: res.final }}
        label={res.skipped ? "Ask AI to explain the sentence" : "Ask AI why"} />}

      <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
        {res.final !== "right" && !res.skipped && <button type="button" className="btn ghost" onClick={onOverride}>I was right</button>}
        <button type="button" className="btn primary" onClick={onNext} autoFocus>Next →</button>
      </div>
      {res.overridden && <p className="small muted" style={{ textAlign: "center" }}>Your answer will be accepted for this sentence from now on.</p>}
    </div>
  );
}

function Summary({ round, level, onAgain }) {
  const c = { right: 0, almost: 0, wrong: 0 };
  let pts = 0;
  round.results.forEach(r => { c[r.result]++; pts += pointsFor(r.lv, r.result); });
  return (
    <div className="sent" style={{ textAlign: "center" }}>
      <h3 style={{ margin: "8px 0" }}>Round done</h3>
      <div className="grid" style={{ marginTop: 12 }}>
        <div className="stat"><b>{c.right}</b><span>right</span></div>
        <div className="stat"><b>{c.almost}</b><span>almost</span></div>
        <div className="stat"><b>{c.wrong}</b><span>not yet</span></div>
        <div className="stat"><b>+{pts}</b><span>points</span></div>
      </div>
      <p className="small muted">Your level now: {LEVEL_NAME[level]} ({LEVEL_CEFR[level]}). Missed sentences come back in later rounds.</p>
      <button className="btn primary" onClick={onAgain}>Another {ROUND} sentences</button>
    </div>
  );
}
