# -*- coding: utf-8 -*-
"""
Единый блок поиска заведений: два входа — один выход (топ-5).

1. Готовые фильтры: пользователь передаёт dict с полями types, cuisines, price_min, price_max, особенности.
2. Свободный текст: пользователь передаёт название и адрес (или только название) — запрос в Perplexity → поля для фильтров.

В обоих случаях на выходе — топ-n заведений (по умолчанию 5).
"""

from __future__ import annotations

from typing import Any, Optional, Union

# Для type hint
import pandas as pd


def search_unified(
    df: pd.DataFrame,
    query_or_text: Union[dict[str, Any], str],
    n: int = 5,
    api_key: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    Единая точка входа: либо готовые фильтры (dict), либо свободный текст (название/адрес).

    - query_or_text: dict с ключами types, cuisines, price_min, price_max, особенности — используем как есть.
    - query_or_text: str — запрос в Perplexity, получаем поля для фильтров, затем поиск.

    Возвращает топ-n заведений (по умолчанию 5).
    """
    from place_search import search_places

    if isinstance(query_or_text, str):
        from place_search import get_available_cuisines
        from query_from_perplexity import query_from_perplexity
        text = query_or_text.strip()
        if not text:
            return []
        available_cuisines = get_available_cuisines(df)
        query = query_from_perplexity(text, available_cuisines=available_cuisines, api_key=api_key)
    else:
        query = dict(query_or_text)
        # Убедиться, что n из аргумента, а не из query
        query.pop("n", None)

    return search_places(df, query, n=n)
