# Deutsch Vokabeln v2 · German A1 → B1 trainer

Next.js (React) + MongoDB + a free German voice (Piper TTS), all in Docker.

## Run it
You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
cd German_A1-B1/german-vocab
docker compose up -d --build
```

Open **http://localhost:3000**. The first build takes a few minutes (it downloads the German voice, about 60 MB).

Stop: `docker compose down` (your progress stays). Start again: `docker compose up -d`.

## What's inside
| Service | What it does |
|---|---|
| `web` | The Next.js app on port 3000 |
| `mongo` | MongoDB. Your progress is stored in the `mongo-data` volume |
| `tts` | Piper text-to-speech with the German "Thorsten" voice (free, CC0, works offline). Audio is cached |
| `stt` | Whisper speech-to-text (free, MIT). The mic button in the AI chat. Model kept in the `stt-models` volume |
| `ollama` | Self-hosted AI (free, runs on the CPU). Explains wrong answers. The model lives in the `ollama-models` volume |

Pages: Today · Flashcards (spaced repetition, like Anki) · der/die/das drill with hints · Plurals · Verb forms · Word list · Progress · Settings.

## AI teacher (optional)
A small free AI model runs in the `ollama` container, on your own machine or server. Nothing is sent to an outside company.
An admin installs it on the **AI** page (first time: pick **Gemma 4 E4B** and press Install, about 10 GB download).
After that it helps in many places:
- **Ask AI why** on Sentences, Flashcards, Articles, Plurals and Verbs, and ✨ next to each word in the word list.
- **Speaking** page: the AI plays a role (plan a party, at the doctor's, …) and answers in simple German, out loud. Speak with the mic or type; ask for feedback at the end.
- **Writing** page: B1-style emails and forum posts; the AI gives tips (not a score).
- **Progress** page: the AI looks at your weak spots and explains the patterns.
- 👍/👎 under every answer; admins see usage and the 👎 answers on the AI page.

Without the AI you still get **Dictation** (listen and type) and, with the voice service, **Say it** (pronunciation check: the app compares what Whisper heard with the right German, word by word).
- Only one model is kept: switching deletes the old model first, then downloads the new one.
- From a terminal: `bash deploy/ai-model.sh` shows the model, `bash deploy/ai-model.sh gemma4:e4b` switches.
- Gemma 4 E4B needs about 12 GB RAM. On a smaller machine use Gemma 3 4B (6 GB) or Gemma 3 1B.
- The AI only explains. The correct answers and grading still come from the checked sentence list.

## Move your progress from the old one-page app
In the old app: Settings & save → Export progress. In the new app: Settings → Import progress file.

## Add or change words
Words, sentences and grammar notes are stored in the database. To add more, an admin imports a JSON file in **Settings → Words and sentences** (download the example file there to see the format). The files in `data/` are the starting list: new lines there are added on restart or with **Settings → Add new entries from the data files**.
Progress is stored per word (`type:article word`), so adding words never loses progress.

## Backup
Settings → Export backup gives you a JSON file you can import later.

## Develop without Docker (optional)
```bash
npm install
MONGODB_URI=memory npm run dev     # in-memory database, nothing saved
```

## Host on a server (Oracle Cloud Always Free, Hetzner, …)
Copy this folder to an Ubuntu server, then inside it run:
```bash
bash deploy/setup.sh
```
It installs Docker, opens ports 80/443, and starts the app behind HTTPS (Caddy)
at `https://<server-ip-with-dashes>.sslip.io` (or your own domain). Open it and create the first account; it becomes the admin. After that, every push to `main` deploys automatically through GitHub Actions (see `.github/workflows/deploy.yml`). To update by hand instead: copy the new code, then `bash deploy/update.sh`.

## Working with AI assistants
See [AGENTS.md](AGENTS.md) for the full project guide (also used by `CLAUDE.md` and `.github/copilot-instructions.md`).
