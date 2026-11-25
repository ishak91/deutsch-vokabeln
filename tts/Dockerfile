FROM python:3.12-slim
ARG PIPER_VOICE=de_DE-thorsten-medium
ENV PIPER_VOICE=${PIPER_VOICE} VOICE_DIR=/voices CACHE_DIR=/cache PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir piper-tts==1.8.0
# Download the free German voice (Thorsten, CC0 licence) once at build time
RUN mkdir -p /voices && python -m piper.download_voices --download-dir /voices ${PIPER_VOICE}
COPY server.py /app/server.py
EXPOSE 5002
CMD ["python", "/app/server.py"]
