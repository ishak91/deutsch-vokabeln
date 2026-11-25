"use client";
import TypedDrill from "@/components/TypedDrill";
import { check } from "@/lib/check";

export default function Plurals() {
  return (
    <TypedDrill title="Plural trainer" kind="p"
      filter={(w) => w.t === "n" && w.pl && w.pl !== "-" && w.pl !== "(pl)"}
      fields={[{ key: "pl", label: "Plural: die …", answer: (w) => "die " + w.pl, say: (w) => "die " + w.pl.split("/")[0], check: (v, w) => check(v, w.pl) }]}
      sayAfter={(w) => "die " + w.pl.split("/")[0]} />
  );
}
