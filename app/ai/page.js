"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { streamAi } from "@/components/AskAI";

const gb = (n) => n == null ? "?" : `${n < 10 ? n.toFixed(1) : Math.round(n)} GB`;

// Admin page: the self-hosted AI. Shows the model on disk and switches it (old one deleted first, then download).
export default function AiAdmin() {
  const { user, post } = useStore();
  const [info, setInfo] = useState(null), [err, setErr] = useState(""), [msg, setMsg] = useState("");
  const [pick, setPick] = useState(""), [custom, setCustom] = useState("");
  const [test, setTest] = useState(null), [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/ai/admin").then(r => r.json());
    if (r.error && !r.catalog) return setErr(r.error);
    setInfo(r);
    setPick(p => p || r.defaultModel);
  }, []);
  useEffect(() => { if (user?.admin) load(); }, [user, load]);
  const busy = ["deleting", "downloading"].includes(info?.job?.state);
  // While installing, ask every 2 seconds how far the download is
  useEffect(() => { if (!busy) return; const t = setInterval(load, 2000); return () => clearInterval(t); }, [busy, load]);
  if (!user?.admin) return <div className="panel"><p>Only an admin can manage the AI.</p></div>;
  if (!info) return <div className="panel">{err ? <div className="fb no small">{err}</div> : <p className="muted small">Loading…</p>}</div>;

  const model = custom.trim() || pick;
  const cat = info.catalog.find(m => m.id === model);
  const tooBig = cat && cat.ram > info.ram.total - 1;
  const install = async () => {
    const del = info.models.map(m => m.name).join(", ");
    const size = cat ? ` (about ${gb(cat.size)})` : "";
    if (!confirm(`${del ? `First delete ${del}, then download` : "Download"} ${model}${size}?\n\nThe AI is off until the download finishes.`
      + (tooBig ? `\n\nWarning: ${model} needs about ${gb(cat.ram)} of RAM and this server has ${gb(info.ram.total)}. It will probably not run.` : ""))) return;
    setErr(""); setMsg(""); setTest(null); setStarting(true);
    try { await post("/api/ai/admin", { model }); setCustom(""); await load(); } catch (e) { setErr("Couldn't start: " + e.message); }
    setStarting(false);
  };
  const remove = async (name) => {
    if (!confirm(`Delete ${name}? The AI buttons disappear until you install a model again.`)) return;
    setErr("");
    const r = await fetch(`/api/ai/admin?model=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (!r.ok) setErr((await r.json()).error); else setMsg(`Deleted ${name}.`);
    load();
  };
  const runTest = async () => {
    const t0 = Date.now();
    setTest({ text: "", secs: null });
    try {
      const text = await streamAi("/api/ai/admin", { test: true }, (text) => setTest({ text, secs: null }));
      setTest({ text, secs: (Date.now() - t0) / 1000 });
    } catch (e) { setTest({ text: "", error: e.message }); }
  };
  const j = info.job, pct = j.total ? Math.round(100 * j.done / j.total) : 0;

  return (
    <>
      <div className="panel">
        <h2>AI teacher</h2>
        <p className="small muted">A small AI model runs on your own server (Ollama). It explains wrong answers on the Sentences page. It never changes the word list or decides if an answer is right.</p>
        {err && <div className="fb no small">{err}</div>}
        {msg && <div className="fb ok small">{msg}</div>}
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="stat"><b>{info.ok ? (info.model || "none") : "off"}</b><span>{info.ok ? `model in use · Ollama ${info.version}` : "AI service not reachable"}</span></div>
          <div className="stat"><b>{gb(info.ram.total)}</b><span>RAM · {info.cpus} CPU{info.cpus > 1 ? "s" : ""}</span></div>
          <div className="stat"><b>{gb(info.disk?.free)}</b><span>free disk{info.disk ? ` of ${gb(info.disk.total)}` : ""}</span></div>
        </div>
        {!info.ok && <p className="small">{info.error} Start it with <code>docker compose up -d ollama</code>.</p>}
        {info.models.length > 0 && <div className="tablewrap"><table className="users">
          <thead><tr><th>On disk</th><th>Size</th><th /></tr></thead>
          <tbody>{info.models.map(m => (
            <tr key={m.name}><td><b>{m.name}</b> {m.name === info.model && <span className="tag learned">in use</span>}</td><td className="small">{gb(m.size)}</td>
              <td><div className="acts"><button className="btn ghost" onClick={runTest} disabled={busy}>Test</button>
                <button className="btn danger" onClick={() => remove(m.name)} disabled={busy}>Delete</button></div></td></tr>))}
          </tbody></table></div>}
        {test && <div className="aibox">
          {test.error ? <span className="fb no">{test.error}</span> : test.text || <span className="muted thinking">Loading the model and thinking… the first answer after a while takes longer.</span>}
          {test.secs != null && <div className="small muted aifoot">Answered in {Math.round(test.secs)} seconds.</div>}
        </div>}
      </div>

      <div className="panel">
        <h2>{info.models.length ? "Switch model" : "Install a model"}</h2>
        <p className="small muted">Only one model is kept: the one on disk is deleted first, then the new one downloads. Bigger models explain better but need more RAM and are slower.</p>
        {busy || j.state === "error" || j.state === "done" ? (
          <div className="aibox" style={{ marginBottom: 14 }}>
            {j.state === "deleting" && <p>Deleting the old model…</p>}
            {j.state === "downloading" && <>
              <p>Downloading <b>{j.model}</b>: {j.total ? `${gb(j.done / 1024 ** 3)} of ${gb(j.total / 1024 ** 3)} (${pct}%)` : j.status || "starting…"}</p>
              <div className="bar" style={{ marginTop: 8 }}><i style={{ width: pct + "%", background: "var(--info)" }} /></div>
              <p className="small muted">You can leave this page; the download continues on the server.</p>
            </>}
            {j.state === "done" && <p className="fb ok">{j.model} is installed and in use.</p>}
            {j.state === "error" && <p className="fb no">Installing {j.model} failed: {j.error}</p>}
          </div>
        ) : null}
        <div className="models">
          {info.catalog.map(m => {
            const big = m.ram > info.ram.total - 1;
            return (
              <label key={m.id} className={"model" + (model === m.id ? " on" : "")}>
                <input type="radio" name="model" checked={model === m.id} onChange={() => { setPick(m.id); setCustom(""); }} />
                <div>
                  <b>{m.name}</b> <span className="small muted">{m.id} · {gb(m.size)} download · needs ~{gb(m.ram)} RAM</span>
                  {m.id === info.defaultModel && <span className="tag learned" style={{ marginLeft: 6 }}>suggested</span>}
                  <div className="small muted">{m.note}</div>
                  {big && <div className="small warn">Too big for this server's {gb(info.ram.total)} RAM.</div>}
                </div>
              </label>);
          })}
        </div>
        <label className="field small">Or any other Ollama model name<input type="text" placeholder="e.g. qwen3:4b" value={custom} autoCapitalize="none" spellCheck="false" onChange={e => setCustom(e.target.value)} /></label>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={install} disabled={busy || starting || !info.ok || !model || info.model === model}>
            {starting ? "Starting…" : info.model === model ? `${model} is in use` : `Install ${model}`}
          </button>
          {!info.ok && <button className="btn ghost" onClick={load}>Check again</button>}
        </div>
        {/* shown here too, because on a phone the top of the page is far away from this button */}
        {!info.ok && <p className="small fb no">The AI service isn't running, so nothing can be installed yet. Right after an update it can take a few minutes to start. Then press Check again.</p>}
        {err && <p className="small fb no">{err}</p>}
        <p className="small muted" style={{ marginTop: 10 }}>From a terminal on the server you can do the same: <code>bash deploy/ai-model.sh {model}</code></p>
      </div>
    </>
  );
}
