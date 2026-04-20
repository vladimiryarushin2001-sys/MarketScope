import json
import os
import re
import sys
from pathlib import Path
from typing import Literal

import pandas as pd
from pydantic import BaseModel, Field
from typing import Optional

class EnrichmentResponse(BaseModel):
    site: Optional[str] = Field(default=None)
    delivery: Optional[bool] = Field(default=None)
    time_work: Optional[str] = Field(default=None)
    average_check: Optional[float] = Field(default=None)

def _project_root() -> Path:
    # .../restaurant_pipeline/blocks/block1_relevance/run.py -> .../ms_v2
    return Path(__file__).resolve().parents[3]


_AGGREGATOR_DOMAINS = (
    "restoclub", "zoon", "tripadvisor", "yandex.ru/maps", "2gis",
    "yelp", "gastrotel", "afisha", "kudago", "restoran.ru",
    "allcafe.ru", "cafe.ru", "delivery-club", "yandex.ru/eda",
    "eda.yandex", "dostavka.yandex",
)


def _is_own_site(url: str | None) -> bool:
    """Возвращает True только если URL — собственный сайт заведения, а не агрегатор."""
    if not url or not isinstance(url, str) or "://" not in url:
        return False
    low = url.lower()
    return not any(d in low for d in _AGGREGATOR_DOMAINS)


def _norm_name_for_dedup(name: str) -> str:
    """Нормализация названия для проверки дубликатов (регистр, пробелы)."""
    return re.sub(r"\s+", " ", str(name or "").strip().lower())


def _normalize_place(place: dict) -> dict:
    return {
        "название": place.get("название"),
        "адрес": place.get("адрес"),
        "тип_заведения": place.get("тип_заведения"),
        "кухня": place.get("кухня"),
        "средний_чек": place.get("средний_чек"),
        "описание": place.get("описание_полное") or place.get("описание"),
        "ссылка": place.get("ссылка"),
        "cosine_score": place.get("cosine_score"),
        "сайт": None,
        "доставка": None,
        "время_работы": None,
    }


def _format_check_range(values: list[float]) -> str:
    if not values:
        return "чек не определен"
    if len(values) == 1:
        return f"чек около {round(values[0])}₽"
    return f"чек в диапазоне {round(min(values))}-{round(max(values))}₽"


def _market_place_conclusion(place: dict) -> str:
    name = place.get("название") or "Заведение"
    place_type = place.get("тип_заведения") or "ресторан"
    cuisine = place.get("кухня") or "кухня не уточнена"
    check = place.get("средний_чек")
    site = bool(place.get("сайт"))
    delivery = place.get("доставка")
    work_time = bool(place.get("время_работы"))

    if isinstance(check, (int, float)) and check == check:
        check_text = f"со средним чеком около {round(check)}₽"
    else:
        check_text = "без подтвержденного среднего чека"

    digital_bits = []
    if site:
        digital_bits.append("собственный сайт")
    if delivery is True:
        digital_bits.append("доставка")
    if work_time:
        digital_bits.append("подтвержденный режим работы")
    if not digital_bits:
        digital_text = "Цифровая упаковка и сервисные атрибуты подтверждены слабо."
    else:
        digital_text = "Из цифровых опор есть " + ", ".join(digital_bits) + "."

    return (
        f"{name} выглядит как {place_type} с фокусом на {cuisine}, {check_text}. "
        f"{digital_text}"
    )


def _market_block_conclusion(places: list[dict]) -> str:
    if not places:
        return "Подходящие заведения для обзора рынка не найдены."

    checks = [
        float(p["средний_чек"])
        for p in places
        if isinstance(p.get("средний_чек"), (int, float)) and p.get("средний_чек") == p.get("средний_чек")
    ]
    with_sites = sum(1 for p in places if p.get("сайт"))
    with_delivery = sum(1 for p in places if p.get("доставка") is True)

    cuisine_counts: dict[str, int] = {}
    for place in places:
        raw = str(place.get("кухня") or "")
        for chunk in raw.split(","):
            item = chunk.strip()
            if item:
                cuisine_counts[item] = cuisine_counts.get(item, 0) + 1

    top_cuisines = sorted(cuisine_counts.items(), key=lambda x: (-x[1], x[0]))[:3]
    cuisines_text = ", ".join(name for name, _ in top_cuisines) if top_cuisines else "явных доминирующих кухонь не видно"

    return (
        f"В выборку вошло {len(places)} заведений; { _format_check_range(checks) }, "
        f"чаще всего встречаются направления: {cuisines_text}. "
        f"Собственный сайт есть у {with_sites} из {len(places)} заведений, доставка подтверждена у {with_delivery}, "
        f"поэтому ниша выглядит конкурентной, но неоднородной по уровню сервисной и цифровой упаковки."
    )


def _format_market_query_context(mode: str, query_or_text) -> str:
    if mode == "free_form":
        return str(query_or_text or "").strip()

    template = query_or_text or {}
    types = ", ".join(template.get("types") or []) or "не указаны"
    cuisines = ", ".join(template.get("cuisines") or []) or "не указаны"
    price_min = template.get("price_min")
    price_max = template.get("price_max")
    features = str(template.get("особенности") or "").strip() or "не указаны"

    if price_min is not None and price_max is not None:
        price_text = f"{price_min}-{price_max}₽"
    elif price_min is not None:
        price_text = f"от {price_min}₽"
    elif price_max is not None:
        price_text = f"до {price_max}₽"
    else:
        price_text = "не указан"

    return (
        f"Типы заведений: {types}. "
        f"Кухни: {cuisines}. "
        f"Диапазон среднего чека: {price_text}. "
        f"Особенности: {features}."
    )


def _build_market_context_block1(places: list[dict]) -> str:
    if not places:
        return "Подходящие заведения не найдены."

    blocks = []
    for idx, place in enumerate(places, 1):
        check = place.get("средний_чек")
        if isinstance(check, (int, float)) and check == check:
            check_text = f"{round(check)}₽"
        else:
            check_text = "не указан"

        lines = [
            f"{idx}. {place.get('название') or 'Без названия'}",
            f"   Тип: {place.get('тип_заведения') or 'не указан'}",
            f"   Кухня: {place.get('кухня') or 'не указана'}",
            f"   Средний чек: {check_text}",
            f"   Описание: {place.get('описание') or 'не указано'}",
            f"   Cosine score: {place.get('cosine_score') if place.get('cosine_score') is not None else 'нет'}",
            f"   Собственный сайт: {'да' if place.get('сайт') else 'нет'}",
            f"   Доставка: {'да' if place.get('доставка') is True else 'нет' if place.get('доставка') is False else 'нет данных'}",
            f"   Режим работы: {place.get('время_работы') or 'не указан'}",
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_market_llm_analysis(
    places: list[dict],
    query_context: str,
    api_key: str | None,
    model: str,
) -> str:
    fallback_overall = _market_block_conclusion(places)
    fallback_by_name = {
        str(place.get("название") or ""): _market_place_conclusion(place)
        for place in places
    }
    place_index = {
        str(place.get("название") or ""): place
        for place in places
    }

    if not places:
        return fallback_overall

    for name, summary in fallback_by_name.items():
        if name in place_index:
            place_index[name]["вывод"] = summary

    if not api_key:
        return fallback_overall

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    try:
        from restaurant_pipeline.blocks.market_llm import apply_block_analysis, call_market_block_llm
        from restaurant_pipeline.blocks.block1_relevance.prompts_market import SYSTEM, USER_TEMPLATE
    except ImportError:
        from restaurant_pipeline.blocks.market_llm import apply_block_analysis, call_market_block_llm
        from restaurant_pipeline.blocks.block1_relevance.prompts_market import SYSTEM, USER_TEMPLATE

    try:
        analysis = call_market_block_llm(
            system_prompt=SYSTEM,
            user_prompt=USER_TEMPLATE.format(
                query_context=query_context or "не указан",
                block_context=_build_market_context_block1(places),
            ),
            api_key=api_key,
            model=model,
        )
        return apply_block_analysis(
            place_names=[str(place.get("название") or "") for place in places],
            analysis=analysis,
            per_place_setter=lambda name, summary: place_index[name].__setitem__("вывод", summary),
            fallback_per_place=fallback_by_name,
            fallback_overall=fallback_overall,
        )
    except Exception as e:
        print(f"[block1] Market LLM analysis fallback: {e}", flush=True)
        return fallback_overall


def _build_competitive_context_block1(places: list[dict], ref_name: str) -> str:
    """Контекст для competitive LLM: карточки с пометкой [ОПОРНОЕ]."""
    if not places:
        return "Заведения не найдены."

    blocks = []
    ref_key = str(ref_name).strip().lower()
    for idx, place in enumerate(places, 1):
        name = place.get("название") or "Без названия"
        is_ref = str(place.get("название") or "").strip().lower() == ref_key or place.get("is_reference_place")
        tag = " [ОПОРНОЕ]" if is_ref else ""

        check = place.get("средний_чек")
        check_text = f"{round(check)}₽" if isinstance(check, (int, float)) and check == check else "не указан"
        lines = [
            f"{idx}. {name}{tag}",
            f"   Тип: {place.get('тип_заведения') or 'не указан'}",
            f"   Кухня: {place.get('кухня') or 'не указана'}",
            f"   Средний чек: {check_text}",
            f"   Описание: {place.get('описание') or 'не указано'}",
            f"   Сайт: {'да' if place.get('сайт') else 'нет'}",
            f"   Доставка: {'да' if place.get('доставка') is True else 'нет' if place.get('доставка') is False else 'нет данных'}",
            f"   Режим работы: {place.get('время_работы') or 'не указан'}",
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _build_single_place_context_block1(places: list[dict], place_name: str) -> str:
    """Контекст для одного заведения (per-place анализ)."""
    place_index = {str(p.get("название") or ""): p for p in places}
    place = place_index.get(place_name) or place_index.get(place_name.strip())
    if not place:
        return ""
    check = place.get("средний_чек")
    check_text = f"{round(check)}₽" if isinstance(check, (int, float)) and check == check else "не указан"
    return "\n".join([
        f"Тип: {place.get('тип_заведения') or 'не указан'}",
        f"Кухня: {place.get('кухня') or 'не указана'}",
        f"Средний чек: {check_text}",
        f"Описание: {place.get('описание') or 'не указано'}",
        f"Сайт: {'да' if place.get('сайт') else 'нет'}",
        f"Доставка: {'да' if place.get('доставка') is True else 'нет' if place.get('доставка') is False else 'нет данных'}",
        f"Режим работы: {place.get('время_работы') or 'не указан'}",
    ])


def _apply_competitive_llm_analysis_block1(
    places: list[dict],
    ref_name: str,
    api_key: str | None,
    model: str,
) -> str:
    """Краткие выводы по заведениям + подробный вывод по опорному. Возвращает вывод_по_опорному."""
    fallback_per_place = {
        str(p.get("название") or ""): _market_place_conclusion(p)
        for p in places
    }
    ref_checks = [
        float(p["средний_чек"])
        for p in places
        if isinstance(p.get("средний_чек"), (int, float)) and p.get("средний_чек") == p.get("средний_чек")
    ]
    fallback_ref = (
        f"Опорное заведение «{ref_name}» в выборке из {len(places)} заведений. "
        f"Ценовой диапазон выборки: {_format_check_range(ref_checks)}. "
        "Для детального сравнительного вывода нужен LLM."
    )

    place_index = {str(p.get("название") or ""): p for p in places}
    for name, summary in fallback_per_place.items():
        if name in place_index:
            place_index[name]["вывод"] = summary

    if not api_key or not places or not ref_name:
        return fallback_ref

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    try:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block1_relevance.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )
    except ImportError:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block1_relevance.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )

    place_names = [str(p.get("название") or "") for p in places]

    try:
        return apply_competitive_per_place_then_compare(
            place_names=place_names,
            build_single_place_context=lambda name: _build_single_place_context_block1(places, name),
            ref_name=ref_name,
            per_place_system=PER_PLACE_SYSTEM,
            per_place_user_template=PER_PLACE_USER_TEMPLATE,
            comparison_system=COMPARISON_SYSTEM,
            comparison_user_template=COMPARISON_USER_TEMPLATE,
            api_key=api_key,
            model=model,
            per_place_setter=lambda n, s: place_index[n].__setitem__("вывод", s),
            fallback_per_place=fallback_per_place,
            fallback_ref_summary=fallback_ref,
        )
    except Exception as e:
        print(f"[block1] Competitive LLM analysis fallback: {e}", flush=True)
        return fallback_ref


def _prioritize_exact_name_match(places: list[dict], query_text: str) -> list[dict]:
    """
    Для free_form поднимает наверх заведения с точным совпадением названия.
    Сохраняет относительный порядок внутри групп.
    """
    q = (query_text or "").strip().casefold()
    if not q:
        return places
    exact = []
    rest = []
    for p in places:
        name = str(p.get("название") or "").strip().casefold()
        if name == q:
            exact.append(p)
        else:
            rest.append(p)
    return exact + rest


def _inject_exact_name_match_from_df(
    places: list[dict],
    df: pd.DataFrame,
    query_text: str,
    top_n: int,
) -> list[dict]:
    """
    Если точного совпадения названия нет в текущем топе,
    добавляет его из исходного df в начало.
    """
    q = (query_text or "").strip().casefold()
    if not q:
        return places

    def _name_of(x: dict) -> str:
        return str(x.get("название") or "").strip().casefold()

    current_names = {_name_of(p) for p in places}
    if q in current_names:
        return places

    if "название" not in df.columns:
        return places

    exact_df = df[df["название"].fillna("").astype(str).str.strip().str.casefold() == q]
    if len(exact_df) == 0:
        return places

    injected = exact_df.iloc[0].to_dict()
    injected.setdefault("cosine_score", None)
    # Не обрезаем до top_n, чтобы сохранить резервные места
    return [injected] + places


def _check_is_missing(val) -> bool:
    """Проверяет, отсутствует ли средний чек (None или NaN)."""
    if val is None:
        return True
    if isinstance(val, float) and val != val:  # NaN
        return True
    return False


_DEFAULT_CHECKS = {
    "ресторан": 3500.0,
    "кафе": 1500.0,
    "бар": 2000.0,
    "кофейня": 800.0,
    "фастфуд": 600.0,
}


def _default_check_by_type(type_str: str | None) -> float:
    """Возвращает дефолтный средний чек по типу заведения."""
    if not type_str:
        return 2000.0
    low = type_str.lower()
    for key, val in _DEFAULT_CHECKS.items():
        if key in low:
            return val
    return 2000.0


def _safe_check(val) -> str:
    """Возвращает строковое представление среднего чека, заменяя NaN/None на 'не указано'."""
    if val is None:
        return "не указано"
    if isinstance(val, float) and val != val:  # NaN
        return "не указано"
    return str(val)


class EnrichmentResponse(BaseModel):
    """Модель для строгого парсинга JSON-ответа от Perplexity."""

    site: str | None = Field(
        default=None,
        description=(
            "Официальный сайт конкретного заведения (не страница агрегатора или маркетплейса). "
            "Если официального сайта не найдено, вернуть null."
        ),
    )
    delivery: bool | None = Field(
        default=None,
        description=(
            "Есть ли у заведения собственная доставка: true, false или null (если информации нет)."
        ),
    )
    time_work: str | None = Field(
        default=None,
        description=(
            "Время работы заведения в свободной форме если оно открыто. "
            "Если заведение в данный момент закрыто навсегда, так и вернуть: 'закрыто навсегда'."
        ),
    )
    average_check: float | None = Field(
        default=None,
        description=(
            "Средний чек заведения в рублях (число). "
            "Если информация недоступна — null."
        ),
    )



def _enrich_place_with_perplexity(place: dict, api_key: str, model: str = "sonar") -> dict:
    """
    Обогащает заведение полями через Perplexity API:
    - сайт (официальный URL заведения, НЕ агрегатора/каталога)
    - доставка (True/False/None)
    - время_работы (строка или 'закрыто навсегда')
    """
    if not api_key:
        return place

    try:
        from langchain_perplexity import ChatPerplexity
    except Exception:
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="The class `ChatPerplexity` was deprecated.*")
        from langchain_community.chat_models import ChatPerplexity

    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.messages import SystemMessage, HumanMessage
    from langchain_core.exceptions import OutputParserException

    catalog_link = place.get("ссылка") or place.get("сайт") or ""

    parser = PydanticOutputParser(pydantic_object=EnrichmentResponse)
    format_instructions = parser.get_format_instructions()

    system_prompt = (
        "Ты — точный верификатор данных о заведениях Москвы. "
        "Отвечаешь ТОЛЬКО в JSON-формате, без markdown-блоков, пояснений и лишнего текста.\n\n"
        "КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:\n\n"
        "1. ПОЛЕ site:\n"
        "   - Возвращай URL ТОЛЬКО если ты на 100% уверен, что это официальный сайт "
        "именно этого заведения по этому адресу.\n"
        "   - Категорически запрещены: Zoon, TripAdvisor, Яндекс.Карты, 2GIS, Yelp, "
        "RestoClub, Afisha, KudaGo, restoran.ru, Delivery Club, Яндекс.Еда и любые агрегаторы.\n"
        "   - Если сомневаешься или собственного сайта нет — верни null.\n\n"
        "2. ПОЛЕ delivery: true если есть своя доставка, false если нет, null если неизвестно.\n\n"
        "3. ПОЛЕ time_work: строка с временем работы. "
        "Если заведение закрыто навсегда — строго 'закрыто навсегда'. Если неизвестно — null.\n\n"
        "4. ПОЛЕ average_check: целое число в рублях без валюты. Если неизвестно — null.\n\n"
        + format_instructions
    )

    user_prompt = (
        "Найди данные ТОЛЬКО для конкретного заведения ниже. "
        "Ссылка из каталога — вероятно агрегатор, не копируй её в поле site.\n\n"
        f"- Название: {place.get('название', 'не указано')}\n"
        f"- Адрес: {place.get('адрес', 'не указано')}\n"
        f"- Ссылка из каталога (вероятно агрегатор): {catalog_link}\n"
        f"- Текущий средний чек: {_safe_check(place.get('средний_чек'))}\n\n"
        "Верни ответ ТОЛЬКО в JSON-формате, без дополнительного текста."
    )

    try:
        llm = ChatPerplexity(
            api_key=api_key,
            model=model,
            temperature=0.0,
            max_tokens=256,
        )

        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ])

        content = resp.content if hasattr(resp, "content") else str(resp)
        content = content.strip()

        # Убираем markdown-блоки
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            content = content.strip()

        # Извлекаем JSON между первой { и последней }
        match = re.search(r'(\{.*\})', content, re.DOTALL)
        if match:
            content = match.group(1)

        enriched: EnrichmentResponse = parser.parse(content)

        site = enriched.site
        delivery = enriched.delivery
        time_work = enriched.time_work

        # 1) Обновляем официальный сайт
        if isinstance(site, str) and site.strip() and _is_own_site(site):
            place["сайт"] = site.strip()

        # 2) Доставка
        if isinstance(delivery, (bool, type(None))):
            place["доставка"] = delivery

        # 3) Время работы
        if isinstance(time_work, str) and time_work.strip():
            place["время_работы"] = time_work.strip()

        # 4) Средний чек — только если отсутствует или NaN
        average_check = enriched.average_check
        if _check_is_missing(place.get("средний_чек")):
            if isinstance(average_check, (int, float)) and average_check > 0:
                place["средний_чек"] = float(average_check)

    except (OutputParserException, Exception):
        pass

    # Fallback: если после Perplexity чек всё ещё пустой — дефолт по типу
    if _check_is_missing(place.get("средний_чек")):
        place["средний_чек"] = _default_check_by_type(place.get("тип_заведения"))

    return place



def _is_place_valid(place: dict) -> bool:
    """
    Проверяет валидность заведения после обогащения.
    Возвращает False если:
    1. В поле время_работы есть слово "закрыто"
    2. ИЛИ одновременно отсутствуют время_работы И сайт
    """
    time_work = str(place.get("время_работы") or "").lower()
    has_site = bool(place.get("сайт"))
    has_time_work = bool(place.get("время_работы"))
    
    # Проверка 1: есть слово "закрыто" во времени работы
    if "закрыто" in time_work:
        return False
    
    # Проверка 2: одновременно нет ни сайта, ни времени работы
    if not has_site and not has_time_work:
        return False
    
    return True


class ReferenceEnrichment(BaseModel):
    """Обогащение карточки reference_place (без описания — оно приходит из query_from_perplexity)."""

    place_type: str | None = Field(
        default=None,
        description="Тип заведения через запятую: премиум-ресторан, ресторан, бар, кафе и т.д.",
    )
    cuisine: str | None = Field(
        default=None,
        description="Виды кухни через запятую: русская, авторская, европейская и т.д.",
    )
    site: str | None = Field(
        default=None,
        description="Официальный сайт (не агрегатор). Если нет — null.",
    )
    delivery: bool | None = Field(
        default=None,
        description="Есть ли собственная доставка: true/false/null.",
    )
    time_work: str | None = Field(
        default=None,
        description="Время работы. Если закрыто навсегда — 'закрыто навсегда'. Если неизвестно — null.",
    )
    average_check: float | None = Field(
        default=None,
        description="Средний чек в рублях (число). Если неизвестно — null.",
    )


def _enrich_reference_place(card: dict, api_key: str, model: str = "sonar") -> dict:
    """Полное обогащение карточки reference_place: тип, кухня, описание + стандартные поля."""
    try:
        from langchain_perplexity import ChatPerplexity
    except Exception:
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="The class `ChatPerplexity` was deprecated.*")
        from langchain_community.chat_models import ChatPerplexity

    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.messages import SystemMessage, HumanMessage

    parser = PydanticOutputParser(pydantic_object=ReferenceEnrichment)

    system_prompt = (
        "Ты — точный верификатор данных о заведениях Москвы. "
        "Отвечаешь ТОЛЬКО в JSON-формате, без markdown-блоков и пояснений.\n\n"
        "Найди максимум информации о заведении и заполни все поля.\n"
        "Для поля site: только официальный сайт, НЕ агрегатор.\n"
        "Для поля description: 2-3 предложения о концепции, атмосфере и особенностях.\n\n"
        + parser.get_format_instructions()
    )

    user_prompt = (
        f"Заведение: {card.get('название', '')}\n"
        f"Адрес: {card.get('адрес', '')}\n"
        f"Сайт (если известен): {card.get('сайт') or 'не указан'}\n\n"
        "Верни полную информацию в JSON."
    )

    try:
        llm = ChatPerplexity(api_key=api_key, model=model, temperature=0.0, max_tokens=512)
        resp = llm.invoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
        content = resp.content if hasattr(resp, "content") else str(resp)
        content = content.strip()

        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)
            content = content.strip()

        match = re.search(r'(\{.*\})', content, re.DOTALL)
        if match:
            content = match.group(1)

        enriched: ReferenceEnrichment = parser.parse(content)

        if enriched.place_type:
            card["тип_заведения"] = enriched.place_type.strip()
        if enriched.cuisine:
            card["кухня"] = enriched.cuisine.strip()
        if enriched.site and _is_own_site(enriched.site):
            card["сайт"] = enriched.site.strip()
        if isinstance(enriched.delivery, (bool, type(None))):
            card["доставка"] = enriched.delivery
        if enriched.time_work:
            card["время_работы"] = enriched.time_work.strip()
        if _check_is_missing(card.get("средний_чек")) and enriched.average_check:
            card["средний_чек"] = float(enriched.average_check)

    except Exception:
        card = _enrich_place_with_perplexity(card, api_key, model=model)

    if _check_is_missing(card.get("средний_чек")):
        card["средний_чек"] = _default_check_by_type(card.get("тип_заведения"))

    return card


def _build_reference_card(ref: dict, api_key: str | None, model: str = "sonar") -> dict:
    """Собирает карточку опорного заведения с полным обогащением через Perplexity."""
    card = {
        "название": ref.get("name", ""),
        "адрес": ref.get("address", ""),
        "тип_заведения": None,
        "кухня": None,
        "средний_чек": None,
        "описание": None,
        "ссылка": ref.get("yandex_maps_link"),
        "cosine_score": None,
        "сайт": ref.get("website"),
        "доставка": None,
        "время_работы": None,
        "is_reference_place": True,
        "yandex_maps_link": ref.get("yandex_maps_link"),
        "menu_files": ref.get("menu_files"),
        "menu_file": ref.get("menu_file"),
        "menu_url": ref.get("menu_url"),
    }

    if api_key:
        card = _enrich_reference_place(card, api_key, model=model)

    return card


def _run_market(request: dict, root: Path) -> dict:
    """Сценарий «обзор рынка» — логика без изменений."""
    from place_search import PlaceSearch
    from search_unified import search_unified

    mode = request.get("mode", "template")
    top_n = int(request.get("top_n", 10))
    enrich_with_perplexity = bool(request.get("enrich_with_perplexity", True))
    perplexity_model = request.get("perplexity_model", "sonar")
    source_csv = request.get("source_csv", str(root / "final_blyat_v3.csv"))
    source_csv = str(Path(source_csv))

    engine = PlaceSearch.from_csv(source_csv, collapse=True)
    df = engine.df

    if mode == "template":
        query_or_text = request.get("template", {})
    elif mode == "free_form":
        query_or_text = (request.get("free_form_text") or "").strip()
    else:
        raise ValueError("mode должен быть 'template' или 'free_form'")

    query_context = _format_market_query_context(mode, query_or_text)

    api_key = os.environ.get("PPLX_API_KEY")

    search_limit = top_n * 3
    places = search_unified(df, query_or_text, n=search_limit, api_key=api_key)

    if mode == "free_form":
        places = _inject_exact_name_match_from_df(places, df, query_or_text, top_n)
        places = _prioritize_exact_name_match(places, query_or_text)

    normalized = [_normalize_place(p) for p in places]

    final_places = []
    if enrich_with_perplexity and api_key:
        candidates = normalized[:top_n]
        reserve = normalized[top_n:]
        reserve_idx = 0
        for candidate in candidates:
            enriched = _enrich_place_with_perplexity(candidate, api_key, model=perplexity_model)
            if _is_place_valid(enriched):
                final_places.append(enriched)
            else:
                replaced = False
                while reserve_idx < len(reserve):
                    reserve_candidate = reserve[reserve_idx]
                    reserve_idx += 1
                    enriched_reserve = _enrich_place_with_perplexity(
                        reserve_candidate, api_key, model=perplexity_model
                    )
                    if _is_place_valid(enriched_reserve):
                        final_places.append(enriched_reserve)
                        replaced = True
                        break
                if not replaced:
                    final_places.append(enriched)
    else:
        final_places = normalized[:top_n]

    overall_summary = _apply_market_llm_analysis(
        final_places,
        query_context=query_context,
        api_key=api_key,
        model=perplexity_model,
    )

    return {
        "block": "block1_relevance",
        "report_type": "market",
        "mode": mode,
        "top_n": top_n,
        "enrich_with_perplexity": enrich_with_perplexity,
        "perplexity_model": perplexity_model,
        "source_csv": source_csv,
        "query_context": query_context,
        "общий_вывод": overall_summary,
        "selected_places": final_places,
    }


def _run_competitive(request: dict, root: Path) -> dict:
    """
    Сценарий «конкурентный анализ».
    По данным опорного заведения определяет тип/кухню/цену → ищет 10 конкурентов из БД →
    собирает 11-ю карточку из reference_place → возвращает 11 мест.
    """
    from place_search import PlaceSearch, search_places, get_available_cuisines
    from query_from_perplexity import query_from_perplexity

    ref = request.get("reference_place", {})
    if not ref.get("name"):
        raise ValueError("reference_place.name обязательно для режима competitive")

    enrich_with_perplexity = bool(request.get("enrich_with_perplexity", True))
    perplexity_model = request.get("perplexity_model", "sonar")
    source_csv = request.get("source_csv", str(root / "final_blyat_v3.csv"))
    source_csv = str(Path(source_csv))
    top_n = int(request.get("top_n", 10))

    api_key = os.environ.get("PPLX_API_KEY")

    engine = PlaceSearch.from_csv(source_csv, collapse=True)
    df = engine.df

    ref_query = f"{ref.get('name', '')} {ref.get('address', '')}".strip()
    search_limit = top_n * 3

    available_cuisines = get_available_cuisines(df)
    parsed_query = query_from_perplexity(ref_query, available_cuisines=available_cuisines, api_key=api_key)
    ref_описание_полное = parsed_query.get("описание_полное")

    places = search_places(df, parsed_query, n=search_limit)

    normalized = [_normalize_place(p) for p in places]
    ref_name_norm = _norm_name_for_dedup(ref.get("name", ""))

    # Исключаем заведения с таким же названием, как опорное (дубли из базы)
    normalized = [p for p in normalized if _norm_name_for_dedup(p.get("название", "")) != ref_name_norm]

    # Убираем дубликаты по названию среди конкурентов (оставляем первое вхождение)
    seen_names: set[str] = set()
    deduped: list[dict] = []
    for p in normalized:
        key = _norm_name_for_dedup(p.get("название", ""))
        if key and key not in seen_names:
            seen_names.add(key)
            deduped.append(p)
    normalized = deduped

    final_places = []
    if enrich_with_perplexity and api_key:
        candidates = normalized[:top_n]
        reserve = normalized[top_n:]
        reserve_idx = 0
        for candidate in candidates:
            enriched = _enrich_place_with_perplexity(candidate, api_key, model=perplexity_model)
            if _is_place_valid(enriched):
                final_places.append(enriched)
            else:
                replaced = False
                while reserve_idx < len(reserve):
                    reserve_candidate = reserve[reserve_idx]
                    reserve_idx += 1
                    enriched_reserve = _enrich_place_with_perplexity(
                        reserve_candidate, api_key, model=perplexity_model
                    )
                    if _is_place_valid(enriched_reserve):
                        final_places.append(enriched_reserve)
                        replaced = True
                        break
                if not replaced:
                    final_places.append(enriched)
    else:
        final_places = normalized[:top_n]

    ref_card = _build_reference_card(ref, api_key, model=perplexity_model)
    if ref_описание_полное:
        ref_card["описание"] = ref_описание_полное
    final_places.append(ref_card)

    ref_name = str(ref.get("name") or "").strip()
    вывод_по_опорному = _apply_competitive_llm_analysis_block1(
        final_places,
        ref_name=ref_name,
        api_key=api_key,
        model=perplexity_model,
    )

    return {
        "block": "block1_relevance",
        "report_type": "competitive",
        "mode": "competitive",
        "top_n": top_n + 1,
        "enrich_with_perplexity": enrich_with_perplexity,
        "perplexity_model": perplexity_model,
        "source_csv": source_csv,
        "reference_place": ref,
        "вывод_по_опорному": вывод_по_опорному,
        "selected_places": final_places,
    }


def run(input_json_path: str, output_json_path: str) -> dict:
    root = _project_root()
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    with open(input_json_path, "r", encoding="utf-8") as f:
        request = json.load(f)

    try:
        from dotenv import load_dotenv
        load_dotenv(root / ".env")
    except Exception:
        pass

    report_type = request.get("report_type", "market")

    if report_type == "competitive":
        output = _run_competitive(request, root)
    else:
        output = _run_market(request, root)

    Path(output_json_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    return output


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run(args.input, args.output)
