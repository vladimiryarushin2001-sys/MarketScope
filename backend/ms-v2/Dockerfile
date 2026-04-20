FROM python:3.11-slim

# ── Системные зависимости ──────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg2 curl \
    xvfb \
    # Chrome runtime deps
    libglib2.0-0 libnss3 libfontconfig1 \
    libxcb1 libxkbcommon0 libx11-6 libx11-xcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 \
    libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    libgbm1 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# ── Google Chrome ──────────────────────────────────────────────────────────────
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
        http://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python-зависимости ─────────────────────────────────────────────────────────
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt \
    && pip install \
        fastapi \
        "uvicorn[standard]" \
        "celery[redis]" \
        redis

# ── Playwright (Chromium для блоков 2, 4) ─────────────────────────────────────
RUN playwright install chromium --with-deps

# ── Исходный код проекта ───────────────────────────────────────────────────────
COPY . .

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
# Виртуальный дисплей для undetected-chromedriver (блок 3, Яндекс)
ENV DISPLAY=:99
