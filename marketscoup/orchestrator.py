from __future__ import annotations

import asyncio
import sys
from typing import List

from .config import load_config
from .domain.models import (
    AggregatedAnalysis,
    AggregatedEstablishment,
    Establishment,
)
from .modules.aggregator import aggregate
from .modules.finance import fetch_finance_batch
from .modules.reviews import fetch_reviews_batch
from .modules.segment import find_similar_establishments, get_price_segment_info


async def run_analysis(query: str, top_n: int = 10) -> AggregatedAnalysis:
    config = load_config()
    debug = (config.log_level or "").upper() == "DEBUG"

    print(f"[Этап 1/3] Начинаю сегментацию: поиск похожих заведений...", file=sys.stderr)
    segment = await find_similar_establishments(query=query, top_n=top_n)
    establishments: List[Establishment] = segment.establishments
    print(f"[Этап 1/3] Сегментация завершена: найдено {len(establishments)} заведений", file=sys.stderr)
    if debug:
        print(f"[orchestrator] establishments_count={len(establishments)}")

    # Получаем информацию о ценовом сегменте
    segment_name, segment_desc, segment_keywords = get_price_segment_info(query)
    
    print(f"[Этап 2/3] Собираю финансовые данные и отзывы...", file=sys.stderr)
    finance_task = asyncio.create_task(
        fetch_finance_batch(establishments, config=config)
    )
    reviews_task = asyncio.create_task(
        fetch_reviews_batch(establishments, config=config, price_segment=segment_name, segment_keywords=segment_keywords)
    )

    finance, reviews = await asyncio.gather(finance_task, reviews_task)
    print(f"[Этап 2/3] Сбор финансовых данных и отзывов завершён", file=sys.stderr)

    items: List[AggregatedEstablishment] = aggregate(
        establishments=establishments, finance=finance, reviews=reviews, price_segment=segment_name
    )
    if debug:
        print(f"[orchestrator] aggregated_items_count={len(items)}")

    return AggregatedAnalysis(query=query, items=items)


