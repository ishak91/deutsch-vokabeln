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

Pages: Today · Flashcards (spaced repetition, like Anki) · der/die/das drill with hints · Plurals · Verb forms · Word list · Progress · Settings.

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
