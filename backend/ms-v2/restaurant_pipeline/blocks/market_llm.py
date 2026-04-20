from __future__ import annotations

import re
from typing import Callable

from pydantic import BaseModel, Field


MARKET_ANALYST_SYSTEM = """
Ты — старший аналитик ресторанного рынка Москвы.
Ты готовишь аналитический вывод для предпринимателя, который принимает решения
по открытию, управлению и развитию ресторана.

ТВОЙ СТАНДАРТ РАБОТЫ:
- только факты и соотношения из предоставленных данных;
- никакой внешней статистики, бенчмарков, отраслевых легенд и домыслов;
- если данных недостаточно — прямо скажи, чего именно не хватает;
- русский язык без англицизмов, воды и шаблонных фраз;
- конкретика важнее красоты текста;
- не пересказывай поля карточек, а интерпретируй их;
- если у данных есть ограничения, упоминай это как ограничение анализа.

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Ты не выдумываешь цифры, рейтинги, тренды и причины.
2. Ты не подменяешь отсутствие данных предположениями.
3. Ты не пишешь рекламный текст. Это аналитика.
4. Для каждого заведения нужен короткий отдельный вывод.
5. Нужен один общий вывод по блоку, который сравнивает заведения между собой.
6. Все выводы должны опираться только на контекст блока.
""".strip()


class MarketPlaceSummary(BaseModel):
    name: str = Field(description="Точное название заведения из входного контекста")
    summary: str = Field(description="Короткий аналитический вывод по заведению в 2-4 предложениях")


class MarketBlockAnalysis(BaseModel):
    overall_summary: str = Field(
        description="Общий аналитический вывод по блоку в 1-3 абзацах: закономерности, контрасты, ограничения данных"
    )
    place_summaries: list[MarketPlaceSummary] = Field(
        description="Выводы по всем заведениям из контекста, по одному объекту на заведение"
    )


def _strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def _get_chat_perplexity():
    try:
        from langchain_perplexity import ChatPerplexity
    except Exception:
        import warnings
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="The class `ChatPerplexity` was deprecated.*")
            from langchain_community.chat_models import ChatPerplexity
    return ChatPerplexity


def call_market_block_llm(
    *,
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    model: str,
) -> MarketBlockAnalysis:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_core.output_parsers import PydanticOutputParser

    parser = PydanticOutputParser(pydantic_object=MarketBlockAnalysis)
    ChatPerplexity = _get_chat_perplexity()
    llm = ChatPerplexity(
        api_key=api_key,
        model=model,
        temperature=0.15,
        max_tokens=4096,
    )
    response = llm.invoke([
        SystemMessage(content=MARKET_ANALYST_SYSTEM + "\n\n" + system_prompt + "\n\n" + parser.get_format_instructions()),
        HumanMessage(content=user_prompt),
    ])
    content = response.content if hasattr(response, "content") else str(response)
    content = _strip_thinking(content)
    return parser.parse(content)


def apply_block_analysis(
    *,
    place_names: list[str],
    analysis: MarketBlockAnalysis,
    per_place_setter: Callable[[str, str], None],
    fallback_per_place: dict[str, str],
    fallback_overall: str,
) -> str:
    summary_by_name = {
        str(item.name).strip().lower(): str(item.summary).strip()
        for item in analysis.place_summaries
        if str(item.name).strip()
    }

    for name in place_names:
        key = str(name).strip().lower()
        summary = summary_by_name.get(key) or fallback_per_place.get(name) or ""
        per_place_setter(name, summary)

    overall = str(analysis.overall_summary or "").strip()
    return overall or fallback_overall
