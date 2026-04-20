#!/bin/bash
set -e

# Запускаем виртуальный дисплей — нужен для undetected-chromedriver
# (блок 3, парсинг отзывов Яндекс.Карт работает без --headless)
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp &
export DISPLAY=:99

echo "[worker] Xvfb запущен на DISPLAY=:99"

exec celery -A service.app.celery_app.celery_app worker \
    --loglevel=info \
    --concurrency="${CELERY_CONCURRENCY:-2}"
