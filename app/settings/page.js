"use client";
import { useState } from "react";
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
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>Import works with files exported from the old one-page app too.</p>
        {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
      </div>
      <div className="panel">
        <h2>Word list</h2>
        <p className="small">{data.words.length} words in {derived.weekNums.length} weeks from <code>data/vocab-data.txt</code>. Edit that file to add words, then reload. Progress is kept per word, so adding words is safe.</p>
        <div className="row">
          {user.admin && <button className="btn" onClick={async () => { const r = await post("/api/reload", {}); await reload(); setMsg(`Reloaded ${r.count} words.`); }}>Reload word list</button>}
          <button className="btn danger" onClick={async () => { if (prompt("Type RESET to delete all of your progress") === "RESET") { await post("/api/reset", {}); await reload(); setMsg("Progress reset."); } }}>Reset my progress</button>
        </div>
      </div>
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
