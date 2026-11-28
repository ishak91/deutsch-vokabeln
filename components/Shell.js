"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore, totalPoints } from "./Store";
import ThemeToggle from "./ThemeToggle";
import Login from "./Login";

const NAV = [
  ["/", "Today"], ["/learn", "Flashcards"], ["/sentences", "Sentences"], ["/articles", "der · die · das"], ["/plurals", "Plurals"],
  ["/verbs", "Verbs"], ["/dictation", "Dictation"], ["/speak", "Speaking"], ["/write", "Writing"], ["/words", "Words"], ["/progress", "Progress"], ["/settings", "Settings"],
];

export default function Shell({ children }) {
  const path = usePathname();
  const { auth, user, logout, data, state, derived, error, saving } = useStore();
  const ready = data && state && derived;
  const loggedOut = auth && !auth.user;
  const nav = user?.admin ? [...NAV, ["/users", "Users"], ["/ai", "AI"]] : NAV;
  return (
    <>
      <header className="top">
        <div className="wrap topbar">
          <Link href="/" className="brand"><span className="flag" aria-hidden /> Deutsch Vokabeln</Link>
          {ready && <span className="weekpill">Week {derived.curWeek} · {data.weeks[derived.curWeek]}</span>}
          <div className="topright">
            <span className="savestate">{saving ? "Saving…" : ready ? "Saved" : ""}</span>
            {ready && <span className="points" title="Points from typed answers and drills">⭐ {totalPoints(state)}</span>}
            {user && <button className="userpill" onClick={logout} title="Log out">{user.name}<span className="lo"> · Log out</span></button>}
            <ThemeToggle />
          </div>
        </div>
        {!loggedOut && <nav className="wrap nav">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? "on" : ""}>{label}</Link>
          ))}
        </nav>}
      </header>
      <main className="wrap main">
        {error && <div className="alert">{error}</div>}
        {loggedOut ? <Login key={auth.setup ? "setup" : "login"} /> : ready ? children : !error && <div className="loading">Loading your words…</div>}
      </main>
    </>
  );
}
