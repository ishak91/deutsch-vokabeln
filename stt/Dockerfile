FROM python:3.12-slim
ENV WHISPER_MODEL=small MODEL_DIR=/models PYTHONUNBUFFERED=1
# faster-whisper: free speech-to-text (MIT licence). It brings its own audio decoder, so no ffmpeg is needed.
# av is pinned: newer releases dropped an option faster-whisper 1.2.1 still uses when decoding audio
RUN pip install --no-cache-dir faster-whisper==1.2.1 av==15.1.0
COPY server.py /app/server.py
EXPOSE 5003
CMD ["python", "/app/server.py"]
