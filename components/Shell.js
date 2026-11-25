"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore, totalPoints } from "./Store";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  ["/", "Today"], ["/learn", "Flashcards"], ["/articles", "der · die · das"], ["/plurals", "Plurals"],
  ["/verbs", "Verbs"], ["/words", "Words"], ["/progress", "Progress"], ["/settings", "Settings"],
];

export default function Shell({ children }) {
  const path = usePathname();
  const { data, state, derived, error, saving } = useStore();
  const ready = data && state && derived;
  return (
    <>
      <header className="top">
        <div className="wrap topbar">
          <Link href="/" className="brand"><span className="flag" aria-hidden /> Deutsch Vokabeln</Link>
          {ready && <span className="weekpill">Week {derived.curWeek} · {data.weeks[derived.curWeek]}</span>}
          <div className="topright">
            <span className="savestate">{saving ? "Saving…" : ready ? "Saved" : ""}</span>
            {ready && <span className="points" title="Points from typed answers and drills">⭐ {totalPoints(state)}</span>}
            <ThemeToggle />
          </div>
        </div>
        <nav className="wrap nav">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? "on" : ""}>{label}</Link>
          ))}
        </nav>
      </header>
      <main className="wrap main">
        {error && <div className="alert">{error}</div>}
        {ready ? children : !error && <div className="loading">Loading your words…</div>}
      </main>
    </>
  );
}
