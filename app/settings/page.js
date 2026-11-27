"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { speak } from "@/components/Audio";

export default function Settings() {
  const { user, logout, data, state, derived, updateSettings, reload, post } = useStore();
  const s = state.settings;
  const [msg, setMsg] = useState("");
  const [pw, setPw] = useState({ current: "", next: "", next2: "" }), [pwMsg, setPwMsg] = useState("");

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.next2) return setPwMsg("The two new passwords don't match.");
    try { await post("/api/auth/password", { current: pw.current, next: pw.next }); setPw({ current: "", next: "", next2: "" }); setPwMsg("Password changed. Other devices are logged out."); }
    catch (e2) { setPwMsg(e2.message); }
  };

  const doImport = async (file) => {
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const n = Object.keys(state.cards).length;
      if (n && !confirm(`Replace your current progress (${n} cards) with this file?`)) return;
      const r = await post("/api/import", json);
      await reload(); setMsg(`Imported ${r.cards} cards.`);
    } catch (e) { setMsg("Import failed: " + e.message); }
  };

  return (
    <>
      <div className="panel">
        <h2>Study settings</h2>
        <div className="grid" style={{ alignItems: "end", marginBottom: 8 }}>
          <label className="field">Course start (week 1)<input type="date" value={s.startDate} onChange={(e) => updateSettings({ startDate: e.target.value })} /></label>
          <label className="field">New words per day<input type="number" min="0" max="200" value={s.newPerDay} onChange={(e) => updateSettings({ newPerDay: Math.max(0, +e.target.value || 0) })} /></label>
          <label className="field">Card direction
            <select value={s.direction} onChange={(e) => updateSettings({ direction: e.target.value })}>
              <option value="mixed">Mixed</option><option value="de">German → English</option><option value="en">English → German</option>
            </select></label>
          <label className="field">Sentence level
            <select value={s.sentLevel || "E"} onChange={(e) => updateSettings({ sentLevel: e.target.value, sentRun: "" })}>
              <option value="E">Easy (A1)</option><option value="M">Medium (A2)</option><option value="H">Hard (B1)</option>
            </select></label>
          <label className="field">Current week
            <select value={s.weekOverride || ""} onChange={(e) => updateSettings({ weekOverride: e.target.value ? +e.target.value : null })}>
              <option value="">Auto from date (week {derived.dateWeek})</option>
              {derived.weekNums.map(w => <option key={w} value={w}>Week {w}</option>)}
            </select></label>
        </div>
        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <input type="checkbox" checked={!!s.autoSpeak} onChange={(e) => updateSettings({ autoSpeak: e.target.checked })} /> Play German audio automatically on flashcards
        </label>
        <div className="row" style={{ marginTop: 12 }}><button className="btn ghost" onClick={() => speak("Guten Tag! Ich lerne Deutsch.")}>Test the German voice</button></div>
      </div>
      <div className="panel">
        <h2>Your progress</h2>
        <p className="small muted">Progress is saved for your account (<b>{user.id}</b>) after every answer. Export and import only touch your own progress. Keep a backup file now and then.</p>
        <div className="row">
          <a className="btn" href="/api/export">Export backup (.json)</a>
          <label className="btn">Import progress file…<input type="file" accept=".json,application/json" hidden onChange={(e) => doImport(e.target.files[0])} /></label>
          <button className="btn danger" onClick={async () => { if (prompt("Type RESET to delete all of your progress") === "RESET") { await post("/api/reset", {}); await reload(); setMsg("Progress reset."); } }}>Reset my progress</button>
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Import works with files exported from the old one-page app too.</p>
        {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
      <Content />
      <form className="panel" onSubmit={changePw}>
        <h2>Account</h2>
        <p className="small muted">Logged in as <b>{user.name}</b> ({user.id}){user.admin ? ", admin" : ""}.</p>
        <div className="grid" style={{ alignItems: "end", marginBottom: 8 }}>
          <label className="field">Current password<input type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} required /></label>
          <label className="field">New password<input type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} required /></label>
          <label className="field">New password again<input type="password" autoComplete="new-password" value={pw.next2} onChange={e => setPw({ ...pw, next2: e.target.value })} required /></label>
        </div>
        <div className="row"><button className="btn">Change password</button><button type="button" className="btn ghost" onClick={logout}>Log out</button></div>
        {pwMsg && <p className="small" style={{ marginTop: 8 }}>{pwMsg}</p>}
      </form>
    </>
  );
}

// Words, sentences and grammar topics are stored in the database and shared by everyone.
// Admins add or change them by importing a JSON file: a preview first, then save.
function Content() {
  const { user, data, derived, reload, post } = useStore();
  const [nSent, setNSent] = useState(null);
  const [file, setFile] = useState(null);       // { json, name, preview }
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/sentences").then(r => r.json()).then(b => setNSent(b.sentences?.length ?? null)).catch(() => {}); }, [data]);

  const pickFile = async (f) => {
    setMsg(""); setFile(null);
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      setFile({ json, name: f.name, preview: await post("/api/content", json) });
    } catch (e) { setMsg("Can't read this file: " + e.message); }
  };
  const save = async () => {
    try {
      const r = await post("/api/content?save=1", file.json);
      setFile(null); await reload();
      setMsg(`Imported: ${r.words.add} new and ${r.words.update} changed words, ${r.sentences.add} new and ${r.sentences.update} changed sentences, ${r.grammar.add + r.grammar.update} grammar topics.`);
    } catch (e) { setMsg("Import failed: " + e.message); }
  };
  const p = file?.preview;
  return (
    <div className="panel">
      <h2>Words and sentences</h2>
      <p className="small">{data.words.length} words{nSent != null ? `, ${nSent} sentences` : ""} in {derived.weekNums.length} weeks, stored in the database and shared by all accounts.</p>
      <div className="row">
        <a className="btn" href="/api/content">Download all (.json)</a>
        {user.admin && <label className="btn">Import file…<input type="file" accept=".json,application/json" hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ""; }} /></label>}
        <a className="btn ghost" href="/api/content?example=1">Example file</a>
      </div>
      {user.admin ? (
        <p className="small muted" style={{ marginTop: 10 }}>To add words, sentences or grammar notes: download the example file, fill it in the same way (it has a sample week 18 to replace), and import it. You see a preview before anything is saved. An entry with the same word (or sentence id) replaces the old one, everything else is added. Nothing is deleted and your progress is kept.</p>
      ) : <p className="small muted" style={{ marginTop: 10 }}>Only an admin can import new words and sentences.</p>}
      {p && (
        <div className="importbox">
          <b>{file.name}</b>
          <ul className="small">
            <li>Words: {p.words.add} new, {p.words.update} replace existing</li>
            <li>Sentences: {p.sentences.add} new, {p.sentences.update} replace existing</li>
            <li>Grammar topics: {p.grammar.add} new, {p.grammar.update} replace existing</li>
            {p.weeks > 0 && <li>Week names: {p.weeks}</li>}
          </ul>
          {p.errors.length > 0 && <div className="small importerr"><b>Fix these first ({p.errors.length}):</b><ul>{p.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          {p.warnings.length > 0 && <div className="small muted"><ul>{p.warnings.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</ul></div>}
          <div className="row">
            <button className="btn primary" disabled={p.errors.length > 0} onClick={save}>Save import</button>
            <button className="btn ghost" onClick={() => setFile(null)}>Cancel</button>
          </div>
        </div>
      )}
      {user.admin && <div className="row" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={async () => { const r = await post("/api/reload", {}); await reload(); setMsg(`From the data files: ${r.words.added} new words, ${r.sentences.added} new sentences, ${r.grammar.added} new grammar topics.`); }}>Add new entries from the data files</button>
      </div>}
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
