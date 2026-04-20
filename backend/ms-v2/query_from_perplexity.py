# -*- coding: utf-8 -*-
"""
Блок 2: пользователь вводит название и адрес (свободный текст) —
запрос в Perplexity для получения полей под фильтры place_search.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    import pandas as pd

from pydantic import BaseModel, Field


class SearchQueryFromLLM(BaseModel):
    """Структура ответа LLM для подстановки в фильтры поиска заведений."""

    types: list[str] = Field(default_factory=list, description="Типы заведения: ресторан, кафе, бар, премиум-ресторан, семейный ресторан и т.д.")
    cuisines: list[str] = Field(default_factory=list, description="Кухни: русская, авторская, европейская и т.д.")
    price_min: Optional[float] = Field(None, description="Нижняя граница среднего чека в рублях")
    price_max: Optional[float] = Field(None, description="Верхняя граница среднего чека в рублях")
    особенности: Optional[str] = Field(None, description="Краткое описание атмосферы/особенностей для семантического поиска (ключевые слова)")
    описание_полное: Optional[str] = Field(None, description="Полное описание заведения в 2-3 предложениях: концепция, кухня, атмосфера, расположение. Используется для семантического сравнения с другими заведениями.")


SYSTEM_PROMPT = """Ты помогаешь превратить запрос пользователя о заведении (название, адрес или описание желаемого места) в структурированные поля для поиска по базе ресторанов/кафе Москвы.

Пользователь пишет своё название и адрес или просто описание того, что ищет. Твоя задача — по этим данным (или по известной информации о таком заведении) заполнить JSON:

- types: массив типов заведения из одного или нескольких значений. Используй точные формулировки: ресторан, кафе, бар, премиум-ресторан, семейный ресторан, кофейня, паб, лаунж, гастробар, винотека, стейк-хаус, пиццерия, антикафе, лофт, корабль и т.д. Если не уверен — укажи наиболее вероятные (например ресторан, премиум-ресторан).
- cuisines: массив кухонь. Если в запросе передан список доступных кухонь в базе — выбери из него 1–2 самых подходящих для запроса пользователя (точные совпадения по формулировке). Если списка нет — укажи русская, авторская, европейская и т.д.
- price_min, price_max: средний чек в рублях (числа или null, если неизвестно).
- особенности: одна строка — ключевые слова/короткое описание атмосферы и особенностей для семантического поиска (панорамный вид, живая музыка, терраса, детское меню и т.д.). На русском. Если нечего добавить — null.
- описание_полное: связное описание заведения в 2-3 предложениях. Опиши концепцию, тип кухни, атмосферу и ключевые особенности места. Это описание будет использоваться для семантического сравнения с описаниями других заведений в базе. Обязательно заполни это поле.

{format_instructions}"""

USER_PROMPT_TEMPLATE = """Пользователь ищет заведение. Он написал:

{user_input}
{cuisines_block}

Верни структурированный JSON для поиска по базе."""


def query_from_perplexity(
    user_input: str,
    *,
    available_cuisines: Optional[list[str]] = None,
    api_key: Optional[str] = None,
    model: str = "sonar",
) -> dict[str, Any]:
    """
    По тексту пользователя (название, адрес или описание) получает от Perplexity
    поля для фильтров place_search: types, cuisines, price_min, price_max, особенности.

    available_cuisines: список кухонь из нашей базы — в промпте просим выбрать 1–2 самых подходящих.
    api_key: ключ Perplexity (PPLX_API_KEY). Если не передан — берётся из os.environ["PPLX_API_KEY"].
    """
    import os
    key = api_key or os.environ.get("PPLX_API_KEY")
    if not key:
        raise ValueError(
            "Нужен API-ключ Perplexity: передайте api_key в функцию или задайте переменную окружения PPLX_API_KEY."
        )

    try:
        from langchain_perplexity import ChatPerplexity
    except Exception:
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="The class `ChatPerplexity` was deprecated.*")
            from langchain_community.chat_models import ChatPerplexity
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_core.output_parsers import PydanticOutputParser

    parser = PydanticOutputParser(pydantic_object=SearchQueryFromLLM)

    if available_cuisines:
        cuisines_block = "\n\nВ нашей базе доступны только такие кухни (выбери 1–2 самых подходящих для запроса, в cuisines укажи только их):\n" + ", ".join(available_cuisines)
    else:
        cuisines_block = ""

    llm = ChatPerplexity(
        api_key=key,
        model=model,
        temperature=0.1,
        max_tokens=1024,
    )

    system_text = SYSTEM_PROMPT.format(format_instructions=parser.get_format_instructions())
    user_text = USER_PROMPT_TEMPLATE.format(
        user_input=user_input.strip(),
        cuisines_block=cuisines_block,
    )

    response = llm.invoke([
        SystemMessage(content=system_text),
        HumanMessage(content=user_text),
    ])

    content = response.content if hasattr(response, "content") else str(response)
    result: SearchQueryFromLLM = parser.parse(content)

    return result.model_dump()


def search_by_user_text(
    df: pd.DataFrame,
    user_input: str,
    n: int = 20,
    api_key: Optional[str] = None,
) -> list[dict[str, Any]]:
    """
    Пользователь вводит название и адрес (или свободный текст).
    Запрос в Perplexity (с списком кухонь из базы — выбираем 1–2 подходящих) → search_places → топ-n.
    """
    from place_search import get_available_cuisines, search_places

    available_cuisines = get_available_cuisines(df)
    query = query_from_perplexity(user_input, available_cuisines=available_cuisines, api_key=api_key)
    return search_places(df, query, n=n)
