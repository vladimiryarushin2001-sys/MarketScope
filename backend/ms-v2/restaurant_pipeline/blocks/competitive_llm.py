"""
Единый helper для конкурентного анализа: один Perplexity-вызов на блок.
Возвращает краткие выводы по каждому заведению и подробный вывод по опорному.
"""
from __future__ import annotations

import re
from typing import Callable

from pydantic import BaseModel, Field


COMPETITIVE_ANALYST_SYSTEM = """
Ты — старший аналитик ресторанного рынка Москвы.
Ты готовишь конкурентный анализ для владельца ресторана.

ТВОЙ СТАНДАРТ:
- только факты из предоставленных данных;
- никакой внешней статистики и домыслов;
- русский язык без англицизмов;
- конкретика важнее общих фраз;
- сравнивай, а не перечисляй.

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Не выдумывай цифры, рейтинги и причины.
2. Для каждого заведения — короткий вывод (2-4 предложения).
3. Отдельно — подробный сравнительный вывод по опорному заведению клиента:
   его позиция в нише, ближайшие конкуренты, сильные и слабые стороны,
   что улучшить, с конкретикой и названиями.
4. Названия заведений в ответе должны в точности совпадать с контекстом.
""".strip()


class CompetitivePlaceSummary(BaseModel):
    name: str = Field(description="Точное название заведения из контекста")
    summary: str = Field(description="Краткий аналитический вывод 2-4 предложения")


class CompetitiveBlockAnalysis(BaseModel):
    place_summaries: list[CompetitivePlaceSummary] = Field(
        description="Выводы по всем заведениям из контекста"
    )
    reference_place_summary: str = Field(
        description="Подробный сравнительный вывод по опорному заведению: позиция в нише, "
        "сравнение с конкурентами, сильные и слабые стороны, 2-3 абзаца"
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


def call_competitive_block_llm(
    *,
    system_prompt: str,
    user_prompt: str,
    api_key: str,
    model: str,
) -> CompetitiveBlockAnalysis:
    from langchain_core.messages import HumanMessage, SystemMessage
    from langchain_core.output_parsers import PydanticOutputParser

    parser = PydanticOutputParser(pydantic_object=CompetitiveBlockAnalysis)
    ChatPerplexity = _get_chat_perplexity()
    llm = ChatPerplexity(
        api_key=api_key,
        model=model,
        temperature=0.15,
        max_tokens=4096,
    )
    response = llm.invoke([
        SystemMessage(
            content=COMPETITIVE_ANALYST_SYSTEM + "\n\n" + system_prompt + "\n\n" + parser.get_format_instructions()
        ),
        HumanMessage(content=user_prompt),
    ])
    content = response.content if hasattr(response, "content") else str(response)
    content = _strip_thinking(content)
    return parser.parse(content)


def apply_competitive_block_analysis(
    *,
    place_names: list[str],
    ref_name: str,
    analysis: CompetitiveBlockAnalysis,
    per_place_setter: Callable[[str, str], None],
    fallback_per_place: dict[str, str],
    fallback_ref_summary: str,
) -> str:
    """
    Раскладывает LLM-ответ по заведениям и возвращает reference_place_summary.
    """
    summary_by_name = {
        str(item.name).strip().lower(): str(item.summary).strip()
        for item in analysis.place_summaries
        if str(item.name).strip()
    }

    for name in place_names:
        key = str(name).strip().lower()
        summary = summary_by_name.get(key) or fallback_per_place.get(name) or ""
        per_place_setter(name, summary)

    ref_summary = str(analysis.reference_place_summary or "").strip()
    return ref_summary or fallback_ref_summary


def call_per_place_analysis(
    *,
    place_name: str,
    place_context: str,
    system_prompt: str,
    user_template: str,
    api_key: str,
    model: str,
) -> str:
    """Один LLM-вызов для анализа одного заведения."""
    from langchain_core.messages import HumanMessage, SystemMessage

    ChatPerplexity = _get_chat_perplexity()
    user = user_template.format(place_name=place_name, place_context=place_context)
    llm = ChatPerplexity(api_key=api_key, model=model, temperature=0.15, max_tokens=1024)
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user),
    ])
    content = response.content if hasattr(response, "content") else str(response)
    return _strip_thinking(content).strip()


def call_comparison(
    *,
    analyses_by_name: dict[str, str],
    ref_name: str,
    system_prompt: str,
    user_template: str,
    api_key: str,
    model: str,
) -> str:
    """Сравнительный вывод: преимущества и недостатки опорного vs конкуренты."""
    from langchain_core.messages import HumanMessage, SystemMessage

    blocks = []
    for name, analysis in analyses_by_name.items():
        tag = " [ОПОРНОЕ]" if str(name).strip().lower() == str(ref_name).strip().lower() else ""
        blocks.append(f"--- {name}{tag} ---\n{analysis}")
    analyses_context = "\n\n".join(blocks)
    user = user_template.format(ref_name=ref_name, analyses_context=analyses_context)

    ChatPerplexity = _get_chat_perplexity()
    llm = ChatPerplexity(api_key=api_key, model=model, temperature=0.15, max_tokens=2048)
    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user),
    ])
    content = response.content if hasattr(response, "content") else str(response)
    return _strip_thinking(content).strip()


def apply_competitive_per_place_then_compare(
    *,
    place_names: list[str],
    build_single_place_context: Callable[[str], str],
    ref_name: str,
    per_place_system: str,
    per_place_user_template: str,
    comparison_system: str,
    comparison_user_template: str,
    api_key: str,
    model: str,
    per_place_setter: Callable[[str, str], None],
    fallback_per_place: dict[str, str],
    fallback_ref_summary: str,
) -> str:
    """
    Двухэтапный анализ: per-place LLM по каждому заведению, затем сравнительный вывод.
    """
    if not api_key or not place_names or not ref_name:
        if not api_key:
            print("[competitive_llm] Пропуск LLM: api_key пустой", flush=True)
        for name, summary in fallback_per_place.items():
            per_place_setter(name, summary)
        return fallback_ref_summary

    analyses: dict[str, str] = {}
    for name in place_names:
        ctx = build_single_place_context(name)
        try:
            analysis = call_per_place_analysis(
                place_name=name,
                place_context=ctx or "Данные отсутствуют.",
                system_prompt=per_place_system,
                user_template=per_place_user_template,
                api_key=api_key,
                model=model,
            )
            analyses[name] = analysis
            per_place_setter(name, analysis)
        except Exception as e:
            print(f"[competitive_llm] Per-place ошибка для «{name}»: {e}", flush=True)
            fallback = fallback_per_place.get(name, str(e))
            analyses[name] = fallback
            per_place_setter(name, fallback)

    try:
        return call_comparison(
            analyses_by_name=analyses,
            ref_name=ref_name,
            system_prompt=comparison_system,
            user_template=comparison_user_template,
            api_key=api_key,
            model=model,
        )
    except Exception as e:
        print(f"[competitive_llm] Ошибка сравнения: {e}", flush=True)
        return fallback_ref_summary
