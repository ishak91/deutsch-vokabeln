"use client";
import { useEffect, useRef } from "react";
// Calls handler(e) on keydown; skips events typed into inputs unless allowInputs.
export function useKeys(handler, allowInputs = false) {
  const ref = useRef(handler); ref.current = handler;
  useEffect(() => {
    const f = (e) => { if (!allowInputs && ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return; ref.current(e); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [allowInputs]);
}
