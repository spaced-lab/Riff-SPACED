FROM python:3.12-slim
WORKDIR /app

# soundfile needs libsndfile; ffmpeg decodes mp3/m4a inputs (optional at runtime).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml backend/README.md ./
COPY backend/riffspaced ./riffspaced
# The schemas and fixtures live at the repo root; copy them next to the package.
COPY shared ./shared
ENV RIFFSPACED_SHARED_DIR=/app/shared

RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "riffspaced.api:app", "--host", "0.0.0.0", "--port", "8000"]
