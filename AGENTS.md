# AGENTS.md: project guide for AI coding assistants

This file is the single source of context for AI tools (Claude Code, GitHub Copilot, Cursor, Codex and others).
`CLAUDE.md` and `.github/copilot-instructions.md` point here. Keep this file up to date when the project changes.

## What this is

**Deutsch Vokabeln** is a personal, Anki-style German vocabulary trainer for one learner going from **A1 to B1**
(target: B1 exam, Telc or Goethe, end of March 2027). The learner's native study language is English.

- About 1,015 words over a **17-week plan** (nouns, verbs, other words, phrases), grouped by week and theme.
- Spaced-repetition flashcards (SM-2, like Anki), article (der/die/das) drills with memory hints, plural drills,
  verb-form drills with full conjugation tables, a word list, progress stats and points.
- Real German pronunciation from a self-hosted **Piper TTS** voice (browser speech sounded English, so it is not used
  unless the device has a German voice).
- Runs with Docker Compose on the learner's Mac (`http://localhost:3000`) and on an Oracle Cloud Always Free
  Ubuntu server behind Caddy (HTTPS + basic login).

Single user, no accounts. Keep the UI simple, modern and mobile friendly.

## Stack

| Part | Tech |
|---|---|
| Web app | Next.js 15.5 (App Router), React 19, **plain JavaScript** (no TypeScript), `output: "standalone"` |
| Database | MongoDB 7 (driver 6.10). `MONGODB_URI=memory` switches to a built-in in-memory store for tests |
| Voice | Python 3.12 + `piper-tts` 1.8.0, voice `de_DE-thorsten-medium` (CC0), tiny HTTP server, WAV cache on disk |
| Styling | One global stylesheet `app/globals.css`, CSS variables, light/dark theme, Inter font. No CSS framework |
| Hosting | Docker Compose; `docker-compose.prod.yml` adds Caddy (HTTPS via Let's Encrypt, basic_auth) |

No other runtime dependencies. Do not add libraries (UI kits, state managers, ORMs, TypeScript) unless asked.

## Run, build, test

```bash
# Full app (what the learner uses)
docker compose up -d --build          # http://localhost:3000
docker compose up -d --build web      # rebuild only the web app after code changes

# Development without Docker (no voice, nothing saved)
npm install
MONGODB_URI=memory npm run dev        # or: npm run build && MONGODB_URI=memory npm start
```

There is no automated test suite. Verify changes by running `npm run build` (must compile) and checking the pages
in a browser with `MONGODB_URI=memory`. Audio needs the `tts` service (set `TTS_URL`, default `http://localhost:5002`).

**Never run `docker compose down -v`**: `-v` deletes the `mongo-data` volume, which holds all learning progress.
`docker compose down` (without `-v`) is safe.

## Repository layout

```
app/                    Next.js App Router
  layout.js             <html>, theme script (sets data-theme before paint), Inter font, <Shell>
  globals.css           all styles; tokens on :root, dark values under [data-theme="dark"] / prefers-color-scheme
  page.js               Today: due cards, new words this week, points
  learn/page.js         Flashcards (SRS): EN->DE / DE->EN, optional typed answer, "I don't know", grades 0-3
  articles/page.js      der/die/das drill with hints
  plurals/page.js       plural drill (uses TypedDrill)
  verbs/page.js         verb-form drill: er-present, Präteritum, Perfekt (uses TypedDrill)
  words/page.js         searchable word list with status
  progress/page.js      stats, streak, per-week progress
  settings/page.js      start date, new cards/day, direction, auto-speak, import/export, reset, reload word list
  api/                  route handlers (all JSON unless noted)
    words/              GET  words + week themes
    state/              GET  settings, cards, quiz, log
    review/             POST save one SRS review
    quiz/               POST save one drill result
    settings/           PUT  update settings
    import/ export/     POST import progress JSON / GET export it
    reset/              POST delete progress (cards, quiz, log)
    reload/             POST re-seed words from data/vocab-data.txt
    tts/                GET  ?text=... -> audio/wav, proxies the tts service, supports HTTP Range (iPhone Safari)
components/
  Store.js              React context: loads words + state, grade(), quizResult(), totalPoints, derived week info
  Shell.js              header, nav, points pill, ThemeToggle
  Word.js               DeWord (coloured article), Forms, ConjTable, ArticleHint, UmlautBar, ScopeSelect, Example
  TypedDrill.js         shared typed-answer drill used by plurals and verbs
  Audio.js              speak(text, {repeatSlower}) and <SpeakButton>; repeat clicks within 10 s play slower
  ThemeToggle.js        Auto -> Light -> Dark, stored in localStorage "theme"
  useKeys.js            keyboard shortcuts
lib/
  db.js                 Mongo or in-memory store; seedWords, getWords, getState, saveReview, saveQuiz, ...
  parse.js              parseVocab(text, translations), parseTranslations(text)
  srs.js                SM-2 schedule(prev, grade), status(), fmtIvl(), dayKey()
  check.js              answer checking: check, checkPerf (Perfekt), checkTyped (scores 10/5/2/0)
  hints.js              article rules and hints (endings, compounds, natural gender, exceptions)
  conjugate.js          builds full Präsens/Präteritum/Perfekt tables for all pronouns from 4 stored forms
data/
  vocab-data.txt        THE word list (see format below). Mounted into the container; edit without rebuilding
  examples-en.txt       English translation for every example sentence: German|English
tts/                    Dockerfile + server.py (Piper). GET /tts?text=, GET /health
deploy/
  setup.sh              first-time server setup (Docker, iptables 80/443, domain, login, Caddyfile, start)
  update.sh             rebuild on the server after new code arrives
  Caddyfile             GENERATED by setup.sh, contains the password hash, git-ignored. Never commit it
.github/workflows/
  deploy.yml            auto-deploy to the server on push to main
docker-compose.yml      web (3000), mongo (volume mongo-data), tts (volume tts-cache)
docker-compose.prod.yml adds caddy (80/443, volumes caddy-data/caddy-config), hides web's port 3000
```

Imports use the `@/` alias (see `jsconfig.json`), e.g. `import { conjugate } from "@/lib/conjugate"`.

## Word list format (`data/vocab-data.txt`)

Pipe-separated, one entry per line. `#` lines are comments.

```
## <week number> | <theme>                      starts a new week
n|article|Noun|Plural|English|Example|Hint        noun. Plural "-" = none, "(pl)" = plural-only. Hint optional
v|Infinitive|er-present|er-Präteritum|Perfekt|English|Example
w|word|English|Example                          adjectives, adverbs, other words
p|German phrase|English                         phrases (Redemittel)
```

- Alternatives use `/`, e.g. Präteritum `hängte/hing`, Perfekt `hat/ist gefahren`.
- Separable verbs keep the particle in the forms: `aufstehen|steht auf|stand auf|ist aufgestanden`.
- Reflexive verbs start with `sich`: `sich freuen|freut sich|freute sich|hat sich gefreut`.
- Every example sentence needs a matching line in `data/examples-en.txt` (`German|English`).
- After editing: Settings -> "Reload word list" in the app (or restart `web`). No rebuild needed.

**Card ids are `type:word`, with the article for nouns**, e.g. `n:der Tisch`, `v:gehen`, `w:schnell`.
Progress is keyed by these ids, and they match the old v1 HTML app's export. **Never change how ids are built**, and
don't rename existing words casually: a changed spelling is a new card and the old progress is orphaned.
To add words, append lines; don't rebuild the list. The plan targets about 2,400 words in total, so more are welcome,
at the right CEFR level for the week's theme, with natural example sentences.

## Data model (MongoDB, database `german_vocab`)

| Collection | `_id` | Content |
|---|---|---|
| `words` | card id | parsed entry: `t` (n/v/w/p), `de`, `art`, `pl`, `pres`, `prat`, `perf`, `en`, `ex`, `exEn`, `hint`, `week`, `order` |
| `meta` | `weeks` / `settings` | week themes; settings `{startDate, newPerDay, direction, autoSpeak, weekOverride}` |
| `cards` | card id | SRS state `{s: new/learn/review, ivl, ease, step, reps, lapses, due}` |
| `quiz` | card id | drill tallies `{<kind>: {0: right, 1: wrong}}` |
| `log` | `YYYY-MM-DD` | daily counters `{rev, nw, ok, bad, quiz, quizOk, pts}` |

Export/import JSON: `{app: "deutsch-vokabeln", version: 2, settings, cards, quiz, log}` (quiz as `[right, wrong]`).
Import replaces current progress.

## Learning logic

- **SRS (lib/srs.js)**: grades 0 Again, 1 Hard, 2 Good, 3 Easy. Learning steps 1 min / 5 min / 10 min; Good
  graduates after the second step to 1 day, Easy graduates straight to 4 days. Reviews multiply by ease (min 1.3).
  Mature = interval of 21 days or more.
- **Current week** is computed from `settings.startDate` (or `weekOverride`); new cards come from weeks up to it.
- **Points** (`log.pts`): typed EN->DE answer +10 exact, +5 if only case/umlaut is off, +2 right noun with wrong
  article; each correct drill answer +2.
- **"I don't know"** shows the answer and grades the card 0, so it comes back within minutes.
- **Article hints (lib/hints.js)** use ending rules, compounds (last part decides) and natural gender, and flag
  exceptions. Keep rules conservative: a wrong hint is worse than none.
- **Conjugation (lib/conjugate.js)** derives every form from the 4 stored forms (infinitive, er-present,
  er-Präteritum, Perfekt) plus irregular tables for sein, haben, werden, wissen, modal verbs and tun. It handles
  vowel changes, separable particles, reflexives (`mich/dich/sich/uns/euch/sich`) and `werden` passives.
  If a verb comes out wrong, prefer fixing the rule or adding to the irregular table over special-casing in the UI.

## Audio

- `speak()` plays `/api/tts?text=...` through an `Audio` element inside the click handler (mobile autoplay rules).
  Clicking the same text again within 10 s plays at 0.75x, then 0.6x.
- `/api/tts` buffers the WAV from the `tts` service and answers `Range` requests with 206. iPhone Safari needs this.
- In production Caddy exempts `/api/tts` from basic_auth, because iOS fetches media without the page's login.
- The voice service caches WAVs in the `tts-cache` volume. `LENGTH_SCALE` (default 1.1) slows speech slightly.

## UI conventions

- Simple, modern, monochrome base with der/die/das colours (`--der` blue, `--die` pink, `--das` green).
- Use the CSS variables (`--bg --panel --ink --muted --line --soft --accent ...`); every colour must work in both
  themes. Test light and dark at phone width (390 px) and desktop.
- German text in the UI: correct umlauts and ß, nouns capitalised, articles shown in colour via `<DeWord>`.
- Any German word or form shown to the learner should have a `<SpeakButton>` where it helps.
- Keep explanations short and in plain English; the learner is a beginner.

## Deployment

**Learner's Mac**: `docker compose up -d --build web` in this folder.

**Oracle Cloud server** (Ubuntu, Ampere A1, public IP, HTTPS at `https://<ip-with-dashes>.sslip.io` or a custom
domain):

- First time: `bash deploy/setup.sh` (installs Docker, opens iptables 80/443, asks address and login, writes
  `deploy/Caddyfile`, starts everything with both compose files).
- Updates are automatic: `.github/workflows/deploy.yml` runs on every push to `main` (or "Run workflow" in the
  Actions tab). It rsyncs the code over SSH (no GitHub access needed on the server), keeping `deploy/Caddyfile`
  and `.env*`, then runs `deploy/update.sh` and checks the site answers. Repo secrets: `SSH_HOST`, `SSH_USER`,
  `SSH_PRIVATE_KEY`, optional `DEPLOY_PATH` (default `/home/ubuntu/german-vocab`). Manual fallback: copy the code,
  then `bash deploy/update.sh`.
- The server folder is overwritten by each deploy: change code in the repo, never directly on the server.
- Commands on the server always use both files:
  `sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml <command>`.
- After editing `deploy/Caddyfile`, recreate Caddy (`up -d --force-recreate caddy`), since a plain restart can
  keep the old bind-mounted file.
- The server currently runs Ubuntu 20.04, where Docker's install script fails on `docker-model-plugin`;
  setup.sh falls back to installing the core Docker packages with apt.

## Rules for AI assistants

1. Never commit secrets: `deploy/Caddyfile`, `.env*`, `*.key`, `*.pem` are git-ignored. Keep it that way.
2. Never delete or reset learning progress, and never suggest `docker compose down -v`.
3. Keep card ids stable (see above). Extend `data/vocab-data.txt`; don't regenerate it.
4. Plain JavaScript, no new dependencies, one stylesheet. Match the existing code style (small functions,
   short comments that explain why).
5. After code changes: `npm run build` must pass; check the affected page in light and dark mode on a narrow screen.
6. German content must be correct (articles, plurals, verb forms, example sentences at the right level).
   When unsure about a form, say so rather than guess.
7. Explain changes to the learner in simple language; they are learning both German and the tooling.
