"use client";
import { useState } from "react";
import { useStore } from "./Store";

// Login screen. Before any account exists it asks for the first (admin) account instead.
export default function Login() {
  const { auth, reload, post } = useStore();
  const [mode, setMode] = useState(auth.setup ? "setup" : "login");
  const [f, setF] = useState({ username: "", name: "", password: "", password2: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const newAccount = mode !== "login";

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (newAccount && f.password !== f.password2) return setErr("The two passwords don't match.");
    setBusy(true);
    try { await post(`/api/auth/${mode}`, { username: f.username, name: f.name, password: f.password }); await reload(); }
    catch (e2) { setErr(e2.message); setBusy(false); }
  };

  return (
    <div className="authwrap">
      <form className="panel authbox" onSubmit={submit}>
        <h1>{mode === "setup" ? "Create the first account" : mode === "signup" ? "Create an account" : "Log in"}</h1>
        {mode === "setup" && <p className="small muted">This account becomes the admin, who can add other learners.
          {auth.legacyCards > 0 && <> Your existing progress (<b>{auth.legacyCards} cards</b>) moves into this account.</>}</p>}
        {mode === "signup" && <p className="small muted">Your progress is private to your account.</p>}
        <label className="field">Username<input type="text" autoComplete="username" autoCapitalize="none" spellCheck="false" value={f.username} onChange={set("username")} required autoFocus /></label>
        {newAccount && <label className="field">Your name (shown in the app)<input type="text" autoComplete="name" value={f.name} onChange={set("name")} /></label>}
        <label className="field">Password<input type="password" autoComplete={newAccount ? "new-password" : "current-password"} value={f.password} onChange={set("password")} required minLength={newAccount ? 8 : undefined} /></label>
        {newAccount && <label className="field">Password again<input type="password" autoComplete="new-password" value={f.password2} onChange={set("password2")} required /></label>}
        {err && <div className="fb no small">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}</button>
        {!auth.setup && auth.signup && (
          <p className="small muted" style={{ textAlign: "center", margin: 0 }}>
            {mode === "login" ? <>New here? <button type="button" className="linkbtn" onClick={() => { setMode("signup"); setErr(""); }}>Create an account</button></>
              : <>Have an account? <button type="button" className="linkbtn" onClick={() => { setMode("login"); setErr(""); }}>Log in</button></>}
          </p>)}
        {!auth.setup && !auth.signup && <p className="small muted" style={{ textAlign: "center", margin: 0 }}>No account yet? Ask the admin to create one for you.</p>}
      </form>
    </div>
  );
}
