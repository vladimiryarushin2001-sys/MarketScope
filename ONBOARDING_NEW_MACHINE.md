# MarketScope — полная инструкция развёртывания на новом компьютере

Этот репозиторий — **монорепа** из 3 частей:

- **Frontend (продукт)**: `mark/MarketScope/` — React + Vite + TypeScript.
- **Supabase (БД + Edge Functions + миграции)**: `mark/MarketScope/supabase/`.
- **Микросервис ms-v2 (API + Worker)**: `backend/ms-v2/` — FastAPI + Celery + Redis + пайплайн 1..6.

Дополнительно в корне есть **старый Python CLI**: `marketscoup/` (используется в CI и может жить отдельно от веб-продукта).

---

## 0) Что нужно установить на новом компьютере

### Минимум для разработки фронта
- **Git**
- **Node.js**: 18+ (лучше 20)
- **npm** (идёт вместе с Node)

### Для работы с Supabase (миграции/Edge Functions)
- **Supabase CLI** (локально)
- **Docker Desktop** (на macOS/Windows) или Docker Engine (Linux)

### Для локального запуска микросервиса ms-v2
- **Docker** + **Docker Compose v2**

---

## 0.1) Ссылки на сервисы (где что живёт)

- **GitHub (исходники)**:
  - `origin`: `https://github.com/pertila1/marketscope`
  - `vladimir`: `https://github.com/vladimiryarushin2001-sys/MarketScope`
- **Supabase Dashboard**: `https://supabase.com/dashboard`
  - Проект: `https://supabase.com/dashboard/project/<PROJECT_REF>`
  - Edge Functions: `https://supabase.com/dashboard/project/<PROJECT_REF>/functions`
  - SQL Editor: `https://supabase.com/dashboard/project/<PROJECT_REF>/sql`
  - API Keys: `https://supabase.com/dashboard/project/<PROJECT_REF>/settings/api`
  - Auth URL config: `https://supabase.com/dashboard/project/<PROJECT_REF>/auth/url-configuration`
- **Vercel (frontend)**: `https://vercel.com/dashboard`
- **Render (альтернативный хостинг ms-v2)**: `https://dashboard.render.com/`
- **Beget / VPS панель (MarketScope)**: `https://cp.beget.com/cloud/servers/marketscope`
- **VPS SSH**: `ssh root@82.202.131.46`

---

## 0.2) Как залогиниться (все сервисы)

### GitHub
- Войти: `https://github.com/login`
- Доступ с нового ПК:
  - рекомендовано: **SSH ключи** → добавить public key в `https://github.com/settings/keys`
  - альтернативно: HTTPS + Personal Access Token (PAT)

### Supabase
- Войти: `https://supabase.com/dashboard` (часто через GitHub)
- В Supabase CLI на новом ПК:

```bash
supabase login
```

### Vercel
- Войти: `https://vercel.com/login` (часто через GitHub)

### VPS / Beget
- Войти в панель провайдера: `<PASTE_YOUR_PROVIDER_PANEL_URL>`
- Подключение по SSH:

```bash
ssh root@<YOUR_VPS_IP>
```

---

## 0.3) “Сейф” для секретов (заполни своими значениями)

Ниже — **пустые строки**, куда ты можешь скопировать свои секреты при переезде на новый ПК.
Не коммить этот блок в git и не отправляй секреты в чат.

### Supabase

```env
# Project Settings → API
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Project Settings → API → Legacy API Keys (если нужно)
EDGE_SERVICE_ROLE_JWT=

# Supabase → Auth → URL Configuration (для заметок)
SUPABASE_SITE_URL=
SUPABASE_REDIRECT_URLS=
```

### Frontend (Vercel / локальный .env)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### ms-v2 (LLM ключи)

```env
PPLX_API_KEY=
OPENROUTER_API_KEY=
GIGACHAT_CREDENTIALS=
HF_TOKEN=
```

### ms-v2 (прод на VPS)

```env
# домен, который проксирует caddy на api:8000
MS_V2_DOMAIN=

# путь к env на VPS (шпаргалка)
VPS_ENV_FILE=/opt/marketscope/deploy/beget/.env.ms-v2
VPS_SSH=ssh root@82.202.131.46
```

### GitHub / Vercel / Render доступы (для заметок)

```text
GITHUB_USERNAME=
GITHUB_SSH_KEY_PATH=

VERCEL_TEAM=
VERCEL_PROJECT=

RENDER_OWNER=
RENDER_SERVICES=
```

---

## 1) Клонирование проекта

```bash
git clone <ВАШ_GIT_URL>
cd mark
```

Проверка структуры:
- фронт: `mark/MarketScope/`
- ms-v2: `backend/ms-v2/`
- прод для VPS: `deploy/beget/`

---

## 2) Supabase (База данных + Edge Functions)

### 2.1 Где находится БД
- **Supabase PostgreSQL** (управляется в Supabase Dashboard).
- Все таблицы живут в `public.*`.
- История запросов/запусков: `client_requests`, `analysis_runs`.
- Доменные таблицы данных: `restaurants`, `menus`, `menu_items`, `reviews`, `marketing`, `marketing_socials`, `marketing_loyalty`, `technical_analysis`, `strategic_report`.

Схема и политики создаются миграциями в:
- `mark/MarketScope/supabase/migrations/`

Ключевые миграции:
- `20250314000000_create_dashboard_tables.sql` — базовые таблицы
- `20250317001000_add_requests_runs_and_conclusions.sql` — `client_requests`, `analysis_runs`, `run_id` в доменных таблицах + RLS доступ по run
- `20260413000000_add_analysis_run_job_fields.sql` — `status/progress/job_id/outputs/...` в `analysis_runs`

### 2.2 Переменные Supabase (вставить свои значения)

В Supabase Dashboard → **Project Settings → API**:

```env
# URL проекта
SUPABASE_URL=https://<PROJECT_REF>.supabase.co

# Публичный ключ (для фронта и для gateway функций)
SUPABASE_ANON_KEY=<PASTE_ANON_PUBLIC_KEY>

# Сервисный ключ (для серверных вставок; хранить как secret!)
SUPABASE_SERVICE_ROLE_KEY=<PASTE_SERVICE_ROLE_KEY>

# (опционально) Legacy JWT service_role, если SUPABASE_SERVICE_ROLE_KEY имеет формат sb_secret_*
EDGE_SERVICE_ROLE_JWT=<PASTE_LEGACY_SERVICE_ROLE_JWT>
```

### 2.3 Применение миграций в Supabase

Вариант A (рекомендовано): через Supabase CLI (локально).

```bash
cd mark/MarketScope
supabase link --project-ref <PROJECT_REF>
supabase db push
```

Вариант B: через SQL Editor в Supabase Dashboard — выполнить миграции вручную.

### 2.3.1 Логин в Supabase CLI (на новом ПК)

```bash
supabase login
```

### 2.4 Edge Functions: что это и зачем

Функции лежат в `mark/MarketScope/supabase/functions/`.

Ключевые:
- `ingest` — **пролив outputs** микросервиса в таблицы БД
- `ms-v2-start` — стартует ms-v2 job (`POST /analyze`) и пишет `job_id` в `analysis_runs`
- `ms-v2-poll` — опрашивает ms-v2 (`GET /jobs/{id}`), пишет прогресс/outputs в БД и при `done` вызывает `ingest`
- `ms-v2-diagnose` — проверка, что Supabase Edge runtime видит ms-v2 по `MS_V2_URL`

### 2.5 Secrets для Edge Functions (в Supabase)

Supabase Dashboard → **Edge Functions → Secrets**:

```env
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<PASTE_SERVICE_ROLE_KEY>
SUPABASE_ANON_KEY=<PASTE_ANON_PUBLIC_KEY>

# URL микросервиса ms-v2 (через интернет, HTTPS)
MS_V2_URL=https://<YOUR_MS_V2_DOMAIN>

# Если нужно (см. комментарий в ms-v2-poll):
EDGE_SERVICE_ROLE_JWT=<PASTE_LEGACY_SERVICE_ROLE_JWT>
```

### 2.6 Деплой Edge Functions

```bash
cd mark/MarketScope
supabase link --project-ref <PROJECT_REF>
supabase functions deploy ingest
supabase functions deploy ms-v2-start
supabase functions deploy ms-v2-poll
supabase functions deploy ms-v2-diagnose
```

Если деплой ругается на Docker — включи Docker Desktop и проверь:

```bash
docker ps
```

Проверка диагностики (нужен anon key):

```bash
ANON_KEY="<PASTE_ANON_PUBLIC_KEY>"
curl -sS -L "https://<PROJECT_REF>.supabase.co/functions/v1/ms-v2-diagnose" \
  -H "apikey: ${ANON_KEY}" \
  -H "Authorization: Bearer ${ANON_KEY}"
```

---

## 3) Frontend (React/Vite) — локальный запуск

### 3.1 Переменные окружения фронта

Файл: `mark/MarketScope/.env` (создать на новом компе).
Шаблон лежит в `mark/MarketScope/.env.example`.

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<PASTE_ANON_PUBLIC_KEY>
```

### 3.2 Установка и запуск

```bash
cd mark/MarketScope
npm ci
npm run dev
```

Открой `http://localhost:5173`.

### 3.3 Локальная авторизация (login) и redirect URLs

Чтобы логин работал локально:
- Supabase Dashboard → **Authentication → URL Configuration**
  - **Site URL**: `http://localhost:5173`
  - **Redirect URLs**: добавь `http://localhost:5173`

Для продового домена фронта (Vercel) нужно добавить и его (см. раздел Vercel ниже).

---

## 4) Микросервис ms-v2 (backend) — как работает и как поднять

### 4.1 Как устроен ms-v2

Документация: `backend/ms-v2/README.md`.

Схема:
- `POST /analyze` → создаёт Celery job → сохраняет статус в Redis
- `GET /jobs/{job_id}` → отдаёт `status/progress/outputs`
- Worker выполняет пайплайн блоков:
  1. `block1_relevance` — поиск заведений по CSV + Perplexity enrichment
  2. `block2_menu` — парсинг/анализ меню
  3. `block3_reviews` — сбор/сентимент/суммаризация отзывов (Яндекс)
  4. `block4_marketing` — соцсети/лояльность
  5. `block5_tech` — теханализ сайтов
  6. `block6_aggregator` — финальный отчёт

Outputs сохраняются в Redis как JSON и (в проде) также на диске в `/app/jobs/<job_id>/...`.

### 4.2 Переменные окружения ms-v2 (вставить свои ключи)

Локальный файл: `backend/ms-v2/.env` (создать по шаблону `backend/ms-v2/.env.example`).

```env
PPLX_API_KEY=<PASTE_PERPLEXITY_KEY>
OPENROUTER_API_KEY=<PASTE_OPENROUTER_KEY>
GIGACHAT_CREDENTIALS=<PASTE_GIGACHAT_CREDENTIALS>

REDIS_URL=redis://redis:6379/0
PROJECT_ROOT=/app
SOURCE_CSV=/app/final_blyat_v3.csv
CELERY_CONCURRENCY=2
HF_TOKEN=<PASTE_HUGGINGFACE_TOKEN_OPTIONAL>
```

### 4.3 CSV база ресторанов

CSV **не хранится в git**.
Нужно положить файл:
- локально: `backend/ms-v2/final_blyat_v3.csv`
- в контейнере будет: `/app/final_blyat_v3.csv`

### 4.4 Запуск ms-v2 локально через Docker Compose

```bash
cd backend/ms-v2
cp .env.example .env
# заполнить .env

# положить final_blyat_v3.csv рядом с docker-compose.yml (в backend/ms-v2/)
docker compose up --build -d

curl http://localhost:8000/health
```

### 4.5 Команды “быстро проверить ms-v2”

```bash
# health
curl -sS http://localhost:8000/health

# пример запуска (обзор рынка)
curl -sS -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  --data '{"report_type":"market","mode":"free_form","top_n":5,"free_form_text":"кофейни 300-600 ₽"}'
```

---

## 5) Прод: хостинг и где что править

### 5.1 Frontend хостинг (Vercel)

В корне репо есть:
- `package.json` (workspaces → `mark/MarketScope`)
- `vercel.json` (указывает, что билд — vite, output `mark/MarketScope/dist`)

Как деплоить:
- Подключить репозиторий в Vercel
- Root Directory: **корень репозитория** (или `mark/MarketScope`, см. `mark/MarketScope/README.md`)
- Переменные окружения на Vercel:

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<PASTE_ANON_PUBLIC_KEY>
```

### 5.1.1 Логин в Vercel и ручной деплой из CLI (опционально)

```bash
npm i -g vercel
vercel login
cd mark/MarketScope
vercel
# прод:
vercel --prod
```

### 5.1.2 Redirect URLs в Supabase для продового фронта

Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://<YOUR_VERCEL_DOMAIN>`
- **Redirect URLs**: добавь `https://<YOUR_VERCEL_DOMAIN>` (и `http://localhost:5173` для разработки)

### 5.2 ms-v2 хостинг (VPS / Beget)

Продовый compose: `deploy/beget/docker-compose.prod.yml`.
Он поднимает:
- `redis`
- `api` (FastAPI)
- `worker` (Celery)
- `caddy` (HTTPS reverse proxy)

На VPS файл окружения (вне git):
- `/opt/marketscope/deploy/beget/.env.ms-v2`

Шаблон (создать на VPS):

```env
PPLX_API_KEY=<PASTE_PERPLEXITY_KEY>
OPENROUTER_API_KEY=<PASTE_OPENROUTER_KEY>
GIGACHAT_CREDENTIALS=<PASTE_GIGACHAT_CREDENTIALS>
HF_TOKEN=<PASTE_HUGGINGFACE_TOKEN_OPTIONAL>

REDIS_URL=redis://redis:6379/0
PROJECT_ROOT=/app
SOURCE_CSV=/app/final_blyat_v3.csv
CELERY_CONCURRENCY=1
```

Команды управления на VPS:

```bash
cd /opt/marketscope
git pull origin main

docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml up -d --build
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml ps
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml logs -f --tail=200 worker
```

### 5.2.0 Быстрые ссылки/подключение к VPS (Beget)

- Панель Beget: `https://cp.beget.com/cloud/servers/marketscope`
- Подключение по SSH:

```bash
ssh root@<YOUR_VPS_IP>
```

### 5.2.2 Docker и VPS — “боевые” команды (обновить код, воркеры, логи)

#### Проверить, что сервисы запущены

```bash
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml ps
```

#### Посмотреть логи (worker / api / caddy)

```bash
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml logs -f --tail=200 worker
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml logs -f --tail=200 api
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml logs -f --tail=200 caddy
```

#### Обновить код до актуального (git pull) и перезапустить

```bash
cd /opt/marketscope
git pull origin main

# пересборка и подъем (обновит api/worker)
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml up -d --build
```

#### Перезапустить только воркер (если завис/упал)

```bash
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml restart worker
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml logs -f --tail=200 worker
```

#### Перезапустить только API

```bash
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml restart api
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml logs -f --tail=200 api
```

#### Полностью остановить/поднять всё (например, после чистки Docker)

```bash
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml down
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml up -d
```

#### Проверка health (ms-v2 через caddy-домен)

```bash
curl -sS https://<YOUR_MS_V2_DOMAIN>/health
```

#### Где править переменные окружения на VPS

Файл:
- `/opt/marketscope/deploy/beget/.env.ms-v2`

Команды:

```bash
nano /opt/marketscope/deploy/beget/.env.ms-v2
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml up -d
```

#### Если “заканчивается место на диске” (Docker кеш/образы)

Диагностика:

```bash
df -h
docker system df
sudo du -h -d 1 /var/lib | sort -h | tail -n 30
```

Очистка (осторожно: удалит образы/кеши, но **не трогает** volumes с jobs/кэшами моделей):

```bash
docker system prune -a -f
docker builder prune -a -f
```

Если нужно удалить и volumes (удалит результаты `/app/jobs` и кэши):

```bash
# ОСТОРОЖНО: удалит jobs и кэши моделей
docker volume prune -f
```

### 5.2.1 “Развернуть на чистом VPS с нуля” (шпаргалка команд)

```bash
# 1) базовые пакеты
apt update && apt upgrade -y

# 2) поставить Docker (Ubuntu)
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3) клонировать проект
mkdir -p /opt/marketscope
cd /opt/marketscope
git clone <ВАШ_GIT_URL> .

# 4) создать env для ms-v2
mkdir -p /opt/marketscope/deploy/beget
nano /opt/marketscope/deploy/beget/.env.ms-v2

# 5) положить CSV (если используешь локальный файл на VPS)
#   /opt/marketscope/backend/ms-v2/final_blyat_v3.csv

# 6) поднять сервис
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml up -d --build
docker compose -f /opt/marketscope/deploy/beget/docker-compose.prod.yml logs -f --tail=200 worker
```

### 5.3 ms-v2 альтернативный хостинг (Render)

Blueprint: `render.yaml`.
Поднимает Redis + ms-v2-api + ms-v2-worker.

### 5.3.1 Как залогиниться и развернуть в Render
- Войти: `https://dashboard.render.com/`
- New → **Blueprint** → выбрать репозиторий → Render подхватит `render.yaml`
- В Render Secrets для `ms-v2-api` и `ms-v2-worker` выставить:
  - `PPLX_API_KEY`, `OPENROUTER_API_KEY`, `GIGACHAT_CREDENTIALS`
  - `SOURCE_CSV_URL` (ссылка на CSV)
  - (опционально) `HF_TOKEN`

---

## 6) Поток данных “как оно всё связано”

### 6.1 Пользовательский сценарий
1) Пользователь создаёт `client_requests` во фронте.
2) Фронт вызывает Edge Function `ms-v2-start` → она создаёт `analysis_runs` и запускает ms-v2 job → пишет `job_id`.
3) Фронт периодически вызывает `ms-v2-poll` для `run_id`.
4) `ms-v2-poll`:
   - читает `analysis_runs.job_id`
   - ходит в ms-v2 `/jobs/{job_id}`
   - пишет `status/progress/outputs` в `analysis_runs`
   - при `done/done_partial` вызывает `ingest`
5) `ingest` превращает `outputs` (block1..block6) в строки таблиц `restaurants/menus/...` с привязкой `run_id`.
6) Фронт читает таблицы по `run_id` и показывает вкладки.

Документ “простыми словами”: `mark/DATA_FLOW.md`.

---

## 7) Полезные файлы в репо

- Frontend env: `mark/MarketScope/.env.example`
- ms-v2 env: `backend/ms-v2/.env.example`
- Прод compose VPS: `deploy/beget/docker-compose.prod.yml`
- Инструкция по фронту/БД: `mark/MarketScope/README.md`
- Инструкция по ms-v2: `backend/ms-v2/README.md`
- Render blueprint: `render.yaml`

---

## 8) Чеклист “всё работает”

### Локально (frontend + Supabase)
- `npm run dev` открывается
- логин работает (Site URL / Redirect URLs настроены в Supabase)
- вкладки грузят данные из БД

### ms-v2 (локально или VPS)
- `GET /health` возвращает `{"status":"ok"}`
- `ms-v2-diagnose` из Supabase возвращает `ok: true`
- новый запрос создаёт `analysis_runs.job_id`
- после завершения `ms-v2-poll` возвращает `ingested: true`

---

## 9) Что мы уже доработали (история правок)

Ниже — краткий список ключевых доработок/фиксов, сделанных в этом проекте (вместе во время настройки и стабилизации продакшена):

- **Edge Functions: `ms-v2-poll` → `ingest`**
  - исправили внутреннюю авторизацию и проброс user контекста для server-to-server вызовов
  - добавили сохранение частичных `outputs` в `analysis_runs.outputs` во время polling
  - улучшили диагностику ошибок `ingest` (чтобы в `analysis_runs.error` было видно причину)

- **`ingest` (пролив outputs в таблицы)**
  - поддержка нескольких вариантов ключей блоков (`block1`/`block1_relevance` и т.д.)
  - идемпотентность по `run_id` (повторный ingest не накапливает дубли)
  - защита от `NULL` в `reviews.rating/count_rating` (фикс `NOT NULL` ошибки в БД)

- **ms-v2 / block3 reviews (Selenium/Chrome)**
  - автодетект major версии Chrome и передача `--chrome-version`
  - инкрементальная запись `block3_reviews_raw.json` (чтобы сохранить частичные результаты при падениях)
  - worker продолжает работу с partial reviews при краше Chrome (done_partial вместо полного фейла)
  - увеличение `shm_size` в продовом compose для стабильности Chrome

- **Docker/прод**
  - добавили volumes для кешей HuggingFace/SentenceTransformers (ускорение, меньше скачиваний)
  - перевели `env_file` на абсолютные пути для надёжности на VPS

- **Frontend**
  - адаптация модалки тарифов (scroll/escape/overlay/мобильные экраны)
  - форма “Новый запрос”: сделали поля обязательными (нельзя отправить, пока не заполнено)

- **RLS (Supabase)**
  - добавили политики, чтобы пользователь мог обновлять свои строки `client_requests`/`analysis_runs` (например, ремонт статусов)

