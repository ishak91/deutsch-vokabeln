"use client";
import Link from "next/link";
import { useStore, wordStatus, totalPoints } from "@/components/Store";
import { dayKey, DAY } from "@/lib/srs";
import Icon from "@/components/Icon";
import { GROUPS } from "@/components/nav";

export default function Today() {
  const { data, state, derived } = useStore();
  const c = derived.curWeek, ww = data.words.filter(w => w.week === c);
  const st = ww.map(w => wordStatus(state, w.id));
  const learned = st.filter(s => s === "learned" || s === "mature").length, seen = st.filter(s => s !== "new").length;
  const now = Date.now();
  const due = Object.entries(state.cards).filter(([id, cd]) => derived.byId[id] && cd.due <= now).length;
  const today = state.log[dayKey()] || {};
  const newLeft = Math.min(Math.max(0, state.settings.newPerDay - (today.nw || 0)), data.words.filter(w => w.week <= c && !state.cards[w.id]).length);
  const count = t => ww.filter(w => w.t === t).length;
  let streak = 0; const d = new Date(); if (!today.rev && !today.quiz) d.setTime(d.getTime() - DAY);
  for (;;) { const l = state.log[dayKey(d)]; if (l && (l.rev || l.quiz)) { streak++; d.setTime(d.getTime() - DAY); } else break; }
  const pct = (n) => (ww.length ? (n / ww.length) * 100 : 0) + "%";

  const next = due ? `Review ${due} card${due === 1 ? "" : "s"}` : newLeft ? `Learn ${newLeft} new words` : "Practise flashcards";

  return (
    <>
      <div className="panel hero">
        <div className="eyebrow">Week {c} of {derived.maxWeek}{state.settings.weekOverride ? " · set manually" : ""}</div>
        <h1>{data.weeks[c]}</h1>
        <p className="muted">Goal: get all {ww.length} words into your deck ({count("n")} nouns, {count("v")} verbs, {count("w")} other{count("p") ? `, ${count("p")} phrases` : ""}), then drill articles, plurals and verb forms until they're automatic.</p>
        <div className="bar"><i style={{ width: pct(learned), background: "var(--good)" }} /><i style={{ width: pct(seen - learned), background: "var(--warn)" }} /></div>
        <div className="small muted" style={{ marginTop: 6 }}>{learned} learned · {seen - learned} in progress · {ww.length - seen} not started</div>
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn primary" href="/learn">{next}</Link>
          <Link className="btn" href="/articles">Article drill</Link>
        </div>
      </div>
      <div className="grid stats4">
        <div className="stat"><b>{due}</b><span>reviews due · {today.rev || 0} done today</span></div>
        <div className="stat"><b>{newLeft}</b><span>new words left today</span></div>
        <div className="stat"><b>{streak} <small>🔥</small></b><span>day streak</span></div>
        <div className="stat"><b>⭐ {today.pts || 0}</b><span>points today · {totalPoints(state)} total</span></div>
      </div>
      {GROUPS.filter(g => g.title && g.title !== "Track").map(g => (
        <section key={g.title} className="quick">
          <h2>{g.title}</h2>
          <div className="quickgrid">
            {g.items.map(it => (
              <Link key={it.href} href={it.href} className="quickcard">
                <span className="qicon"><Icon name={it.icon} /></span>
                <span className="qtext"><b>{it.label}</b><small>{it.desc}</small></span>
                <Icon name="arrow" size={16} />
              </Link>
            ))}
          </div>
        </section>
      ))}
      <div className="panel">
        <h2>Daily routine · about 30–40 min</h2>
        <ol>
          <li><b>Flashcards</b>: clear your reviews, then {state.settings.newPerDay} new words.</li>
          <li><b>der · die · das</b>: 2–3 minutes on this week's nouns. Say the article out loud.</li>
          <li><b>Plurals</b> and <b>Verbs</b>: one round of 15–20 each. From week 7, focus on Präteritum.</li>
          <li>Write 3 sentences with today's words and ask Claude to correct them.</li>
        </ol>
      </div>
    </>
  );
}
