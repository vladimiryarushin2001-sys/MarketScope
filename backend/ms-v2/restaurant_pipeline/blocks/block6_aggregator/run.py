"""
Block 6 — Аналитический отчёт.

Три режима:
  --mode market       Обзор рынка (сквозной тематический анализ)
  --mode competitors  Обзор конкурентов (карточки заведений)
  --mode competitive  Конкурентный анализ (опорное заведение vs конкуренты)

Общие для всех режимов:
  • Рекомендации по нише (LLM-синтез)
  • Справочная информация (программная генерация)
"""
from __future__ import annotations

import json
import os
import re
import textwrap
from pathlib import Path


# ══════════════════════════════════════════════════════════════════════
#  Общие константы
# ══════════════════════════════════════════════════════════════════════

_DEFAULT_MODEL = "sonar"

_SYSTEM_PROMPT = textwrap.dedent("""\
    Ты — аналитик ресторанного рынка. Пишешь отчёт для человека,
    который не любит сухие таблицы, но ценит конкретику.

    ЖЕЛЕЗНОЕ ПРАВИЛО:
    Работай ТОЛЬКО с данными из контекста. Запрещено:
    — привлекать внешние знания и статистику,
    — придумывать проценты, прогнозы, оценки вроде «потеря 30% трафика»,
    — выдавать предположения за факты.
    Если для вывода не хватает данных — честно это скажи.

    СТИЛЬ:
    — Чистый, понятный русский язык. Никаких англицизмов:
      не «experiential», а «запоминающийся опыт»;
      не «LTV», а «повторные визиты»;
      не «outlier», а «исключение»;
      не «digital-присутствие», а «присутствие в интернете».
    — Короткие абзацы (3–5 предложений). Не сливай всё в стену текста.
    — Не злоупотребляй шаблонами «это означает…», «это сигнал о…».
      Формулируй выводы естественно, как рассказал бы коллеге.
    — Называй конкретные заведения и цифры из данных,
      но не перечисляй всё подряд — выбирай самое показательное.
    — Пиши грамотно, проверяй орфографию.
""")

_META_CATEGORIES = {
    "Закуски / холодное": ["закус", "snack", "холодн", "начал", "тартар", "строганин"],
    "Салаты": ["салат", "salad"],
    "Супы": ["суп", "soup", "first", "щи", "борщ", "уха", "солянк", "бульон", "первы"],
    "Горячее / основные": ["горяч", "hot", "основн", "main", "мяс", "рыб", "птиц",
                            "гриль", "grill", "стейк", "шашлык", "котлет"],
    "Гарниры": ["гарнир", "side"],
    "Выпечка / хлеб": ["выпечк", "хлеб", "bread", "пирож", "пирог", "расстегай", "блин"],
    "Десерты": ["десерт", "dessert", "сладк", "торт", "мороженое", "пломбир"],
    "Безалкогольные напитки": ["чай", "tea", "кофе", "coffee", "сок", "лимонад",
                               "морс", "безалкогол", "вода", "water", "какао"],
    "Алкоголь": ["вин", "wine", "водк", "vodka", "виск", "whisk", "джин", "gin",
                  "ром", "rum", "коктейл", "cocktail", "пив", "beer", "настойк",
                  "ликёр", "liqueur", "аперитив", "дистиллят", "текила", "шампанск",
                  "бренди", "cognac", "коньяк", "граппа", "наливк", "самогон"],
}

_NETWORK_LABELS = {
    "telegram": "Telegram",
    "vk": "ВКонтакте",
    "instagram": "Instagram",
    "facebook": "Facebook",
    "youtube": "YouTube",
    "dzen": "Дзен",
}


# ══════════════════════════════════════════════════════════════════════
#  Утилиты
# ══════════════════════════════════════════════════════════════════════

def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _read_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


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


def _call_llm(
    system: str,
    user: str,
    api_key: str,
    model: str = _DEFAULT_MODEL,
) -> str:
    from langchain_core.messages import SystemMessage, HumanMessage

    ChatPerplexity = _get_chat_perplexity()
    llm = ChatPerplexity(
        api_key=api_key,
        model=model,
        temperature=0.35,
        max_tokens=4096,
    )
    response = llm.invoke([
        SystemMessage(content=system),
        HumanMessage(content=user),
    ])
    content = response.content if hasattr(response, "content") else str(response)
    return _strip_thinking(content).strip()


def _classify_category(cat_name: str) -> str:
    low = cat_name.lower()
    for meta, keywords in _META_CATEGORIES.items():
        if any(kw in low for kw in keywords):
            return meta
    return "Прочее"


# ══════════════════════════════════════════════════════════════════════
#  Рекомендации по нише (общее для обоих режимов)
# ══════════════════════════════════════════════════════════════════════

_PROMPT_RECOMMENDATIONS = textwrap.dedent("""\
    Запрос пользователя: «{query}»

    Ниже — аналитические разделы, подготовленные на основе
    данных о заведениях этой ниши.

    {analysis_text}

    ═══════════════════════════════════════

    Представь, что к тебе пришёл предприниматель, который хочет
    ОТКРЫТЬ НОВЫЙ РЕСТОРАН в этой нише. На основе проведённого
    анализа конкурентов, сформулируй для него рекомендации.

    Структура:

    1) ВХОД В НИШУ — ПОЗИЦИОНИРОВАНИЕ
       Какой ценовой сегмент и формат наиболее перспективны?
       Где есть незанятые зоны, в которых можно закрепиться?

    2) ЧТО ВЗЯТЬ У ЛИДЕРОВ
       Какие практики конкурентов стоит перенять? Что делает
       успешные заведения этой ниши успешными — по данным анализа?

    3) СЛАБЫЕ МЕСТА КОНКУРЕНТОВ — ТОЧКИ ВХОДА
       Какие системные проблемы ниши можно превратить
       в своё конкурентное преимущество?

    4) MUST-HAVE ПРИ ЗАПУСКЕ
       Что обязательно нужно иметь с первого дня: присутствие в интернете,
       меню, программа лояльности, техническая база сайта —
       исходя из стандартов ниши и ошибок конкурентов.

    ПРАВИЛА:
    — Каждая рекомендация опирается на факты из анализов выше.
    — Не повторяй анализ — давай конкретные действия.
    — Не выдумывай проценты и прогнозы, которых нет в данных.
    — Каждый пункт — с подзаголовком (###), короткими абзацами.
    — Объём: 6–8 абзацев.
""")


def _generate_section_recommendations(
    sections: dict[str, str], query: str, api_key: str,
) -> str:
    analysis_parts = []
    for key in ("анализ рынка", "анализ меню", "анализ отзывов",
                "анализ маркетинга", "анализ сайтов", "карточки конкурентов"):
        text = sections.get(key)
        if text:
            analysis_parts.append(f"── {key.capitalize()} ──\n{text}")

    analysis_text = "\n\n".join(analysis_parts) or "Данные отсутствуют"
    prompt = _PROMPT_RECOMMENDATIONS.format(query=query, analysis_text=analysis_text)
    return _call_llm(_SYSTEM_PROMPT, prompt, api_key)


# ══════════════════════════════════════════════════════════════════════
#  Справочная информация (общее для обоих режимов)
# ══════════════════════════════════════════════════════════════════════

def _build_reference_section(b1: dict, b4: dict) -> str:
    places = b1.get("selected_places", [])
    marketing = b4.get("marketing_by_place", {})
    lines = []
    for p in places:
        name = p.get("название", "?")
        site = p.get("сайт")
        hours = p.get("время_работы")
        address = p.get("адрес")
        mk = marketing.get(name, {})
        socials = mk.get("соцсети", [])
        block = [f"### {name}"]
        if address:
            block.append(f"- **Адрес:** {address}")
        if site:
            block.append(f"- **Сайт:** [{site}]({site})")
        if hours:
            block.append(f"- **Режим работы:** {hours}")
        if socials:
            links = []
            for s in socials:
                net = s.get("network", "")
                url = s.get("url", "")
                label = _NETWORK_LABELS.get(net, net)
                links.append(f"[{label}]({url})")
            block.append(f"- **Соцсети:** {' · '.join(links)}")
        else:
            block.append("- **Соцсети:** не найдены")
        lines.append("\n".join(block))
    return "\n\n".join(lines)


# ══════════════════════════════════════════════════════════════════════
#  Запись отчёта
# ══════════════════════════════════════════════════════════════════════

_MARKET_SECTION_TITLES = [
    "АНАЛИЗ РЫНКА",
    "АНАЛИЗ МЕНЮ",
    "АНАЛИЗ ОТЗЫВОВ",
    "АНАЛИЗ МАРКЕТИНГА",
    "АНАЛИЗ САЙТОВ",
    "РЕКОМЕНДАЦИИ ПО НИШЕ",
    "СПРАВОЧНАЯ ИНФОРМАЦИЯ",
]

_COMPETITORS_SECTION_TITLES = [
    "КАРТОЧКИ КОНКУРЕНТОВ",
    "РЕКОМЕНДАЦИИ ПО НИШЕ",
    "СПРАВОЧНАЯ ИНФОРМАЦИЯ",
]

_COMPETITIVE_SECTION_TITLES = [
    "ПОЗИЦИОНИРОВАНИЕ",
    "МЕНЮ",
    "ОТЗЫВЫ",
    "МАРКЕТИНГ",
    "ТЕХНИЧЕСКАЯ ЧАСТЬ",
    "БИЗНЕС-РЕКОМЕНДАЦИИ",
    "СПРАВОЧНАЯ ИНФОРМАЦИЯ",
]


def _write_md_report(
    sections: dict[str, str],
    query: str,
    path: Path,
    mode: str,
) -> None:
    if mode == "competitive":
        titles = _COMPETITIVE_SECTION_TITLES
    elif mode == "market":
        titles = _MARKET_SECTION_TITLES
    else:
        titles = _COMPETITORS_SECTION_TITLES

    mode_labels = {
        "market": "Обзор рынка",
        "competitors": "Обзор конкурентов",
        "competitive": "Конкурентный анализ",
    }
    mode_label = mode_labels.get(mode, mode)

    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# Аналитический отчёт — {mode_label}\n\n")
        f.write(f"**Запрос:** {query}\n\n---\n\n")
        for i, title in enumerate(titles, 1):
            key = title.lower()
            text = sections.get(key, "")
            if not text:
                continue
            f.write(f"## {i}. {title}\n\n")
            f.write(text + "\n\n---\n\n")


# ══════════════════════════════════════════════════════════════════════
#  Точка входа
# ══════════════════════════════════════════════════════════════════════

def run(
    block1_path: str,
    block2_path: str,
    block3_path: str,
    block4_path: str,
    block5_path: str,
    output_json_path: str,
    mode: str = "market",
) -> dict:
    root = _project_root()

    try:
        from dotenv import load_dotenv
        load_dotenv(root / ".env")
    except Exception:
        pass

    api_key = os.environ.get("PPLX_API_KEY", "")
    b1 = _read_json(block1_path)
    b2 = _read_json(block2_path)
    b3 = _read_json(block3_path)
    b4 = _read_json(block4_path)
    b5 = _read_json(block5_path)

    query = b1.get("query_context", "") or b1.get("общий_вывод", "") or b1.get("free_form_text", "") or b1.get("mode", "")
    sections: dict[str, str] = {}

    mode_labels = {
        "market": "обзор рынка",
        "competitors": "обзор конкурентов",
        "competitive": "конкурентный анализ",
    }
    mode_label = mode_labels.get(mode, mode)

    print(f"[block6] Генерация отчёта ({mode_label})…\n")

    if mode == "market":
        try:
            from .report_market import generate_market_sections
        except ImportError:
            from report_market import generate_market_sections
        sections.update(
            generate_market_sections(b1, b2, b3, b4, b5, query, api_key)
        )
    elif mode == "competitive":
        try:
            from .report_competitive import generate_competitive_sections
        except ImportError:
            from report_competitive import generate_competitive_sections
        sections.update(
            generate_competitive_sections(b1, b2, b3, b4, b5, query, api_key)
        )
    elif api_key:
        try:
            from .report_competitors import generate_competitor_sections
        except ImportError:
            from report_competitors import generate_competitor_sections
        sections.update(
            generate_competitor_sections(b1, b2, b3, b4, b5, query, api_key)
        )
    else:
        print(f"[block6] Нет PPLX_API_KEY — LLM-генерация недоступна")

    if mode != "competitive":
        step_map = {"market": (6, 7), "competitors": (2, 3)}
        n, total = step_map.get(mode, (2, 3))
        print(f"  [{n}/{total}] Рекомендации по нише…", flush=True)
        if api_key:
            sections["рекомендации по нише"] = _generate_section_recommendations(
                sections, query, api_key,
            )
            print(f"    done ({len(sections['рекомендации по нише'])} симв.)\n")
        else:
            sections["рекомендации по нише"] = "Не сгенерировано (нет API-ключа)."
            print("    пропущено\n")

    step_map_ref = {"market": (7, 7), "competitive": (7, 7), "competitors": (3, 3)}
    n_ref, total_ref = step_map_ref.get(mode, (3, 3))
    print(f"  [{n_ref}/{total_ref}] Справочная информация…", flush=True)
    sections["справочная информация"] = _build_reference_section(b1, b4)
    print(f"    done\n")

    md_path = Path(output_json_path).with_suffix(".md")
    _write_md_report(sections, query, md_path, mode)
    print(f"[block6] Отчёт: {md_path}")

    payload = {
        "block": "block6_aggregator",
        "mode": mode,
        "input_sources": {
            "block1": block1_path,
            "block2": block2_path,
            "block3": block3_path,
            "block4": block4_path,
            "block5": block5_path,
        },
        "report_md": str(md_path),
        "sections": sections,
    }

    Path(output_json_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    return payload


if __name__ == "__main__":
    import argparse
    import sys

    # allow `python run.py` without package context
    _this_dir = Path(__file__).resolve().parent
    if str(_this_dir) not in sys.path:
        sys.path.insert(0, str(_this_dir))

    parser = argparse.ArgumentParser()
    parser.add_argument("--block1", required=True)
    parser.add_argument("--block2", required=True)
    parser.add_argument("--block3", required=True)
    parser.add_argument("--block4", required=True)
    parser.add_argument("--block5", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", choices=["market", "competitors", "competitive"], default="market",
                        help="Режим отчёта: market | competitors | competitive")
    args = parser.parse_args()
    run(args.block1, args.block2, args.block3, args.block4, args.block5, args.output, args.mode)
