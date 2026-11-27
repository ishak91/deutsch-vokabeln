"use client";
import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/components/Store";

// Admin page: create learners, reset passwords, delete accounts. Each account's progress is separate.
export default function Users() {
  const { user, post } = useStore();
  const [list, setList] = useState(null), [config, setConfig] = useState(null);
  const [f, setF] = useState({ username: "", name: "", password: "", admin: false });
  const [msg, setMsg] = useState(""), [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/users").then(r => r.json());
    if (r.error) return setErr(r.error);
    setList(r.users); setConfig(r.config);
  }, []);
  useEffect(() => { if (user?.admin) load(); }, [user, load]);
  if (!user?.admin) return <div className="panel"><p>Only an admin can manage users.</p></div>;

  const act = async (fn, ok) => { setErr(""); setMsg(""); try { await fn(); setMsg(ok); await load(); } catch (e) { setErr(e.message); } };
  const create = (e) => { e.preventDefault(); act(async () => { await post("/api/users", f); setF({ username: "", name: "", password: "", admin: false }); }, `Created ${f.username.trim().toLowerCase()}. Share the username and password with them.`); };
  const resetPw = (u) => { const pw = prompt(`New password for ${u.id} (at least 8 characters):`); if (pw) act(() => post("/api/users", { id: u.id, password: pw }, "PUT"), `Password changed for ${u.id}. They're logged out on all devices.`); };
  const toggleAdmin = (u) => act(() => post("/api/users", { id: u.id, admin: !u.admin }, "PUT"), `${u.id} is ${u.admin ? "no longer" : "now"} an admin.`);
  const remove = (u) => { if (prompt(`This deletes ${u.id} and all their progress (${u.cards} cards). It can't be undone.\nType ${u.id} to confirm:`) === u.id) act(async () => { const r = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" }); if (!r.ok) throw new Error((await r.json()).error); }, `Deleted ${u.id}.`); };
  const setSignup = (v) => act(() => post("/api/users", { config: { signup: v } }, "PUT"), v ? "Anyone with the link can now create an account." : "Sign-up closed. Only you can add accounts.");

  return (
    <>
      <div className="panel">
        <h2>Users</h2>
        <p className="small muted">Every account has its own cards, drills, points, settings and backups. Nobody sees another person's progress.</p>
        {err && <div className="fb no small">{err}</div>}
        {msg && <div className="fb ok small">{msg}</div>}
        <div className="tablewrap">
          <table className="users">
            <thead><tr><th>User</th><th>Cards</th><th>Points</th><th>Last study</th><th /></tr></thead>
            <tbody>
              {(list || []).map(u => (
                <tr key={u.id}>
                  <td><b>{u.name}</b> {u.admin && <span className="tag learned">admin</span>}{u.id === user.id && <span className="tag">you</span>}<div className="small muted">{u.id}</div></td>
                  <td data-l="Cards">{u.cards}</td><td data-l="Points">{u.points}</td><td data-l="Last study" className="small">{u.lastDay || "never"}</td>
                  <td><div className="acts">
                    <button className="btn ghost" onClick={() => resetPw(u)}>Password</button>
                    {u.id !== user.id && <button className="btn ghost" onClick={() => toggleAdmin(u)}>{u.admin ? "Remove admin" : "Make admin"}</button>}
                    {u.id !== user.id && <button className="btn danger" onClick={() => remove(u)}>Delete</button>}
                  </div></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {!list && !err && <p className="muted small">Loading…</p>}
      </div>
      <form className="panel" onSubmit={create}>
        <h2>Add a learner</h2>
        <div className="grid" style={{ alignItems: "end", marginBottom: 8 }}>
          <label className="field">Username<input type="text" autoCapitalize="none" spellCheck="false" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} required /></label>
          <label className="field">Name<input type="text" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          <label className="field">Password (8+ characters)<input type="password" autoComplete="new-password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required minLength={8} /></label>
        </div>
        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0 12px" }}>
          <input type="checkbox" checked={f.admin} onChange={e => setF({ ...f, admin: e.target.checked })} /> Admin (can manage users and reload the word list)
        </label>
        <button className="btn primary">Create account</button>
        <p className="small muted" style={{ marginTop: 10 }}>New learners start at week 1 from today. They can change it in Settings.</p>
      </form>
      {config && <div className="panel">
        <h2>Sign-up</h2>
        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={config.signup} onChange={e => setSignup(e.target.checked)} /> Let people create their own account on the login page
        </label>
        <p className="small muted" style={{ marginTop: 8 }}>Leave this off unless you want strangers who find the address to be able to join.</p>
      </div>}
    </>
  );
}
