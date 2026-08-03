FROM python:3.11-slim

# OpenCV headless runtime deps (libGL, glib) absent from the slim base image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/vision

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_ROOT=/models

# Install dependencies before copying source so image rebuilds stay cached.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Model weights are NOT baked into the image (~150 MB). Mount a volume that
# contains the buffalo_l pack at $MODEL_ROOT/models/buffalo_l, or let
# insightface download it on first start (needs network at runtime).
#   docker run --rm -p 8000:8000 \
#     -v "$HOME/.insightface:/models" \
#     attendance-vision-service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
