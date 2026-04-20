# Restaurant Pipeline (Local JSON)

Локальный пайплайн без API-сервиса.  
Блоки обмениваются данными через JSON-файлы в `data_exchange/`.

## Структура

- `blocks/block1_relevance` — центральный блок (подбор 10 релевантных заведений + обогащение полей)
- `blocks/block2_menu` — заглушка (пока не реализован)
- `blocks/block3_reviews` — суммаризация отзывов (по уже собранному JSON)
- `blocks/block4_marketing` — заглушка (пока не реализован)
- `blocks/block5_tech` — заглушка (пока не реализован)
- `blocks/block6_aggregator` — сбор результатов всех блоков в единый JSON
- `contracts` — примеры JSON-контрактов
- `data_exchange` — обменные JSON-файлы между блоками
- `orchestrator.py` — последовательный запуск блоков

## Запуск

```bash
cd /Users/danilapertsev/Desktop/ms_v2/restaurant_pipeline
python orchestrator.py
```

## Входной JSON

Файл: `data_exchange/input_request.json`

Поддерживаются 2 режима:

1. `template` — фильтры (`types`, `cuisines`, `price_min`, `price_max`, `особенности`)
2. `free_form` — свободный текст (`free_form_text`)

## Выход

Итоговый файл:

- `data_exchange/block6_output.json`

