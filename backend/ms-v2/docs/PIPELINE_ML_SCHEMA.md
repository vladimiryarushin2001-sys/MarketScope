# Схема пайплайна ms_v2 с точками ML / LLM

Кратко: **вход** (`input_request.json` + CSV) → **block1** … **block6** → **отчёт**. Блоки 2–5 после block1 идут **параллельно** (см. `orchestrator.py`).

## Блоки

**1** — выборка из CSV + рыночные выводы · **2** — меню (vision + LLM) · **3** — отзывы: тональность + суммаризация · **4** — соцсети/лояльность + маркетинг · **5** — аудит сайта (скорость, HTTPS, SEO) · **6** — сборка отчёта и финальные рекомендации

## Легенда

| Цвет / тип | Что это |
|------------|---------|
| `[локальный ML]` | Модель крутится у вас (PyTorch / sentence-transformers) |
| `[LLM API]` | Внешний API: Perplexity, OpenRouter |

---

## Диаграмма (уборкой данных + модели)

```mermaid
flowchart TB
    subgraph INPUT["Вход"]
        IN[("input_request.json\nCSV база заведений")]
    end

    subgraph B1["Block 1 — релевантность / конкуренты"]
        B1A["Поиск в CSV + фильтры"]
        B1B["[локальный ML] sentence-transformers\nsergeyzh/rubert-mini-frida\ncosine similarity по описаниям"]
        B1C["[LLM API] Perplexity (sonar)\nquery_from_perplexity, обогащение карточек"]
        B1D["[LLM API] Perplexity\nmarket / competitive выводы"]
        IN --> B1A --> B1B
        B1B --> B1C --> B1D
    end

    subgraph PAR["Параллельно после Block 1"]
        B2["Block 2 — меню"]
        B3["Block 3 — отзывы"]
        B4["Block 4 — маркетинг"]
        B5["Block 5 — тех. сайта"]
    end

    B1D --> B2 & B3 & B4 & B5

    subgraph B2inner["Block 2"]
        B2P["PDF/картинки → изображения"]
        B2V["[LLM API] Vision (OpenRouter)\nChatOpenAI gpt-4o\nразбор меню с картинок"]
        B2L["[LLM API] Perplexity (sonar)\nmarket: один вызов\ncompetitive: N per-place + сравнение"]
        B2P --> B2V --> B2L
    end
    B2 --> B2inner

    subgraph B3inner["Block 3"]
        B3S["parse_yandex_reviews (без NN)"]
        B3T["[локальный ML] Hugging Face\nseara/rubert-tiny2-russian-sentiment\ntonальность отзывов"]
        B3P["[LLM API] Perplexity (sonar)\ncуммаризация отзывов"]
        B3C["[LLM API] competitive: Perplexity\nсравнение по отзывам"]
        B3S --> B3T --> B3P --> B3C
    end
    B3 --> B3inner

    subgraph B4inner["Block 4"]
        B4W["Playwright — соцсети, лояльность"]
        B4E["[LLM API] Perplexity\nобогащение активности соцсетей"]
        B4L["[LLM API] Perplexity\nmarket ИЛИ competitive\n(per-place + сравнение)"]
        B4W --> B4E --> B4L
    end
    B4 --> B4inner

    subgraph B5inner["Block 5"]
        B5H["HTTP / проверка сайта"]
        B5L["[LLM API] Perplexity\nmarket ИЛИ competitive\n(per-place + сравнение)"]
        B5H --> B5L
    end
    B5 --> B5inner

    subgraph B6["Block 6 — агрегатор"]
        B6A["Сборка разделов из JSON\nблоков 1–5"]
        B6L["[LLM API] Perplexity\ncборка / рекомендации\n(зависит от режима)"]
        B6A --> B6L
    end

    B2L & B3C & B4L & B5L --> B6A

    subgraph OUT["Выход"]
        OUTF[("block6_output.md / .json")]
    end
    B6L --> OUTF
```

---

## Сводная таблица моделей

| Участок | Технология | Модель / сервис |
|---------|------------|-----------------|
| Поиск по выборке (block1 / `place_search`) | `sentence-transformers` | `sergeyzh/rubert-mini-frida` |
| Парсинг запроса / обогащение (block1) | Perplexity API | `sonar` (настраивается) |
| Разбор меню по картинкам (block2) | OpenRouter | `openai/gpt-4o` (vision) |
| Аналитика меню (block2) | Perplexity API | `sonar` |
| Тональность отзывов (block3) | `transformers` | `seara/rubert-tiny2-russian-sentiment` |
| Суммаризация и блок. выводы по отзывам (block3) | Perplexity API | `sonar` |
| Активность соцсетей + маркетинг-выводы (block4) | Perplexity API | `sonar` |
| Выводы по тех. сайтам (block5) | Perplexity API | `sonar` |
| Общий competitive/market helper | `competitive_llm` / `market_llm` | Perplexity `sonar` |
| Финальный отчёт (block6) | Perplexity API | `sonar` (по умолчанию) |

**Без ключей API** там, где указан Perplexity, включаются **эвристические fallback** (строки без вызова модели).

---

## Файлы-ориентиры

- Локальный энкодер: `place_search.py`, `encoder_cache/`
- Тональность: `restaurant_pipeline/blocks/block3_reviews/sentiment.py`
- Perplexity обёртки: `competitive_llm.py`, `market_llm.py`, блоки `*_relevance`, `*_menu`, …
- Оркестратор: `restaurant_pipeline/orchestrator.py`
