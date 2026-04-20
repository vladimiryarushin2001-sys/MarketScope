# Beget VPS: деплой `ms-v2` (API + Redis + Worker)

Эта инструкция разворачивает микросервис `ms-v2` на VPS Beget через Docker Compose, чтобы сайт (Vercel) мог вызывать:
`POST /analyze` → получать `job_id` → `GET /jobs/{id}`.

## 0) Что выбрать при покупке VPS (Beget “готовые решения”)

На экране выбора решения (как на твоём скрине) выбирай:
- **Ubuntu 24.04** (самый простой путь)
- или **Docker** (если Beget ставит Docker автоматически)

Если сомневаешься — выбирай **Ubuntu 24.04**.

## 1) Рекомендуемая конфигурация

- Минимально-нормально: **4 CPU / 6 GB RAM / 80 GB NVMe**
- Если берёшь 2 CPU / 4 GB: ставь `CELERY_CONCURRENCY=1` и будь готов к апгрейду.

## 2) Подготовка сервера (Ubuntu 24.04)

Подключись по SSH:

```bash
ssh root@SERVER_IP
```

Установи Docker и Compose:

```bash
apt update
apt install -y ca-certificates curl git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Проверь:

```bash
docker --version
docker compose version
```

## 3) Склонировать репозиторий

```bash
mkdir -p /opt/marketscope
cd /opt/marketscope
git clone https://github.com/vladimiryarushin2001-sys/MarketScope.git .
```

## 4) Настроить env и домен

Перейди в папку деплоя:

```bash
cd /opt/marketscope/deploy/beget
cp .env.ms-v2.example .env.ms-v2
```

Открой `.env.ms-v2` и заполни:
- `PPLX_API_KEY`
- `OPENROUTER_API_KEY`
- `SOURCE_CSV_URL` (ссылка на `final_blyat_v3.csv`, public или signed URL)
- `CELERY_CONCURRENCY` (1 для маленьких VPS, 2 для 8+ GB RAM)

### Домен (рекомендовано)

Нужно создать A-запись:
- `ms-v2.<твой_домен>` → `SERVER_IP`

Для Caddy нужен email:
- `ACME_EMAIL` — email для Let's Encrypt

Экспортируй переменные (можно в `~/.profile`):

```bash
export MS_V2_DOMAIN="ms-v2.example.ru"
export ACME_EMAIL="you@example.ru"
```

## 5) Запуск

```bash
cd /opt/marketscope/deploy/beget
docker compose -f docker-compose.prod.yml up --build -d
```

Проверка:

```bash
curl -f https://$MS_V2_DOMAIN/health
```

Логи:

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200
```

## 6) Подключить сайт (Supabase)

В Supabase Edge Functions надо задать переменную окружения:
- `MS_V2_URL=https://ms-v2.example.ru`

После этого сайт будет вызывать микросервис через `ms-v2-start`/`ms-v2-poll`.

## 7) Обновление на сервере

```bash
cd /opt/marketscope
git pull
cd deploy/beget
docker compose -f docker-compose.prod.yml up --build -d
```

