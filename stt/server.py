"""Speech to text with Whisper (faster-whisper, free, runs on the CPU).
POST /transcribe?lang=en&prompt=... with the recorded audio as the body -> {"text": "...", "language": "en"}
GET /health -> 200 when the model is loaded, 503 while it is still downloading/loading.
The model (about 500 MB for "small") is downloaded on the first start into /models and kept there."""
import json, os, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

MODEL = os.environ.get("WHISPER_MODEL", "small")
MODEL_DIR = os.environ.get("MODEL_DIR", "/models")
THREADS = int(os.environ.get("WHISPER_THREADS", "2"))  # leave CPU for the AI model and the app
MAX_BYTES = 10 * 1024 * 1024

state = {"status": "loading", "error": "", "model": None}
lock = threading.Lock()  # one recording at a time


def load():
    # Loaded in the background, so the server answers /health (and the app keeps working) while it downloads
    try:
        from faster_whisper import WhisperModel
        state["model"] = WhisperModel(MODEL, device="cpu", compute_type="int8", cpu_threads=THREADS, download_root=MODEL_DIR)
        state["status"] = "ready"
        print(f"Whisper {MODEL} ready on :5003", flush=True)
    except Exception as e:
        state["status"], state["error"] = "error", str(e)
        print(f"Whisper failed to load: {e}", flush=True)


def transcribe(path, lang, prompt):
    with lock:
        segments, info = state["model"].transcribe(
            path, language=lang or None, beam_size=1, vad_filter=True,
            initial_prompt=prompt or None, condition_on_previous_text=False)
        text = " ".join(s.text.strip() for s in segments).strip()
    return {"text": text, "language": info.language}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path != "/health":
            return self._json(404, {"error": "not found"})
        ok = state["status"] == "ready"
        self._json(200 if ok else 503, {"status": state["status"], "error": state["error"], "model": MODEL})

    def do_POST(self):
        u = urlparse(self.path)
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
    print(f"Whisper server on :5003, loading model {MODEL}…", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 5003), Handler).serve_forever()
