"use client";
import { useStore, wordStatus } from "@/components/Store";
import { DeWord } from "@/components/Word";
import { dayKey, DAY } from "@/lib/srs";

export default function Progress() {
  const { data, state, derived } = useStore();
  const cnt = { new: 0, learning: 0, learned: 0, mature: 0 };
  data.words.forEach(w => cnt[wordStatus(state, w.id)]++);
  const days = Array.from({ length: 30 }, (_, i) => { const k = dayKey(new Date(Date.now() - (29 - i) * DAY)); const l = state.log[k] || {}; return [k, (l.rev || 0) + (l.quiz || 0)]; });
  const mx = Math.max(10, ...days.map(d => d[1]));
  const tot = { a: [0, 0], p: [0, 0], v: [0, 0] };
  Object.values(state.quiz).forEach(q => ["a", "p", "v"].forEach(k => { if (q[k]) { tot[k][0] += q[k][0] || 0; tot[k][1] += q[k][1] || 0; } }));
  const pct = r => (r[0] + r[1] ? Math.round((r[0] / (r[0] + r[1])) * 100) + "%" : "–");
  const sum = (q, i) => Object.values(q).reduce((s, r) => s + (r[i] || 0), 0);
  const hardest = Object.entries(state.quiz).filter(([id]) => derived.byId[id]).map(([id, q]) => [id, sum(q, 1), sum(q, 0)])
    .filter(x => x[1] > 0).sort((a, b) => (b[1] - b[2] / 2) - (a[1] - a[2] / 2)).slice(0, 12);
  const soon = Object.values(state.cards).filter(c => c.due <= Date.now() + DAY).length;

  return (
    <>
      <div className="grid">
        <div className="stat"><b>{cnt.learned + cnt.mature}</b><span>learned of {data.words.length}</span></div>
        <div className="stat"><b>{cnt.mature}</b><span>mature (21+ day interval)</span></div>
        <div className="stat"><b>{cnt.learning}</b><span>in learning</span></div>
        <div className="stat"><b>{soon}</b><span>due within 24 h</span></div>
      </div>
      <div className="panel">
        <h2>By week</h2>
        <div className="legend"><span><i style={{ background: "var(--good)" }} />mature</span><span><i style={{ background: "var(--info)" }} />learned</span><span><i style={{ background: "var(--warn)" }} />learning</span></div>
        <div className="weeks">
          {derived.weekNums.map(wk => {
            const ws = data.words.filter(w => w.week === wk), n = ws.length || 1, k = { new: 0, learning: 0, learned: 0, mature: 0 };
            ws.forEach(w => k[wordStatus(state, w.id)]++);
            return (
              <div key={wk} className={"weekrow" + (wk === derived.curWeek ? " cur" : "")}>
                <span>Wk {wk}</span>
                <div><div className="small" style={{ marginBottom: 4 }}>{data.weeks[wk]}</div>
                  <div className="bar"><i style={{ width: (k.mature / n) * 100 + "%", background: "var(--good)" }} /><i style={{ width: (k.learned / n) * 100 + "%", background: "var(--info)" }} /><i style={{ width: (k.learning / n) * 100 + "%", background: "var(--warn)" }} /></div></div>
                <span className="small muted">{k.learned + k.mature}/{ws.length}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <h2>Activity · last 30 days</h2>
        <div className="chart">{days.map(([k, v]) => <div key={k} title={`${k}: ${v}`} style={{ height: (v / mx) * 100 + "%" }} />)}</div>
        <div className="row between small muted" style={{ marginTop: 6 }}><span>{days[0][0]}</span><span>today</span></div>
      </div>
      <div className="panel">
        <h2>Drill accuracy</h2>
        <div className="grid" style={{ marginBottom: 0 }}>
          <div className="stat"><b>{pct(tot.a)}</b><span>articles ({tot.a[0] + tot.a[1]})</span></div>
          <div className="stat"><b>{pct(tot.p)}</b><span>plurals ({tot.p[0] + tot.p[1]})</span></div>
          <div className="stat"><b>{pct(tot.v)}</b><span>verb forms ({tot.v[0] + tot.v[1]})</span></div>
        </div>
        {hardest.length > 0 && (
          <>
            <h3 style={{ marginTop: 18 }}>Words you miss most</h3>
            <div className="row">{hardest.map(([id, bad, ok]) => <span key={id} className="tag" style={{ fontSize: 13, padding: "3px 10px" }}><DeWord w={derived.byId[id]} /> · {bad}✗ {ok}✓</span>)}</div>
            <p className="small muted" style={{ marginTop: 8 }}>Pick "My weak words" in any drill to practise them.</p>
          </>
        )}
      </div>
    </>
  );
}
