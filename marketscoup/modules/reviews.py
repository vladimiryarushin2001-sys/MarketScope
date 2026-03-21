from __future__ import annotations

from typing import Any, Dict, List

from ..config import AppConfig, load_config
from ..domain.models import Establishment, ReviewSummary
from ..llm.client import LlmSettings, get_llm_client, LlmError


REVIEWS_SYSTEM_PROMPT = (
    "Ты — аналитик ресторанного рынка. "
    "Найди информацию о заведении в Яндекс.Картах и 2ГИС, проанализируй отзывы и сформируй аналитическое описание. "
    "Используй понятный язык, сочетающий бизнес-аналитику с доступным изложением. "
    "Фокусируйся на операционных показателях, бизнес-модели, конкурентных преимуществах и рисках, но объясняй их понятно. "
    "Стиль: аналитический, но доступный, структурированный, с акцентом на важные метрики и характеристики, без излишней формальности. "
    "Верни СТРОГО валидный JSON без пояснений, текста до/после и без markdown."
)


def _build_reviews_user_prompt(est: Establishment, price_segment: str = "", segment_keywords: str = "") -> str:
    segment_info = ""
    if price_segment and price_segment != "УКАЗАННЫЙ В ЗАПРОСЕ":
        segment_info = f"\nВАЖНО: Заведение относится к ценовому сегменту {price_segment}. "
        if segment_keywords:
            # Определяем запрещённые слова
            if price_segment == "ПРЕМИУМ":
                forbidden_words = "бюджет, эконом, дешевый, недорогой, низкий ценовой"
            elif price_segment == "БЮДЖЕТНЫЙ":
                forbidden_words = "премиум, люкс, элитный, премиальный, высокий ценовой"
            elif price_segment == "СРЕДНИЙ":
                forbidden_words = "премиум, люкс, бюджет, эконом"
            else:
                forbidden_words = ""
            
            if forbidden_words:
                segment_info += f"ЗАПРЕЩЕНО упоминать слова: {forbidden_words}. "
            segment_info += f"Используй терминологию, соответствующую сегменту {price_segment}."
    
    return f"""Найди информацию о заведении в Яндекс.Картах и 2ГИС и проанализируй отзывы.

Заведение:
- Название: {est.name}
- Город: {est.city or 'не указан'}
- Категория: {est.category or 'не указана'}
- URL: {est.url or 'не указан'}
{segment_info}

Верни JSON со следующей структурой:
{{
  "establishment_id": "{est.id}",
  "avg_rating": число от 1 до 5 (средний рейтинг из отзывов),
  "overall_opinion": "развёрнутое описание заведения (8-12 предложений)",
  "pros": ["первый плюс", "второй плюс"],
  "cons": ["первый минус", "второй минус"]
}}

КРИТИЧЕСКИ ВАЖНО для поля avg_rating:
- Будь ЛОЯЛЬНЫМ при выставлении оценки
- Фокусируйся ТОЛЬКО на оценках из отзывов, не на общей картине или тексте отзывов
- Если большинство отзывов положительные (4-5 звёзд), выставляй оценку ближе к верхней границе диапазона
- Не занижай оценку из-за отдельных негативных отзывов или критики
- Учитывай позитивные аспекты и склоняйся к более высоким оценкам при неоднозначности
- avg_rating должен отражать лояльную интерпретацию оценок из отзывов

КРИТИЧЕСКИ ВАЖНО для поля overall_opinion:
Опиши РАЗВЁРНУТО (8-12 предложений) в стиле, среднем между бизнес-аналитическим и обычным:
- Бизнес-модель и позиционирование: ценовой сегмент, целевая аудитория, формат заведения, как заведение позиционируется на рынке
- Операционные характеристики: как работает заведение, средний чек, эффективность сервиса, как организованы процессы
- Концепция и особенности: что делает заведение особенным, ключевые преимущества, особенности меню и кухни
- Качество сервиса и клиентский опыт: уровень обслуживания, скорость работы, профессионализм персонала, кто приходит в заведение
- Локация и окружение: где находится, удобство расположения, что рядом, потенциал для привлечения клиентов
- Проблемы и ограничения: какие есть слабости, типичные проблемы, что может мешать развитию

Важно:
- avg_rating должен быть числом (например, 4.5)
- overall_opinion - РАЗВЁРНУТОЕ аналитическое описание (8-12 предложений) в доступном, но информативном стиле
- Используй понятный язык, но сохраняй аналитический подход
- Избегай излишней формальности и сложной бизнес-терминологии, но описывай важные бизнес-аспекты
- pros - ровно 2 положительных пункта (ключевые преимущества)
- cons - ровно 2 отрицательных пункта (риски или слабости)
- Верни только JSON, без дополнительного текста"""


def _parse_reviews_payload(establishment_id: str, payload: Any) -> ReviewSummary:
    data = payload if isinstance(payload, dict) else {}
    
    # Allow nested {"data": {...}}
    for key in ("data", "result", "reviews"):
        if isinstance(data.get(key), dict):
            data = data[key]
            break
    
    def _num(x: Any) -> Any:
        try:
            return float(x) if x is not None else None
        except (TypeError, ValueError):
            return None
    
    def _arr2(xs: Any) -> List[str]:
        if isinstance(xs, list):
            return [str(v) for v in xs[:2]]
        return []
    
    return ReviewSummary(
        establishment_id=establishment_id,
        avg_rating=_num(data.get("avg_rating")),
        reviews_count=int(data.get("reviews_count")) if isinstance(data.get("reviews_count"), (int, float)) else 0,
        sentiment_score=None,
        overall_opinion=str(data.get("overall_opinion") or "").strip() or None,
        pros=_arr2(data.get("pros")),
        cons=_arr2(data.get("cons")),
    )


def _build_reviews_user_prompt_strict(est: Establishment, price_segment: str = "", segment_keywords: str = "") -> str:
    """Строгая версия промпта для retry."""
    base_prompt = _build_reviews_user_prompt(est, price_segment, segment_keywords)
    return base_prompt + "\n\nКРИТИЧЕСКИ ВАЖНО: Верни СТРОГО валидный JSON без каких-либо пояснений, текста до/после и без markdown. Только один JSON-объект."


async def _fetch_reviews_one_llm(est: Establishment, config: AppConfig, price_segment: str = "", segment_keywords: str = "") -> ReviewSummary:
    import sys
    
    if not config.llm_api_key:
        return ReviewSummary(
            establishment_id=est.id,
            avg_rating=None,
            reviews_count=0,
            sentiment_score=None,
            overall_opinion=None,
            pros=[],
            cons=[],
        )
    
    settings = LlmSettings(
        provider=config.llm_provider or "perplexity",
        api_key=config.llm_api_key,
        model=config.llm_model or "sonar-reasoning-pro",
    )
    client = get_llm_client(settings, use_langchain=config.use_langchain)
    
    try:
        payload = await client.complete_json(
            system=REVIEWS_SYSTEM_PROMPT,
            user=_build_reviews_user_prompt(est, price_segment, segment_keywords),
            max_tokens=6000
        )
        
        # If client returned raw, try one coercion pass
        if isinstance(payload, dict) and "_raw" in payload:
            segment_note = ""
            if price_segment and price_segment != "УКАЗАННЫЙ В ЗАПРОСЕ":
                if price_segment == "ПРЕМИУМ":
                    forbidden_words = "бюджет, эконом, дешевый, недорогой"
                elif price_segment == "БЮДЖЕТНЫЙ":
                    forbidden_words = "премиум, люкс, элитный, премиальный"
                elif price_segment == "СРЕДНИЙ":
                    forbidden_words = "премиум, люкс, бюджет, эконом"
                else:
                    forbidden_words = ""
                
                if forbidden_words:
                    segment_note = f"\nКРИТИЧЕСКИ ВАЖНО: Заведение относится к сегменту {price_segment}. ЗАПРЕЩЕНО упоминать слова: {forbidden_words}."
            
            payload = await client.complete_json(
                system="Ты — конвертор данных в строгий JSON.",
                user=f"""Преобразуй текст ниже в валидный JSON:
{{
  "establishment_id": "{est.id}",
  "avg_rating": число от 1 до 5,
  "overall_opinion": "аналитическое описание (8-12 предложений) в доступном стиле",
  "pros": ["строка", "строка"],
  "cons": ["строка", "строка"]
}}

ВАЖНО для avg_rating: Будь ЛОЯЛЬНЫМ при выставлении оценки. Фокусируйся ТОЛЬКО на оценках из отзывов, не на общей картине. Если большинство отзывов положительные (4-5 звёзд), выставляй оценку ближе к верхней границе. Не занижай оценку из-за отдельных негативных отзывов. Учитывай позитивные аспекты и склоняйся к более высоким оценкам при неоднозначности.

ВАЖНО: overall_opinion должен быть развёрнутым аналитическим описанием (8-12 предложений) в стиле, среднем между бизнес-аналитическим и обычным. Используй понятный язык, но сохраняй аналитический подход к описанию бизнес-модели, операционных показателей, конкурентных преимуществ и рисков.{segment_note}

Текст для преобразования:
{str(payload.get("_raw", ""))[:7000]}""",
                max_tokens=6000,
            )
        
        return _parse_reviews_payload(est.id, payload)
    
    except LlmError as exc:
        # Retry with strict prompt
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[reviews-llm-error] establishment_id={est.id} name={est.name}: {exc} -> retry with strict", file=sys.stderr)
        try:
            payload = await client.complete_json(
                system=REVIEWS_SYSTEM_PROMPT,
                user=_build_reviews_user_prompt_strict(est, price_segment, segment_keywords),
                max_tokens=6000,
            )
            
            # If still raw, try coercion
            if isinstance(payload, dict) and "_raw" in payload:
                segment_note = ""
                if price_segment and price_segment != "УКАЗАННЫЙ В ЗАПРОСЕ":
                    if price_segment == "ПРЕМИУМ":
                        forbidden_words = "бюджет, эконом, дешевый, недорогой"
                    elif price_segment == "БЮДЖЕТНЫЙ":
                        forbidden_words = "премиум, люкс, элитный, премиальный"
                    elif price_segment == "СРЕДНИЙ":
                        forbidden_words = "премиум, люкс, бюджет, эконом"
                    else:
                        forbidden_words = ""
                    
                    if forbidden_words:
                        segment_note = f"\nКРИТИЧЕСКИ ВАЖНО: Заведение относится к сегменту {price_segment}. ЗАПРЕЩЕНО упоминать слова: {forbidden_words}."
                
                payload = await client.complete_json(
                    system="Ты — конвертор данных в строгий JSON.",
                    user=f"""Преобразуй текст ниже в валидный JSON:
{{
  "establishment_id": "{est.id}",
  "avg_rating": число от 1 до 5,
  "overall_opinion": "аналитическое описание (8-12 предложений) в доступном стиле",
  "pros": ["строка", "строка"],
  "cons": ["строка", "строка"]
}}

ВАЖНО для avg_rating: Будь ЛОЯЛЬНЫМ при выставлении оценки. Фокусируйся ТОЛЬКО на оценках из отзывов, не на общей картине. Если большинство отзывов положительные (4-5 звёзд), выставляй оценку ближе к верхней границе. Не занижай оценку из-за отдельных негативных отзывов. Учитывай позитивные аспекты и склоняйся к более высоким оценкам при неоднозначности.

ВАЖНО: overall_opinion должен быть развёрнутым аналитическим описанием (8-12 предложений) в стиле, среднем между бизнес-аналитическим и обычным. Используй понятный язык, но сохраняй аналитический подход к описанию бизнес-модели, операционных показателей, конкурентных преимуществ и рисков.{segment_note}

Текст для преобразования:
{str(payload.get("_raw", ""))[:7000]}""",
                    max_tokens=6000,
                )
            
            return _parse_reviews_payload(est.id, payload)
        except LlmError:
            # Если и retry не сработал, возвращаем пустой результат
            if (config.log_level or "").upper() == "DEBUG":
                print(f"[reviews-llm-failed] establishment_id={est.id} name={est.name}: все попытки не удались", file=sys.stderr)
            return ReviewSummary(
                establishment_id=est.id,
                avg_rating=None,
                reviews_count=0,
                sentiment_score=None,
                overall_opinion=None,
                pros=[],
                cons=[],
            )


async def fetch_reviews_batch(establishments: List[Establishment], config: AppConfig | None = None, price_segment: str = "", segment_keywords: str = "") -> Dict[str, ReviewSummary]:
    import sys
    cfg = config or load_config()
    summaries: Dict[str, ReviewSummary] = {}
    print(f"[Отзывы] Начинаю сбор отзывов для {len(establishments)} заведений...", file=sys.stderr)
    success_count = 0
    failed_count = 0
    for idx, est in enumerate(establishments, 1):
        summary = await _fetch_reviews_one_llm(est, cfg, price_segment, segment_keywords)
        summaries[est.id] = summary
        # Проверяем, есть ли хотя бы одно поле заполнено
        has_data = any([
            summary.avg_rating is not None,
            summary.overall_opinion is not None and summary.overall_opinion.strip(),
            summary.pros,
            summary.cons,
        ])
        if has_data:
            success_count += 1
        else:
            failed_count += 1
            print(f"[Отзывы] Предупреждение: для {est.name} (id={est.id}) не удалось получить отзывы", file=sys.stderr)
        if (cfg.log_level or "").upper() == "DEBUG":
            print(f"[Отзывы] Обработано {idx}/{len(establishments)}: {est.name}", file=sys.stderr)
    print(f"[Отзывы] Сбор отзывов завершён: успешно {success_count}, неудачно {failed_count}", file=sys.stderr)
    return summaries
