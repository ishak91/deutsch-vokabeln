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
  Ubuntu server behind Caddy (HTTPS). Login is the app's own accounts.

Multi-user: every account has its own, fully separate progress (see "Accounts"). Keep the UI simple, modern and
mobile friendly.

## Stack

| Part | Tech |
|---|---|
| Web app | Next.js 15.5 (App Router), React 19, **plain JavaScript** (no TypeScript), `output: "standalone"` |
| Database | MongoDB 7 (driver 6.10). `MONGODB_URI=memory` switches to a built-in in-memory store for tests |
| AI | Ollama (`ollama/ollama`, CPU only), default model `gemma4:e4b`; explains answers, never grades or writes content |
| Voice | Python 3.12 + `piper-tts` 1.8.0, voice `de_DE-thorsten-medium` (CC0), tiny HTTP server, WAV cache on disk |
| Styling | One global stylesheet `app/globals.css`, CSS variables, light/dark theme, Inter font. No CSS framework |
| Hosting | Docker Compose; `docker-compose.prod.yml` adds Caddy (HTTPS via Let's Encrypt) |

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
  learn/page.js         Flashcards (SRS): EN->DE / DE->EN, optional typed answer, multiple-choice fallback, grades 0-3
  sentences/page.js     sentence translation DE->EN: graded, grammar note, adaptive Easy/Medium/Hard, rounds of 10
  articles/page.js      der/die/das drill with hints
  plurals/page.js       plural drill (uses TypedDrill)
  verbs/page.js         verb-form drill: er-present, Präteritum, Perfekt (uses TypedDrill)
  words/page.js         searchable word list with status
  progress/page.js      stats, streak, per-week progress
  settings/page.js      start date, new cards/day, direction, auto-speak, import/export, reset, reload word list, account
  ai/page.js            admin only: AI model in use, RAM/disk, switch model (deletes the old one first), test
  users/page.js         admin only: list, create, reset password, make admin, delete accounts; sign-up switch
  api/                  route handlers (all JSON unless noted). All except auth/* and tts need a login (withUser)
    auth/               me (who is logged in, setup needed?), login, logout, setup (first admin), signup, password
    users/              admin only: GET list + stats, POST create, PUT update or {config}, DELETE ?id=
    words/              GET  words + week themes
    content/            GET  all content as JSON (?example=1 sample file); POST import (admin; preview, ?save=1 saves)
    state/              GET  settings, cards, quiz, log
    review/             POST save one SRS review
    quiz/               POST save one drill result
    sentences/          GET  sentence bank + grammar topics
    sentence/           POST save one sentence answer (schedule, points from the sentence level, adaptive level)
    settings/           PUT  update settings
    import/ export/     POST import progress JSON / GET export it
    reset/              POST delete progress (cards, quiz, log)
    reload/             POST add new entries from the data/ files to the database (admin only, content is shared)
    ai/                 GET  {ok, model, installing}; ai/explain POST {id, answer, result} -> streamed text;
                        ai/admin (admin) GET info, POST {model} install or {test:true}, DELETE ?model=
    tts/                GET  ?text=... -> audio/wav, proxies the tts service, supports HTTP Range (iPhone Safari)
components/
  Store.js              React context: loads words + state, grade(), quizResult(), totalPoints, derived week info
  Shell.js              header, nav, points pill, user pill (log out), ThemeToggle; shows <Login> when logged out
  Login.js              login form; first-account setup form when no user exists; optional sign-up
  Word.js               DeWord (coloured article), Forms, ConjTable, ArticleHint, UmlautBar, ScopeSelect, Example
  TypedDrill.js         shared typed-answer drill used by plurals and verbs
  AskAI.js              "Ask AI why" button + streamed answer box; useAiReady(), streamAi()
  Audio.js              speak(text, {repeatSlower}) and <SpeakButton>; repeat clicks within 10 s play slower
  ThemeToggle.js        Auto -> Light -> Dark, stored in localStorage "theme"
  useKeys.js            keyboard shortcuts
lib/
  auth.js               users (scrypt password hashes), sessions (SHA-256 of a random token), login throttle, config
  session.js            route helpers: getUser(req), withUser(handler, {admin}), sessionCookie()
  db.js                 Mongo or in-memory store; getState, saveReview, saveQuiz, saveSentence, import/export progress
  content.js            shared content in the DB: syncFromFiles, getWords, getSentences, importContent, exportContent
  parse.js              parseVocab, parseTranslations, parseSentences, parseGrammar (the data/ text formats)
  ai.js                 Ollama client: one model on disk (install = delete all, then pull), job progress, chat
                        stream (one answer at a time), prompts, answer cache, 40 questions/user/hour
  srs.js                SM-2 schedule(prev, grade), status(), fmtIvl(), dayKey()
  check.js              answer checking: check, checkPerf (Perfekt), checkTyped (scores 10/5/2/0)
  choices.js            checkMeaning (typed English, DE->EN) and pickChoices (multiple-choice options + distractors)
  hints.js              article rules and hints (endings, compounds, natural gender, exceptions)
  sentences.js          sentence practice: gradeTranslation, nextLevel (adaptive), schedule, pickSentence, word glosses
  conjugate.js          builds full Präsens/Präteritum/Perfekt tables for all pronouns from 4 stored forms
data/
  vocab-data.txt        starting word list (see format below); copied into the database on start
  examples-en.txt       English translation for every example sentence: German|English
  sentences-data.txt    sentences to translate: s|id|E/M/H|German|English / English|tags|grammar note (see file header)
  grammar.txt           grammar topic per tag: tag|A1/A2/B1|Title|Explanation
tts/                    Dockerfile + server.py (Piper). GET /tts?text=, GET /health
deploy/
  setup.sh              first-time server setup (Docker, iptables 80/443, domain, Caddyfile, start)
  update.sh             rebuild on the server after new code arrives
  ai-model.sh           switch the AI model from a terminal (deletes the old model first)
  Caddyfile             GENERATED by setup.sh (site address + reverse proxy), server-only, git-ignored
.github/workflows/
  deploy.yml            auto-deploy to the server on push to main
docker-compose.yml      web (3000), mongo (volume mongo-data), tts (volume tts-cache), ollama (volume ollama-models)
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
- After editing: Settings -> "Add new entries from the data files" (or restart `web`). No rebuild needed.

## Content lives in the database

Words, sentences, grammar topics and week themes are stored in MongoDB (`words`, `sentences`, `grammar`,
`meta.weeks`) and shared by all accounts. The `data/` text files are only a starting point (`lib/content.js`):

- On server start (and with the Settings button) every file entry is added if missing, and refreshed if it still has
  `src: "file"`. Entries imported or changed in the app have `src: "import"` and the files never overwrite them.
- Nothing is deleted automatically (old ids could hold progress).
- Admins import a JSON file in Settings ("Import file…"): the server checks it and shows a preview (new / replaced /
  errors), then saves on confirm. Same id = replace, otherwise add. "Download all" exports the same format, so it
  doubles as a content backup. Format (see `EXAMPLE` in `lib/content.js`, or `/api/content?example=1`):

```json
{ "weeks": { "18": "Essen und Trinken" },
  "words": [ { "type": "noun", "week": 18, "article": "der", "word": "Löffel", "plural": "Löffel", "en": "spoon",
               "example": "Ich brauche einen Löffel.", "exampleEn": "I need a spoon.", "hint": "" },
             { "type": "verb", "week": 18, "word": "schmecken", "present": "schmeckt", "past": "schmeckte",
               "perfect": "hat geschmeckt", "en": "to taste" },
             { "type": "word", "week": 18, "word": "lecker", "en": "tasty" },
             { "type": "phrase", "week": 18, "word": "Guten Appetit!", "en": "Enjoy your meal!" } ],
  "sentences": [ { "id": "18e01", "week": 18, "level": "E", "de": "…", "en": ["…", "…"], "tags": ["v2"], "note": "…" } ],
  "grammar": [ { "tag": "v2", "level": "A1", "title": "…", "text": "…" } ] }
```

  Sentence `id` is optional on new sentences (the next free `<week><e|m|h><nn>` is used).

**Card ids are `type:word`, with the article for nouns**, e.g. `n:der Tisch`, `v:gehen`, `w:schnell`.
Progress is keyed by these ids, and they match the old v1 HTML app's export. **Never change how ids are built**, and
don't rename existing words casually: a changed spelling is a new card and the old progress is orphaned.
To add words, append lines; don't rebuild the list. The plan targets about 2,400 words in total, so more are welcome,
at the right CEFR level for the week's theme, with natural example sentences.

## Data model (MongoDB, database `german_vocab`)

| Collection | `_id` | Content |
|---|---|---|
| `words` | card id | parsed entry: `t` (n/v/w/p), `de`, `art`, `pl`, `pres`, `prat`, `perf`, `en`, `ex`, `exEn`, `hint`, `week`, `order`, `src` (file/import) |
| `sentences` | sentence id | `week`, `lv` (E/M/H), `de`, `en` [accepted answers], `tags`, `note`, `order`, `src` |
| `grammar` | tag | `level` (A1/A2/B1), `title`, `text`, `src` |
| `meta` | `weeks` / `config` | week themes; app config `{signup}` (shared by everyone) |
| `users` | username | `{name, admin, hash, created}`; hash is `scrypt$salt$hash` |
| `sessions` | SHA-256 of token | `{u, exp}`; TTL index removes expired logins |
| `settings` | user id | `{value: {startDate, newPerDay, direction, autoSpeak, weekOverride}}` |
| `cards` | `<user>/<card id>` | `u`, `k` (card id) + SRS state `{s: new/learn/review, ivl, ease, step, reps, lapses, due}` |
| `quiz` | `<user>/<card id>` | `u`, `k` + drill tallies `{<kind>: {0: right, 1: wrong}}` |
| `log` | `<user>/YYYY-MM-DD` | `u`, `k` (day) + daily counters `{rev, nw, ok, bad, quiz, quizOk, sent, sentOk, pts}` |
| `sent` | `<user>/<sentence id>` | `u`, `k` + `{ok, almost, bad, streak, due, last, own}` (own = answers the learner marked right) |

Every progress query filters by `u` (indexed). Card ids themselves never change; only the stored `_id` gets the user
prefix, and the API strips `u`/`k` again, so the client and export format still see plain card ids.

Export/import JSON: `{app: "deutsch-vokabeln", version: 2, settings, cards, quiz, log, sent}` (quiz as `[right, wrong]`).
Import replaces current progress.

## Accounts

- Every route that reads or writes progress is wrapped in `withUser` and passes `user.id` to `lib/db.js`. Never take
  the owner from the request body. `/api/tts` stays open (iOS fetches audio without cookies).
- Login cookie `gv_session`: httpOnly, SameSite=Lax, Secure behind HTTPS (`X-Forwarded-Proto`), 90 days.
  Changing a password logs out all of that user's devices.
- **First account**: while `users` is empty the app shows a setup form. That account becomes admin and
  `adoptLegacyProgress()` moves the old single-user docs (no `u` field) and `meta.settings` into it, so nothing is lost.
- Admins create accounts on the Users page; self sign-up is off unless an admin switches it on. At least one admin
  must remain. Deleting a user deletes their progress (asks to type the username).
- 5 wrong passwords per username or IP pause logins for 15 minutes (in memory, resets on restart).

## Learning logic

- **SRS (lib/srs.js)**: grades 0 Again, 1 Hard, 2 Good, 3 Easy. Learning steps 1 min / 5 min / 10 min; Good
  graduates after the second step to 1 day, Easy graduates straight to 4 days. Reviews multiply by ease (min 1.3).
  Mature = interval of 21 days or more.
- **Current week** is computed from `settings.startDate` (or `weekOverride`); new cards come from weeks up to it.
- **Points** (`log.pts`): typed EN->DE answer +10 exact, +5 if only case/umlaut is off, +2 right noun with wrong
  article; typed DE->EN +5; right multiple-choice pick +2; each correct drill answer +2.
- **Multiple-choice fallback** (Learn page): a wrong typed answer or "I don't know" first shows 5 options
  (same word type, from weeks already reached; EN->DE noun options include the article, and one option is the
  right noun with a wrong article). A right pick is graded 1 Hard (+2 points), a weaker pass than typing.
  A wrong pick or "I still don't know" shows the answer and grades the card 0, so it comes back within minutes.
- **Typed DE->EN**: any one of the meanings separated by `,` `;` `/` counts; "to", "the", "a" and brackets are
  ignored and one typo is forgiven in words of 5+ letters. +5 points.
- **Sentences (lib/sentences.js)**: pre-written bank (starts from `data/sentences-data.txt`; Easy = A1 grammar, Medium = A2,
  Hard = B1; words from the sentence's week or earlier). Grading ignores order, case, punctuation, a/an/the,
  contractions and UK/US spelling, knows a few synonyms plus the word list's meanings, forgives one typo in 5+ letter
  words; result Right / Almost (small difference) / Wrong; a missing "not" counts double. "I was right" saves the
  answer for that learner. Level: 3 Right in a row moves up, 2 misses in the last 3 (Almost = half) moves down;
  3 in 4 sentences at the level, 1 in 8 easier, 1 in 8 harder. Points: Easy 4, Medium 6, Hard 8 (Almost half).
  Sentence ids never change (progress is keyed by them). Every German sentence must be checked for correctness.
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
- `/api/tts` needs no login, because iOS fetches media without the page's cookies.
- The voice service caches WAVs in the `tts-cache` volume. `LENGTH_SCALE` (default 1.1) slows speech slightly.

## AI teacher (Ollama)

- `ollama` service, not exposed, `OLLAMA_CONTEXT_LENGTH=2048`, one request at a time, model unloads after 30 min idle.
  No model is downloaded automatically: an admin installs one on the AI page (or `deploy/ai-model.sh`).
- **Only one model on disk.** Installing deletes every installed model first, then pulls the new one (disk and RAM
  are small). The chosen model is stored in `meta` `_id: "ai"`; if it's missing, the first installed model is used.
- The AI explains; it never grades answers or writes German content (small models make mistakes). The prompt always
  includes the checked accepted answers and grammar note from the database, not text from the client.
- Thinking models (Gemma 4) get `think: false`, otherwise they "think" silently for a long time on CPU.
- Server size matters: Gemma 4 E4B needs ~12 GB RAM; the Oracle free tier allows 4 OCPU / 24 GB.
- Without a model (or without the service, e.g. `MONGODB_URI=memory` dev) the AI buttons simply don't show.

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

- First time: `bash deploy/setup.sh` (installs Docker, opens iptables 80/443, asks the address, writes
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
3. Keep card ids stable (see above). Extend `data/vocab-data.txt` (or import JSON); don't regenerate it.
4. Plain JavaScript, no new dependencies, one stylesheet. Match the existing code style (small functions,
   short comments that explain why).
5. After code changes: `npm run build` must pass; check the affected page in light and dark mode on a narrow screen.
6. German content must be correct (articles, plurals, verb forms, example sentences at the right level).
   When unsure about a form, say so rather than guess.
7. Explain changes to the learner in simple language; they are learning both German and the tooling.
