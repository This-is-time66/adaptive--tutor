# ── Base image ────────────────────────────────────────────────
FROM python:3.10-slim

# ── Working directory ──────────────────────────────────────────
WORKDIR /app

# ── Install dependencies first (layer-cache friendly) ─────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy the entire project ────────────────────────────────────
COPY . .

# ── Sanity-check that critical files are present ───────────────
RUN ls -la /app/templates/index.html && \
    ls -la /app/static/css/style.css && \
    ls -la /app/static/js/script.js

# ── Hugging Face Spaces uses port 7860 ────────────────────────
EXPOSE 7860

# ── Start the app ─────────────────────────────────────────────
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]