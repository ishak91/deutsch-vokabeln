"use client";
import { useState } from "react";
import TypedDrill from "@/components/TypedDrill";
import { check, checkPerf } from "@/lib/check";

const F = {
  pres: { key: "pres", label: "Present (er/sie …)", answer: (w) => "er " + w.pres, say: (w) => "er " + w.pres.split("/")[0], check: (v, w) => check(v, w.pres) },
  prat: { key: "prat", label: "Präteritum (er/sie …)", answer: (w) => "er " + w.prat, say: (w) => "er " + w.prat.split("/")[0], check: (v, w) => check(v, w.prat) },
  perf: { key: "perf", label: "Perfekt (er/sie …)", answer: (w) => "er " + w.perf, check: (v, w) => checkPerf(v, w.perf), say: (w) => "er " + w.perf.replace(/^(hat|ist)\/(hat|ist)/, "$1") },
};
const MODES = { both: [F.prat, F.perf], perf: [F.perf], prat: [F.prat], pres: [F.pres], all: [F.pres, F.prat, F.perf] };

export default function Verbs() {
  const [mode, setMode] = useState("both");
  return (
    <TypedDrill title="Verb forms" kind="v" filter={(w) => w.t === "v"} fields={MODES[mode]}
      intro="Type the er/sie/es form. For Perfekt include the helper verb, e.g. hat gemacht, ist gegangen."
      extraControls={
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="both">Präteritum + Perfekt</option><option value="perf">Perfekt only</option>
          <option value="prat">Präteritum only</option><option value="pres">Present only</option><option value="all">All three</option>
        </select>
      } />
  );
}
