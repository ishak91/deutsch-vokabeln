"use client";
import { useEffect, useState } from "react";

// Cycles Auto (system) -> Light -> Dark. Saved in this browser.
const ORDER = ["system", "light", "dark"];
const ICON = {
  system: <path d="M4 5h16v11H4zM8 20h8M12 16v4" />,
  light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  dark: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
};

export default function ThemeToggle({ compact }) {
  const [mode, setMode] = useState("system");
  useEffect(() => { try { setMode(localStorage.getItem("theme") || "system"); } catch {} }, []);
  const apply = (m) => {
    setMode(m);
    try { m === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", m); } catch {}
    if (m === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", m);
  };
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  return (
    <button type="button" className={"themetoggle" + (compact ? " compact" : "")} onClick={() => apply(next)} title={`Theme: ${mode} (click for ${next})`} aria-label={`Theme: ${mode}. Switch to ${next}`}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICON[mode]}</svg>
      {!compact && <span>{mode === "system" ? "Auto" : mode === "light" ? "Light" : "Dark"}</span>}
    </button>
  );
}
