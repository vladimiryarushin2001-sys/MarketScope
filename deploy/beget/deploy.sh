#!/usr/bin/env bash
#
# Деплой/обновление микросервиса ms-v2 на прод VPS (Beget).
# Скрипт подтягивает свежий код из git и пересобирает контейнеры (api + worker),
# чтобы новый place_search.py (и остальной код) попал в прод.
#
# Использование (на сервере):
#   /opt/marketscope/deploy/beget/deploy.sh
#
# Переменные окружения (необязательно):
#   APP_DIR   — корень репозитория на сервере (по умолчанию /opt/marketscope)
#   GIT_REF   — ветка/тег для деплоя (по умолчанию main)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/marketscope}"
GIT_REF="${GIT_REF:-main}"
COMPOSE_FILE="deploy/beget/docker-compose.prod.yml"

echo "==> Деплой ms-v2: APP_DIR=$APP_DIR, GIT_REF=$GIT_REF"

cd "$APP_DIR"

echo "==> Обновляю код из git ($GIT_REF)"
git fetch --all --prune
git checkout "$GIT_REF"
git reset --hard "origin/$GIT_REF"

echo "==> Пересобираю и поднимаю контейнеры"
docker compose -f "$COMPOSE_FILE" up --build -d

echo "==> Чищу старые образы"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Готово. Текущий commit:"
git --no-pager log -1 --oneline
