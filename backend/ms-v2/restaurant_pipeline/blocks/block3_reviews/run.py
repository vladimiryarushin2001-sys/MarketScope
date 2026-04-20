from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from collections import Counter
from statistics import mean
from typing import Optional

import pandas as pd
from pydantic import BaseModel, Field


def _project_root() -> Path:
    # .../restaurant_pipeline/blocks/block3_reviews/run.py -> .../ms_v2
    return Path(__file__).resolve().parents[3]


def _norm_text(value: str) -> str:
    s = str(value or "").strip().lower().replace("ё", "е")
    s = re.sub(r"[\"'`«»]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


def _pick_rows_for_selected_places(source_df: pd.DataFrame, selected_places: list[dict]) -> pd.DataFrame:
    """
    Матчим выбранные заведения (название + адрес) к исходной базе.
    Возвращаем строки для передачи в parse_yandex_reviews.
    """
    df = source_df.copy()
    if "название" not in df.columns or "адрес" not in df.columns:
        raise ValueError("В source_csv должны быть колонки 'название' и 'адрес'.")

    df["_name_norm"] = df["название"].fillna("").astype(str).map(_norm_text)
    df["_addr_norm"] = df["адрес"].fillna("").astype(str).map(_norm_text)

    picked_indices: list[int] = []
    for place in selected_places:
        name_norm = _norm_text(place.get("название"))
        addr_norm = _norm_text(place.get("адрес"))
        if not name_norm:
            continue

        # 1) Точное совпадение по нормализованному названию
        cand = df[df["_name_norm"] == name_norm]

        # 2) Если несколько - уточняем по адресу
        if len(cand) > 1 and addr_norm:
            cand_addr = cand[
                (cand["_addr_norm"] == addr_norm)
                | (cand["_addr_norm"].str.contains(addr_norm, regex=False))
                | (pd.Series([addr_norm] * len(cand), index=cand.index).str.contains(cand["_addr_norm"], regex=False))
            ]
            if len(cand_addr) > 0:
                cand = cand_addr

        # 3) Если нет точного - мягкий поиск по вхождению названия
        if len(cand) == 0:
            cand = df[df["_name_norm"].str.contains(name_norm, regex=False)]

        if len(cand) == 0:
            continue

        picked_indices.append(int(cand.index[0]))

    if not picked_indices:
        return df.iloc[0:0].drop(columns=["_name_norm", "_addr_norm"], errors="ignore")

    out = df.loc[sorted(set(picked_indices))].drop(columns=["_name_norm", "_addr_norm"], errors="ignore")
    return out.reset_index(drop=True)


def _address_matches(expected_addr: str, actual_addr: str) -> bool:
    """Проверяет, что адрес из Яндекс Карт похож на ожидаемый из block1."""
    e = _norm_text(expected_addr)
    a = _norm_text(actual_addr)
    if not e or not a:
        return True
    if e == a:
        return True
    e_parts = [p for p in re.split(r"[,.\s]+", e) if len(p) > 2]
    matched = sum(1 for p in e_parts if p in a)
    return matched >= max(1, len(e_parts) // 2)


_HOTEL_ONLY_KEYWORDS = {
    "номер", "номера", "заселен", "заселил", "check-in", "check in",
    "ресепшн", "reception", "ресепшен", "горничн", "уборка номер",
    "матрас", "кроват", "подушк", "полотенц", "халат", "тапочк",
    "бассейн", "спа", "сауна", "хамам", "трансфер", "багаж",
    "этаж номер", "вид из номер", "шумоизоляц", "кондиционер в номер",
    "мини-бар", "минибар", "сейф в номер",
}

_RESTAURANT_KEYWORDS = {
    "блюд", "еда", "кухн", "меню", "официант", "повар", "шеф",
    "вкусн", "невкусн", "порци", "подач", "закуск", "суп", "салат",
    "стейк", "десерт", "вино", "коктейл", "бар", "завтрак обед ужин",
    "ресторан", "кафе", "столик", "бронирован", "сервис обслуж",
    "счет", "чек", "чаевы",
}


def _is_restaurant_review(text: str) -> bool:
    """
    Классифицирует отзыв: относится ли он к ресторану.
    Если есть слова про отель И нет слов про ресторан — отсекаем.
    """
    low = text.lower().replace("ё", "е")
    has_hotel = any(kw in low for kw in _HOTEL_ONLY_KEYWORDS)
    has_restaurant = any(kw in low for kw in _RESTAURANT_KEYWORDS)
    if has_hotel and not has_restaurant:
        return False
    return True


def _filter_restaurant_reviews(reviews: list[dict]) -> tuple[list[dict], int]:
    """Фильтрует отзывы, оставляя только относящиеся к ресторану. Возвращает (filtered, removed_count)."""
    filtered = []
    removed = 0
    for r in reviews:
        text = str(r.get("text") or "").strip()
        if not text:
            continue
        if _is_restaurant_review(text):
            filtered.append(r)
        else:
            removed += 1
    return filtered, removed


def _safe_texts(reviews: list[dict], limit: int = 100) -> list[str]:
    out = []
    for r in reviews[:limit]:
        t = str(r.get("text") or "").strip()
        if t:
            out.append(t)
    return out


def _stars_stats(reviews: list[dict]) -> tuple[float | None, int, int]:
    stars = [int(r.get("stars")) for r in reviews if isinstance(r.get("stars"), int)]
    if not stars:
        return None, 0, 0
    avg = mean(stars)
    pos = sum(1 for s in stars if s >= 4)
    neg = sum(1 for s in stars if s <= 2)
    return float(avg), pos, neg


def _simple_summary(place_name: str, reviews: list[dict]) -> dict:
    texts = _safe_texts(reviews, limit=100)
    avg, pos, neg = _stars_stats(reviews)
    common = f"Собрано отзывов: {len(texts)}."
    if avg is not None:
        common += f" Средняя оценка: {avg:.2f}."
    return {
        "заведение": place_name,
        "количество_отзывов": len(texts),
        "общая_информация": common,
        "положительное": f"Положительных по звёздам (4-5): {pos}.",
        "отрицательное": f"Отрицательных по звёздам (1-2): {neg}.",
    }


def _normalize_feedback_item(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower().replace("ё", "е"))


def _reviews_place_conclusion(summary: dict) -> str:
    review_count = int(summary.get("количество_отзывов") or 0)
    positives = summary.get("положительное") or []
    negatives = summary.get("отрицательное") or []

    if isinstance(positives, str):
        positives = [positives] if positives else []
    if isinstance(negatives, str):
        negatives = [negatives] if negatives else []

    if review_count == 0:
        return "По заведению не удалось собрать релевантные отзывы, поэтому репутационный вывод ограничен."

    pos_text = positives[0] if positives else "сильные стороны явно не сформулированы"
    if negatives:
        neg_text = negatives[0]
        return (
            f"По {review_count} релевантным отзывам заведение воспринимается позитивно за счет сильных сторон вроде: {pos_text}. "
            f"Главный риск в отзывах связан с тем, что гости отдельно отмечают: {neg_text}."
        )
    return (
        f"По {review_count} релевантным отзывам заведение воспринимается стабильно положительно; "
        f"чаще всего гости выделяют: {pos_text}."
    )


def _reviews_block_conclusion(summaries: list[dict]) -> str:
    with_reviews = [s for s in summaries if int(s.get("количество_отзывов") or 0) > 0]
    if not with_reviews:
        return "Релевантные отзывы по выбранным заведениям не собраны, поэтому общий репутационный срез не сформирован."

    positive_counter: Counter[str] = Counter()
    negative_counter: Counter[str] = Counter()
    for summary in with_reviews:
        positives = summary.get("положительное") or []
        negatives = summary.get("отрицательное") or []
        if isinstance(positives, str):
            positives = [positives] if positives else []
        if isinstance(negatives, str):
            negatives = [negatives] if negatives else []
        for item in positives:
            normalized = _normalize_feedback_item(item)
            if normalized:
                positive_counter[normalized] += 1
        for item in negatives:
            normalized = _normalize_feedback_item(item)
            if normalized:
                negative_counter[normalized] += 1

    review_leader = max(with_reviews, key=lambda s: int(s.get("количество_отзывов") or 0))
    top_positive = positive_counter.most_common(1)[0][0] if positive_counter else "выраженных повторяющихся сильных сторон не выделено"
    top_negative = negative_counter.most_common(1)[0][0] if negative_counter else "существенных сквозных жалоб почти нет"

    return (
        f"Релевантные отзывы собраны по {len(with_reviews)} заведениям; самый насыщенный репутационный след у «{review_leader.get('заведение', '?')}». "
        f"Чаще всего гости хвалят: {top_positive}, а основной повторяющийся источник негатива связан с темой: {top_negative}."
    )


class ReviewSummary(BaseModel):
    """Структурированное саммари отзывов заведения."""

    общая_информация: str = Field(
        description="Общее саммари: краткий обзор заведения на основе отзывов (2-4 предложения). "
        "Упомяни среднюю оценку, общее впечатление посетителей, ключевые особенности."
    )
    положительное: list[str] = Field(
        description="Список конкретных положительных моментов из отзывов (3-8 пунктов). "
        "Каждый пункт — одно предложение с конкретикой."
    )
    отрицательное: list[str] = Field(
        description="Список конкретных отрицательных моментов из отзывов (1-5 пунктов). "
        "Каждый пункт — одно предложение с конкретикой. Если негатива нет, пустой список."
    )


_SUMMARY_SYSTEM_PROMPT = """Ты анализируешь отзывы посетителей о заведении общественного питания.
На основе предоставленных отзывов составь структурированное саммари.

КРИТИЧЕСКИ ВАЖНО — ФИЛЬТРАЦИЯ:
Тебе передан контекст заведения (тип, кухня, чек). Используй его, чтобы
ИГНОРИРОВАТЬ отзывы, которые явно не относятся к ресторану/кафе/бару.
Признаки нерелевантного отзыва:
— описывает гостиничный номер, заселение, трансфер, бассейн, спа;
— описывает магазин, шоурум, салон красоты или другой бизнес;
— не содержит ни одного упоминания еды, напитков, обслуживания или атмосферы заведения.
Если отзыв смешанный (и про отель, и про ресторан) — извлеки ТОЛЬКО часть про ресторан.

Правила:
- Пиши на русском языке
- Опирайся только на факты из отзывов, не додумывай
- Положительные и отрицательные пункты должны быть конкретными, с деталями из отзывов
- Если негативных отзывов мало или нет — так и укажи в общей информации

{format_instructions}"""

_SUMMARY_USER_PROMPT = """Заведение: {place_name}
Тип: {place_type}
Кухня: {place_cuisine}
Средний чек: {place_check}
Количество отзывов: {review_count}
Средняя оценка: {avg_rating}

Тексты отзывов:
{reviews_text}

Составь структурированное саммари. Учитывай ТОЛЬКО отзывы,
относящиеся к ресторану/кафе/бару."""


def _summarize_with_perplexity(
    place_name: str,
    reviews: list[dict],
    api_key: str,
    model: str = "sonar",
    place_info: dict | None = None,
) -> dict:
    """Суммаризация отзывов через Perplexity + PydanticOutputParser."""
    try:
        from langchain_perplexity import ChatPerplexity
    except Exception:
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="The class `ChatPerplexity` was deprecated.*")
            from langchain_community.chat_models import ChatPerplexity
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_core.output_parsers import PydanticOutputParser

    parser = PydanticOutputParser(pydantic_object=ReviewSummary)

    texts = _safe_texts(reviews, limit=100)
    avg, _, _ = _stars_stats(reviews)
    avg_str = f"{avg:.2f}" if avg is not None else "нет данных"

    info = place_info or {}
    check_val = info.get("средний_чек")
    check_str = f"{check_val:.0f}₽" if check_val and check_val == check_val else "н/д"

    reviews_text = "\n---\n".join(texts[:50])

    system_text = _SUMMARY_SYSTEM_PROMPT.format(
        format_instructions=parser.get_format_instructions(),
    )
    user_text = _SUMMARY_USER_PROMPT.format(
        place_name=place_name,
        place_type=info.get("тип_заведения") or "ресторан",
        place_cuisine=info.get("кухня") or "н/д",
        place_check=check_str,
        review_count=len(texts),
        avg_rating=avg_str,
        reviews_text=reviews_text,
    )

    llm = ChatPerplexity(
        api_key=api_key,
        model=model,
        temperature=0.1,
        max_tokens=2048,
    )

    response = llm.invoke([
        SystemMessage(content=system_text),
        HumanMessage(content=user_text),
    ])

    content = response.content if hasattr(response, "content") else str(response)
    result: ReviewSummary = parser.parse(content)

    return {
        "заведение": place_name,
        "количество_отзывов": len(texts),
        **result.model_dump(),
    }


def _build_market_context_block3(summaries: list[dict], summary_mode: str) -> str:
    if not summaries:
        return "Релевантные отзывы по заведениям не собраны."

    blocks = []
    for idx, summary in enumerate(summaries, 1):
        positives = summary.get("положительное") or []
        negatives = summary.get("отрицательное") or []
        if isinstance(positives, str):
            positives = [positives] if positives else []
        if isinstance(negatives, str):
            negatives = [negatives] if negatives else []

        lines = [
            f"{idx}. {summary.get('заведение') or 'Без названия'}",
            f"   Количество релевантных отзывов: {summary.get('количество_отзывов') or 0}",
            f"   Режим суммаризации: {summary_mode}",
            f"   Общая информация: {summary.get('общая_информация') or 'нет'}",
            f"   Положительное: {'; '.join(positives[:5]) if positives else 'нет явных повторов'}",
            f"   Отрицательное: {'; '.join(negatives[:5]) if negatives else 'нет явных повторов'}",
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_market_llm_analysis(
    summaries: list[dict],
    query_context: str,
    api_key: str,
    model: str,
    summary_mode: str,
) -> str:
    fallback_overall = _reviews_block_conclusion(summaries)
    fallback_by_name = {
        str(summary.get("заведение") or ""): _reviews_place_conclusion(summary)
        for summary in summaries
    }
    summary_index = {
        str(summary.get("заведение") or ""): summary
        for summary in summaries
    }

    for name, text in fallback_by_name.items():
        if name in summary_index:
            summary_index[name]["вывод"] = text

    if not api_key or not summaries:
        return fallback_overall

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from restaurant_pipeline.blocks.market_llm import apply_block_analysis, call_market_block_llm
    from restaurant_pipeline.blocks.block3_reviews.prompts_market import SYSTEM, USER_TEMPLATE

    try:
        analysis = call_market_block_llm(
            system_prompt=SYSTEM,
            user_prompt=USER_TEMPLATE.format(
                query_context=query_context or "не указан",
                block_context=_build_market_context_block3(summaries, summary_mode),
            ),
            api_key=api_key,
            model=model,
        )
        return apply_block_analysis(
            place_names=[str(summary.get("заведение") or "") for summary in summaries],
            analysis=analysis,
            per_place_setter=lambda name, summary_text: summary_index[name].__setitem__("вывод", summary_text),
            fallback_per_place=fallback_by_name,
            fallback_overall=fallback_overall,
        )
    except Exception as e:
        print(f"[block3] Market LLM analysis fallback: {e}", flush=True)
        return fallback_overall


def _build_competitive_context_block3(summaries: list[dict], ref_name: str, summary_mode: str) -> str:
    """Контекст для competitive LLM: отзывы по заведениям с пометкой [ОПОРНОЕ]."""
    if not summaries:
        return "Релевантные отзывы не собраны."

    blocks = []
    ref_key = str(ref_name).strip().lower()
    for idx, summary in enumerate(summaries, 1):
        name = summary.get("заведение") or "Без названия"
        is_ref = str(name).strip().lower() == ref_key or summary.get("is_reference_place")
        tag = " [ОПОРНОЕ]" if is_ref else ""
        positives = summary.get("положительное") or []
        negatives = summary.get("отрицательное") or []
        if isinstance(positives, str):
            positives = [positives] if positives else []
        if isinstance(negatives, str):
            negatives = [negatives] if negatives else []
        lines = [
            f"{idx}. {name}{tag}",
            f"   Количество отзывов: {summary.get('количество_отзывов') or 0}",
            f"   Режим: {summary_mode}",
            f"   Общая информация: {summary.get('общая_информация') or 'нет'}",
            f"   Положительное: {'; '.join(positives[:5]) if positives else 'нет'}",
            f"   Отрицательное: {'; '.join(negatives[:5]) if negatives else 'нет'}",
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_competitive_llm_analysis_block3(
    summaries: list[dict],
    ref_name: str,
    api_key: str,
    model: str,
    summary_mode: str,
) -> str:
    """Краткие выводы по заведениям + подробный по опорному. Возвращает вывод_по_опорному."""
    fallback_by_name = {
        str(s.get("заведение") or ""): _reviews_place_conclusion(s)
        for s in summaries
    }
    summary_index = {str(s.get("заведение") or ""): s for s in summaries}
    fallback_ref = (
        f"По отзывам опорного заведения «{ref_name}» в выборке из {len(summaries)} заведений. "
        "Для детального сравнительного вывода нужен LLM."
    )
    for name, text in fallback_by_name.items():
        if name in summary_index:
            summary_index[name]["вывод"] = text

    if not api_key or not summaries or not ref_name:
        return fallback_ref

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    try:
        from restaurant_pipeline.blocks.competitive_llm import (
            apply_competitive_block_analysis,
            call_competitive_block_llm,
        )
        from restaurant_pipeline.blocks.block3_reviews.prompts_competitive import SYSTEM, USER_TEMPLATE
    except ImportError:
        from restaurant_pipeline.blocks.competitive_llm import (
            apply_competitive_block_analysis,
            call_competitive_block_llm,
        )
        from restaurant_pipeline.blocks.block3_reviews.prompts_competitive import SYSTEM, USER_TEMPLATE

    try:
        analysis = call_competitive_block_llm(
            system_prompt=SYSTEM,
            user_prompt=USER_TEMPLATE.format(
                ref_name=ref_name,
                block_context=_build_competitive_context_block3(summaries, ref_name, summary_mode),
            ),
            api_key=api_key,
            model=model,
        )
        return apply_competitive_block_analysis(
            place_names=[str(s.get("заведение") or "") for s in summaries],
            ref_name=ref_name,
            analysis=analysis,
            per_place_setter=lambda n, t: summary_index[n].__setitem__("вывод", t),
            fallback_per_place=fallback_by_name,
            fallback_ref_summary=fallback_ref,
        )
    except Exception as e:
        print(f"[block3] Competitive LLM analysis fallback: {e}", flush=True)
        return fallback_ref


def _build_reference_csv_row(place: dict) -> dict:
    """
    Создаёт строку CSV для опорного заведения (reference_place).
    Если есть yandex_maps_link — парсер может извлечь org_id напрямую.
    """
    return {
        "название": place.get("название", ""),
        "адрес": place.get("адрес", ""),
        "ссылка": place.get("yandex_maps_link", ""),
    }


def run(
    input_json_path: str,
    output_json_path: str,
    parse_limit: int | None = None,
    skip_parse: bool = False,
    raw_reviews_path: str | None = None,
) -> dict:
    root = _project_root()
    parser_script = root / "parse_yandex_reviews.py"

    with open(input_json_path, "r", encoding="utf-8") as f:
        block1 = json.load(f)

    is_market = block1.get("report_type") == "market"
    is_competitive = block1.get("report_type") == "competitive"
    ref_name = str((block1.get("reference_place") or {}).get("name") or "").strip()
    source_csv = Path(block1.get("source_csv") or (root / "final_blyat_v3.csv"))
    selected = block1.get("selected_places", [])

    exchange_dir = Path(output_json_path).resolve().parent
    exchange_dir.mkdir(parents=True, exist_ok=True)
    parser_output_json = Path(raw_reviews_path or (exchange_dir / "block3_reviews_raw.json"))

    if skip_parse:
        if not parser_output_json.exists():
            raise FileNotFoundError(
                f"Файл с отзывами не найден: {parser_output_json}. "
                "Укажите --raw путь или уберите --skip-parse."
            )
        print(f"[block3] Пропуск парсинга, загрузка {parser_output_json}...", flush=True)
        with open(parser_output_json, "r", encoding="utf-8") as f:
            reviews_data = json.load(f)
        matched_df = pd.DataFrame()
        parser_input_csv = None
    else:
        if not source_csv.exists():
            raise FileNotFoundError(f"source_csv не найден: {source_csv}")

        regular_places = [p for p in selected if not p.get("is_reference_place")]
        ref_places = [p for p in selected if p.get("is_reference_place")]

        source_df = pd.read_csv(source_csv)
        matched_df = _pick_rows_for_selected_places(source_df, regular_places)

        if ref_places:
            ref_rows = pd.DataFrame([_build_reference_csv_row(p) for p in ref_places])
            for col in matched_df.columns:
                if col not in ref_rows.columns:
                    ref_rows[col] = ""
            ref_rows = ref_rows[matched_df.columns] if len(matched_df) > 0 else ref_rows
            matched_df = pd.concat([matched_df, ref_rows], ignore_index=True)

        parser_input_csv = exchange_dir / "block3_parser_input.csv"
        matched_df.to_csv(parser_input_csv, index=False)

        cmd = [
            sys.executable, "-u",
            str(parser_script),
            "--csv",
            str(parser_input_csv),
            "--output",
            str(parser_output_json),
        ]
        if parse_limit is not None:
            cmd += ["--limit", str(parse_limit)]

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        proc = subprocess.run(cmd, env=env)
        if proc.returncode != 0:
            raise RuntimeError(
                f"parse_yandex_reviews завершился с кодом {proc.returncode}"
            )

        with open(parser_output_json, "r", encoding="utf-8") as f:
            reviews_data = json.load(f)

    # Оценка тональности каждого отзыва (-1/0/1)
    from restaurant_pipeline.blocks.block3_reviews.sentiment import add_sentiment_to_reviews

    total_reviews = sum(len(p.get("reviews") or []) for p in reviews_data)
    if total_reviews > 0:
        print(f"[block3] Оценка тональности {total_reviews} отзывов...", flush=True)
        add_sentiment_to_reviews(reviews_data)
    enriched_path = exchange_dir / "block3_reviews_enriched.json"
    with open(enriched_path, "w", encoding="utf-8") as f:
        json.dump(reviews_data, f, ensure_ascii=False, indent=2)
    if total_reviews > 0:
        print(f"[block3] Отзывы с тональностью сохранены в {enriched_path}", flush=True)

    try:
        from dotenv import load_dotenv
        load_dotenv(root / ".env")
    except Exception:
        pass

    api_key = os.environ.get("PPLX_API_KEY")
    perplexity_model = block1.get("perplexity_model", "sonar")

    reviews_by_name = {str(item.get("place_name", "")).strip().lower(): item for item in reviews_data}
    summaries = []
    for i, place in enumerate(selected, 1):
        name = str(place.get("название") or "").strip()
        key = name.lower()
        item = reviews_by_name.get(key, {})
        reviews = item.get("reviews") or []

        is_ref = place.get("is_reference_place", False)

        # Шаг 1: валидация адреса
        expected_addr = str(place.get("адрес") or "")
        actual_addr = str(item.get("place_address") or "")
        if reviews and not _address_matches(expected_addr, actual_addr):
            print(f"  [{i}/{len(selected)}] «{name}»: адрес не совпал "
                  f"(ожидали «{expected_addr}», получили «{actual_addr}»). Отзывы отброшены.", flush=True)
            reviews = []

        # Шаг 2: keyword-фильтр (отсекаем отзывы про отель и т.д.)
        if reviews:
            reviews, removed = _filter_restaurant_reviews(reviews)
            if removed > 0:
                print(f"  [{i}/{len(selected)}] «{name}»: отфильтровано {removed} нерелевантных отзывов "
                      f"(осталось {len(reviews)})", flush=True)

        # Шаг 3: суммаризация с контекстом заведения
        if api_key and reviews:
            print(f"  [{i}/{len(selected)}] Суммаризация «{name}»{'  [reference]' if is_ref else ''} "
                  f"через Perplexity ({len(reviews)} отзывов)...", flush=True)
            try:
                summary = _summarize_with_perplexity(
                    name, reviews, api_key, model=perplexity_model, place_info=place,
                )
            except Exception as e:
                print(f"    Ошибка LLM, fallback на статистику: {e}")
                summary = _simple_summary(name, reviews)
        else:
            summary = _simple_summary(name, reviews)

        if is_ref:
            summary["is_reference_place"] = True
        summaries.append(summary)

    summary_mode = "perplexity" if api_key else "simple"

    payload = {
        "block": "block3_reviews",
        "summary_mode": summary_mode,
        "source_csv": str(source_csv) if not skip_parse else "",
        "parser_input_csv": str(parser_input_csv) if parser_input_csv else "",
        "source_reviews_json": str(parser_output_json),
        "source_reviews_enriched_json": str(exchange_dir / "block3_reviews_enriched.json"),
        "matched_places_count": len(selected) if skip_parse else len(matched_df),
        "summaries": summaries,
    }
    if is_market:
        payload["общий_вывод"] = _apply_market_llm_analysis(
            summaries,
            query_context=str(block1.get("query_context") or "").strip(),
            api_key=api_key or "",
            model=perplexity_model,
            summary_mode=summary_mode,
        )
    elif is_competitive and summaries:
        payload["вывод_по_опорному"] = _apply_competitive_llm_analysis_block3(
            summaries,
            ref_name=ref_name,
            api_key=api_key or "",
            model=perplexity_model,
            summary_mode=summary_mode,
        )
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return payload


if __name__ == "__main__":
    import argparse

    _root = Path(__file__).resolve().parents[3]
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--parse-limit", type=int, default=None)
    parser.add_argument("--skip-parse", action="store_true",
                        help="Пропустить парсинг, использовать существующий block3_reviews_raw.json")
    parser.add_argument("--raw", type=str, default=None,
                        help="Путь к файлу с отзывами (по умолчанию: exchange_dir/block3_reviews_raw.json)")
    args = parser.parse_args()
    run(args.input, args.output, parse_limit=args.parse_limit,
        skip_parse=args.skip_parse, raw_reviews_path=args.raw)

