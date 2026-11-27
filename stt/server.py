"""Speech to text with Whisper (faster-whisper, free, runs on the CPU).
POST /transcribe?lang=en&prompt=... with the recorded audio as the body -> {"text": "...", "language": "en"}
GET /health -> 200 when the model is loaded, 503 while it is still downloading/loading (JSON with status, model, size)
POST /model?name=base -> deletes the model on disk FIRST, then downloads and loads the new one (in the background)
The model is downloaded on the first start into /models and kept there; /models/current.txt remembers the choice."""
import gc, json, os, shutil, tempfile, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
# names faster-whisper downloads by itself, with their download size in bytes (for the progress bar)
SIZES = {"tiny": 75_500_000, "base": 145_200_000, "small": 484_000_000, "medium": 1_530_000_000, "large-v3-turbo": 1_620_000_000}
MODELS = list(SIZES)
CURRENT = os.path.join(MODEL_DIR, "current.txt")


def chosen():
    try:
        with open(CURRENT) as f:
            name = f.read().strip()
        if name in MODELS:
            return name
    except OSError:
        pass
    return os.environ.get("WHISPER_MODEL", "small")


MODEL = chosen()
THREADS = int(os.environ.get("WHISPER_THREADS", "2"))  # leave CPU for the AI model and the app
MAX_BYTES = 10 * 1024 * 1024

state = {"status": "loading", "error": "", "model": None, "name": MODEL, "since": time.time()}
stats = {"count": 0, "last_secs": None, "total_secs": 0.0, "last_at": None, "last_lang": None, "audio_secs": 0.0}
lock = threading.Lock()  # one recording at a time


def load():
    # Loaded in the background, so the server answers /health (and the app keeps working) while it downloads
    name = state["name"]
    try:
        from faster_whisper import WhisperModel
        state["model"] = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=THREADS, download_root=MODEL_DIR)
        state["status"], state["error"], state["since"] = "ready", "", time.time()
        print(f"Whisper {name} ready on :5003", flush=True)
    except Exception as e:
        state["status"], state["error"] = "error", str(e)
        print(f"Whisper failed to load: {e}", flush=True)


def disk_size():
    total = 0
    for root, _, files in os.walk(MODEL_DIR):
        for f in files:
            try:
                total += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return total


def switch(name):
    # Only one model on disk: drop the loaded one, delete every downloaded file, then fetch the new model
    with lock:
        state.update(status="loading", error="", model=None, name=name, since=time.time())
        gc.collect()
        for entry in os.listdir(MODEL_DIR):
            path = os.path.join(MODEL_DIR, entry)
            shutil.rmtree(path, ignore_errors=True) if os.path.isdir(path) else os.remove(path)
        with open(CURRENT, "w") as f:
            f.write(name)
    print(f"Switching Whisper to {name}", flush=True)
    load()


def transcribe(path, lang, prompt):
    with lock:
        t0 = time.time()
        segments, info = state["model"].transcribe(
            path, language=lang or None, beam_size=1, vad_filter=True,
            initial_prompt=prompt or None, condition_on_previous_text=False)
        text = " ".join(s.text.strip() for s in segments).strip()
        secs = time.time() - t0
        stats.update(count=stats["count"] + 1, last_secs=round(secs, 2), total_secs=stats["total_secs"] + secs,
                     last_at=int(time.time()), last_lang=info.language, audio_secs=stats["audio_secs"] + info.duration)
    return {"text": text, "language": info.language, "secs": round(secs, 2)}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path != "/health":
            return self._json(404, {"error": "not found"})
        ok = state["status"] == "ready"
        self._json(200 if ok else 503, {
            "status": state["status"], "error": state["error"], "model": state["name"], "since": int(state["since"]),
            "size": disk_size(), "expected": SIZES.get(state["name"]), "sizes": SIZES, "threads": THREADS,
            "stats": {k: stats[k] for k in ("count", "last_secs", "last_at", "last_lang")} | {
                "avg_secs": round(stats["total_secs"] / stats["count"], 2) if stats["count"] else None,
                "audio_secs": round(stats["audio_secs"], 1)}})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/model":
            name = (parse_qs(u.query).get("name") or [""])[0]
            if name not in MODELS:
                return self._json(400, {"error": "Unknown model. Use one of: " + ", ".join(MODELS)})
            if state["status"] == "loading":
                return self._json(409, {"error": "A model is still downloading. Wait until it is ready."})
            threading.Thread(target=switch, args=(name,), daemon=True).start()
            return self._json(200, {"ok": True})
        if u.path != "/transcribe":
            return self._json(404, {"error": "not found"})
        if state["status"] != "ready":
            return self._json(503, {"error": "The voice model is still loading. Try again in a minute."})
        size = int(self.headers.get("Content-Length") or 0)
        if not 0 < size <= MAX_BYTES:
            return self._json(400, {"error": "The recording is empty or too long."})
        q = parse_qs(u.query)
        lang = (q.get("lang") or [""])[0][:5]
        prompt = (q.get("prompt") or [""])[0][:300]
        data = self.rfile.read(size)
        with tempfile.NamedTemporaryFile(suffix=".audio") as f:
            f.write(data); f.flush()
            try:
                self._json(200, transcribe(f.name, lang, prompt))
            except Exception as e:  # a broken recording should not stop the service
                self._json(400, {"error": f"Couldn't understand the recording: {e}"})

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    threading.Thread(target=load, daemon=True).start()
    os.makedirs(MODEL_DIR, exist_ok=True)
    print(f"Whisper server on :5003, loading model {MODEL}…", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 5003), Handler).serve_forever()
