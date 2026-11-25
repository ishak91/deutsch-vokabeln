"""German text-to-speech with Piper (free, offline, real German voice).
GET /tts?text=Guten%20Tag -> audio/wav. Generated audio is cached on disk."""
import hashlib, io, os, threading, wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from piper import PiperVoice, SynthesisConfig

VOICE = os.environ.get("PIPER_VOICE", "de_DE-thorsten-medium")
VOICE_DIR = os.environ.get("VOICE_DIR", "/voices")
CACHE = os.environ.get("CACHE_DIR", "/cache")
SPEED = float(os.environ.get("LENGTH_SCALE", "1.1"))  # >1 = slower, clearer for learners
os.makedirs(CACHE, exist_ok=True)

voice = PiperVoice.load(os.path.join(VOICE_DIR, VOICE + ".onnx"))
lock = threading.Lock()
config = SynthesisConfig(length_scale=SPEED)


def synth(text: str) -> bytes:
    key = hashlib.sha1(f"{VOICE}|{SPEED}|{text}".encode()).hexdigest()
    path = os.path.join(CACHE, key + ".wav")
    if os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    buf = io.BytesIO()
    with lock, wave.open(buf, "wb") as wf:
        voice.synthesize_wav(text, wf, syn_config=config)
    data = buf.getvalue()
    with open(path + ".tmp", "wb") as f:
        f.write(data)
    os.replace(path + ".tmp", path)
    return data


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/health":
            return self._send(200, b"ok", "text/plain")
        if u.path != "/tts":
            return self._send(404, b"not found", "text/plain")
        text = (parse_qs(u.query).get("text") or [""])[0].strip()[:300]
        if not text:
            return self._send(400, b"text required", "text/plain")
        try:
            self._send(200, synth(text), "audio/wav")
        except Exception as e:  # keep serving even if one phrase fails
            self._send(500, str(e).encode(), "text/plain")

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=31536000")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"Piper TTS ready with voice {VOICE} on :5002", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 5002), Handler).serve_forever()
