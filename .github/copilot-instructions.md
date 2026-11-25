# Copilot instructions

The full project guide is in [AGENTS.md](../AGENTS.md) at the repository root. Read it before making changes.

Key rules (details in AGENTS.md):
- Next.js 15 App Router, React 19, plain JavaScript, MongoDB, Piper TTS, Docker Compose. No new dependencies.
- Card ids are `type:word` (nouns include the article, e.g. `n:der Tisch`). Never change how ids are built.
- Add words by appending to `data/vocab-data.txt`; add the English translation of each example to `data/examples-en.txt`.
- Never commit `deploy/Caddyfile`, `.env*`, `*.key` or `*.pem`. Never suggest `docker compose down -v` (it deletes progress).
- `npm run build` must pass; check pages in light and dark mode at phone width.
