"use client";
// German pronunciation: Piper TTS (real German voice, runs in Docker). Falls back to a German browser voice.
const cache = new Map();
let current = null;

function browserSpeak(text, rate = 1) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  const de = voices.find(v => /^de[-_]DE/i.test(v.lang)) || voices.find(v => /^de/i.test(v.lang));
  if (!de) return; // never read German with an English voice
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = "de-DE"; u.voice = de; u.rate = 0.9 * rate;
  speechSynthesis.speak(u);
}

// Clicking the same word again within 10 s plays it slower: normal -> 0.75x -> 0.6x
const RATES = [1, 0.75, 0.6];
let last = { text: null, at: 0, n: 0 };

export function speak(text, { repeatSlower = false } = {}) {
  if (!text) return;
  let step = 0;
  if (repeatSlower) {
    const now = Date.now();
    step = last.text === text && now - last.at < 10000 ? Math.min(last.n + 1, RATES.length - 1) : 0;
    last = { text, at: now, n: step };
  }
  const rate = RATES[step];
  if (current) { current.pause(); current = null; }
  let a = cache.get(text);
  if (!a) { a = new Audio("/api/tts?text=" + encodeURIComponent(text)); cache.set(text, a); }
  a.currentTime = 0;
  a.preservesPitch = true;
  a.playbackRate = rate;
  current = a;
  a.play().catch(() => { cache.delete(text); browserSpeak(text, rate); });
}

export function SpeakButton({ text, label = "Listen (click again for slower)", small = false }) {
  return (
    <button type="button" className={"speak" + (small ? " sm" : "")} aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); speak(text, { repeatSlower: true }); }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>
    </button>
  );
}
