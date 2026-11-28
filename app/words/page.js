"use client";
import { useMemo, useState } from "react";
import { useStore, scopeWords, wordStatus } from "@/components/Store";
import { SpeakButton } from "@/components/Audio";
import { DeWord, ScopeSelect, deFull } from "@/components/Word";
import AskAI, { useAiReady } from "@/components/AskAI";

export default function Words() {
  const { data, state, derived } = useStore();
  const [scope, setScope] = useState("cur");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [ask, setAsk] = useState(null);   // the word the AI teacher is explaining
  const ai = useAiReady();
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return scopeWords(scope, data, state, derived).filter(w => (!type || w.t === type) && (!s || (deFull(w) + " " + w.en).toLowerCase().includes(s)));
  }, [scope, type, q, data, state, derived]);
  return (
    <div className="panel">
      <div className="row">
        <ScopeSelect value={scope} onChange={setScope} derived={derived} weeks={data.weeks} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option><option value="n">Nouns</option><option value="v">Verbs</option><option value="w">Other words</option><option value="p">Phrases</option>
        </select>
        <input type="text" placeholder="Search German or English" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 180, width: "auto" }} />
      </div>
      <div className="row between small muted" style={{ margin: "12px 0 4px" }}>
        <span>{rows.length} words</span>
        {ai && !ask && <span>Tap ✨ next to a word to ask the AI about it.</span>}
      </div>
      {ask && <div className="askword">
        <span className="small">✨ Asking about <b><DeWord w={ask} /></b></span>
        <AskAI key={ask.id} autoStart context={deFull(ask)} label="Ask again" placeholder="e.g. When do I use it?"
          body={{ kind: "card", id: ask.id, mode: "word" }} />
        <button type="button" className="linkbtn small" onClick={() => setAsk(null)}>Close</button>
      </div>}
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead><tr><th></th><th>German</th><th>Forms</th><th>English</th><th>Wk</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map(w => {
              const st = wordStatus(state, w.id);
              const forms = w.t === "n" ? (w.pl === "-" ? "—" : w.pl === "(pl)" ? "plural only" : "die " + w.pl) : w.t === "v" ? `${w.pres} · ${w.prat} · ${w.perf}` : "";
              return (
                <tr key={w.id}>
                  <td><SpeakButton text={deFull(w)} />{ai && <button type="button" className="speak aiword" onClick={() => setAsk(w)} aria-label={`Ask the AI about ${deFull(w)}`} title="Ask the AI about this word">✨</button>}</td>
                  <td><b><DeWord w={w} /></b>{w.ex && <div className="small muted">{w.ex}{w.exEn && <div style={{ fontStyle: "italic" }}>{w.exEn}</div>}</div>}</td>
                  <td>{forms}</td><td>{w.en}</td><td>{w.week}</td>
                  <td><span className={"tag " + st}>{st}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
