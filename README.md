# MarketScope

Инструмент для анализа рынка заведений общественного питания с использованием LLM для сегментации, оценки финансов и агрегации отзывов.

## Описание

MarketScoup позволяет:
- Находить похожие заведения по тематике и ценовому сегменту
- Оценивать финансовые показатели (выручка, расходы, доходы, средний чек)
- Собирать и анализировать отзывы 
- Получать развёрнутые характеристики заведений
- 



## Использование

### CLI

```bash
python -m marketscoup.cli --query "Рестораны мясные среднего ценового сегмента Москва" --top 5
```

### Параметры

- `--query` (обязательный) - Описание заведения для поиска похожих
- `--top` (опционально, по умолчанию 10) - Количество заведений для анализа

### Пример вывода

Результат возвращается в формате JSON и pdf с информацией о:
- Заведениях (название, адрес, категория, URL)
- Финансовых показателях (выручка, расходы, доходы, средний чек)
- Отзывах (рейтинг, общее мнение, плюсы, минусы)
- Рейтинги схожести с запросом
- Анализ ниши на основе полученых заведений
- Рекомендации по деятельности в этой нише

## Структура проекта

```
marketscope/
├── marketscope/
│   ├── cli.py              # CLI интерфейс
│   ├── config.py          # Конфигурация
│   ├── orchestrator.py    # Основной пайплайн
│   ├── domain/
│   │   └── models.py      # Модели данных
│   ├── llm/
│   │   └── client.py      # LLM клиент
│   └── modules/
│       ├── segment.py     # Сегментация заведений
│       ├── finance.py     # Финансовая оценка
│       ├── reviews.py     # Сбор отзывов
│       └── aggregator.py  # Агрегация данных
├── requirements.txt
├── pyproject.toml
└── README.md
```

## Особенности

- **Умная сегментация**: Приоритет тематике, затем ценовому сегменту
- **Финансовая оценка**: LLM-оценка на основе среднего чека и посещаемости
- **Анализ отзывов**: Развёрнутое описание особенностей заведения
- **Рейтинг схожести**: Оценка соответствия запросу (0.0-1.0)

## Требования

- Python 3.11+
- API ключ для LLM провайдера (Perplexity по умолчанию)

---

## Папка `mark/` — рабочая область веб-продукта

В репозитории каталог **`mark/`** — это отдельная «среда разработки» для актуальной версии дашборда и интеграции с **Supabase**. Он добавлен в git **дополнительно** к корневому Python-проекту (`marketscoup` и см. разделы выше): старые разделы README про CLI и структуру `marketscope/` **не заменяют** описание ниже.

### Назначение

| Путь | Назначение |
|------|------------|
| **`mark/MarketScope/`** | Фронтенд (**React + Vite + TypeScript**), подключение к БД, личный кабинет, подписка/платежи (Stripe через Edge Functions), миграции SQL. |
| **`mark/MarketScope/supabase/`** | Миграции (`migrations/`), Edge Functions (`functions/`: ingest, метрики, конкуренты, оплата и webhook). |
| **`mark/tmp 2/`** | Схемы и примеры JSON для пайплайнов **competitive** и **market** (входы/выходы блоков). |
| **`mark/scripts/`** | Вспомогательные скрипты (в т.ч. импорт данных). |
| **`mark/DATA_FLOW.md`** | Подробнее про поток данных и интеграцию. |
| **`mark/db_schema.sql`**, **`mark/import_to_db.ts`** | Артефакты работы со схемой/импортом (см. комментарии в файлах при необходимости). |

### Быстрый старт (приложение в `mark/MarketScope`)

1. Перейти в каталог: `cd mark/MarketScope`.
2. Установить зависимости: `npm install`.
3. Создать **`mark/MarketScope/.env`** с `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` (секреты в git не коммитятся).
4. Применить миграции в проекте Supabase (файлы в `mark/MarketScope/supabase/migrations/`).
5. Запуск dev-сервера: `npm run dev`.

Полная инструкция по БД, ingest и Edge Functions — в **`mark/MarketScope/README.md`**.

### Деплой фронта на [Vercel](https://vercel.com)

1. Зайди на Vercel → **Add New… → Project** → импортируй репозиторий `pertila1/marketscope` (или свой fork).
2. **Root Directory** — **корень репозитория** (пусто). В корне есть **`package.json`** с **npm workspaces** (фронт — workspace `competitor-dashboard` в `mark/MarketScope`) и **`vercel.json`**: так Vercel выбирает **Node/Vite**, а не **Python** из `pyproject.toml`. Альтернатива: **Root Directory** = `mark/MarketScope` и Framework Preset **Vite** в настройках проекта.
3. Framework: **Vite** (подхватится из `vercel.json`). Сборка: `npm run build`, выход: `dist`.
4. **Environment Variables** (для Production / Preview):
   - `VITE_SUPABASE_URL` — URL проекта Supabase  
   - `VITE_SUPABASE_ANON_KEY` — anon public key  
   Пример переменных — в **`mark/MarketScope/.env.example`**.
5. **Deploy**. После выдачи домена `*.vercel.app` добавь этот URL в Supabase: **Authentication → URL Configuration** → **Site URL** и при необходимости **Redirect URLs** (для входа и magic link).

Подробнее по шагам — в **`mark/MarketScope/README.md`** (раздел «Деплой на Vercel»).

### Связь с остальным репозиторием

- Корневой **`marketscoup/`** (Python, LLM, CLI) и папка **`mark/`** могут сосуществовать: Python-часть отвечает за офлайн/LLM-пайплайн, **`mark/`** — за веб-интерфейс и хранение в Supabase.
- Микросервис **MarketScope API (v2)** (FastAPI + Celery + Redis), который выполняет тяжёлый анализ и отдаёт `job_id`/прогресс/`outputs`, хранится в репозитории рядом с фронтом в **`backend/ms-v2/`** (это содержимое ветки `ms-v2`, импортированное как subtree).
- Исторические каталоги **`MarketScope/`**, **`project/`**, **`tmp/`** в **корне** репозитория в git **не отслеживаются** (см. `.gitignore`); актуальная веб-часть — в **`mark/MarketScope/`**.

---

## Запуск микросервиса `ms-v2` локально (Docker)

1. Подготовить переменные окружения:
   - Скопируй `backend/ms-v2/.env.example` → `backend/ms-v2/.env` и заполни ключи.
2. Подложить CSV (если используешь сценарии, которые требуют базу):
   - положи файл `final_blyat_v3.csv` в `backend/ms-v2/final_blyat_v3.csv`
3. Запуск:

```bash
docker compose -f docker-compose.ms-v2.yml up --build -d
```

Проверка:
- `GET http://localhost:8000/health`
- `POST http://localhost:8000/analyze` (см. примеры в `backend/ms-v2/README.md`)



