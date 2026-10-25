FROM python:3.12-slim
WORKDIR /app

# soundfile needs libsndfile; ffmpeg decodes mp3/m4a inputs (optional at runtime).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/README.md ./
COPY backend/riffspaced ./riffspaced
COPY backend/tools ./tools
# The schemas and fixtures live at the repo root; copy them next to the package.
COPY shared ./shared
ENV RIFFSPACED_SHARED_DIR=/app/shared

RUN pip install --no-cache-dir .

# Run as an unprivileged user; nothing here needs root once the packages are installed.
RUN useradd --create-home --uid 10001 riff && chown -R riff:riff /app
USER riff

EXPOSE 8000
# The health probe is what compose and orchestrators wait on before routing traffic.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"
CMD ["uvicorn", "riffspaced.api:app", "--host", "0.0.0.0", "--port", "8000"]
