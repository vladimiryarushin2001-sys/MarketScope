"""
Режим «Конкурентный анализ» — опорное заведение vs конкуренты.

6 секций отчёта:
  1–5. Собираются из готовых выводов блоков (вывод по заведениям + вывод_по_опорному)
  6. Бизнес-рекомендации — единственный LLM-вызов, генерирует пошаговый план действий
"""
from __future__ import annotations


# ══════════════════════════════════════════════════════════════════════
#  Вспомогательные функции для извлечения данных
# ══════════════════════════════════════════════════════════════════════

def _get_place_order_and_ref(b1: dict) -> tuple[list[tuple[str, bool]], str]:
    """
    Возвращает список (имя, is_reference) в порядке: опорное первым, затем конкуренты.
    + имя опорного заведения.
    """
    places = b1.get("selected_places", [])
    ref_name = ""
    ordered: list[tuple[str, bool]] = []
    ref_first: list[tuple[str, bool]] = []
    comps: list[tuple[str, bool]] = []
    for p in places:
        name = p.get("название") or "?"
        is_ref = bool(p.get("is_reference_place"))
        if is_ref:
            ref_name = name
            ref_first.append((name, True))
        else:
            comps.append((name, False))
    ordered = ref_first + comps
    if not ref_name and places:
        # fallback: первый — опорное
        ref_name = places[0].get("название") or "?"
        ordered = [(ref_name, True)] + [(p.get("название") or "?", False) for p in places[1:]]
    return ordered, ref_name


def _build_section_from_block(
    place_order: list[tuple[str, bool]],
    by_place: dict[str, str],
    ref_summary: str,
) -> str:
    """
    Собирает секцию: краткие карточки по заведениям + подробный вывод по опорному.
    """
    lines = ["### Краткие выводы по заведениям", ""]
    for name, is_ref in place_order:
        suffix = " (опорное)" if is_ref else ""
        txt = by_place.get(name, "—")
        lines.append(f"**{name}**{suffix}: {txt}")
        lines.append("")
    lines.append("### Подробный вывод по опорному заведению")
    lines.append("")
    lines.append(ref_summary or "—")
    return "\n".join(lines).strip()


# ══════════════════════════════════════════════════════════════════════
#  Основная функция генерации
# ══════════════════════════════════════════════════════════════════════

def generate_competitive_sections(
    b1: dict, b2: dict, b3: dict, b4: dict, b5: dict,
    query: str, api_key: str,
) -> dict[str, str]:
    try:
        from .run import _call_llm
        from . import prompts_competitive as P
    except ImportError:
        from run import _call_llm
        import prompts_competitive as P

    place_order, ref_name = _get_place_order_and_ref(b1)
    sections: dict[str, str] = {}

    # ── 1. Позиционирование (сборка из block1) ──
    print(f"  [1/6] Позиционирование…", flush=True)
    by_place_b1: dict[str, str] = {}
    for p in b1.get("selected_places", []):
        name = p.get("название") or "?"
        by_place_b1[name] = p.get("вывод", "—")
    sections["позиционирование"] = _build_section_from_block(
        place_order,
        by_place_b1,
        b1.get("вывод_по_опорному", ""),
    )
    print(f"    done ({len(sections['позиционирование'])} симв.)", flush=True)

    # ── 2. Меню (сборка из block2) ──
    print(f"  [2/6] Меню…", flush=True)
    by_place_b2 = {k: v.get("вывод", "—") for k, v in b2.get("menu_by_place", {}).items()}
    sections["меню"] = _build_section_from_block(
        place_order,
        by_place_b2,
        b2.get("вывод_по_опорному", ""),
    )
    print(f"    done ({len(sections['меню'])} симв.)", flush=True)

    # ── 3. Отзывы (сборка из block3) ──
    print(f"  [3/6] Отзывы…", flush=True)
    by_place_b3 = {s.get("заведение", "?"): s.get("вывод", "—") for s in b3.get("summaries", [])}
    sections["отзывы"] = _build_section_from_block(
        place_order,
        by_place_b3,
        b3.get("вывод_по_опорному", ""),
    )
    print(f"    done ({len(sections['отзывы'])} симв.)", flush=True)

    # ── 4. Маркетинг (сборка из block4) ──
    print(f"  [4/6] Маркетинг…", flush=True)
    by_place_b4 = {k: v.get("вывод", "—") for k, v in b4.get("marketing_by_place", {}).items()}
    sections["маркетинг"] = _build_section_from_block(
        place_order,
        by_place_b4,
        b4.get("вывод_по_опорному", ""),
    )
    print(f"    done ({len(sections['маркетинг'])} симв.)", flush=True)

    # ── 5. Техническая часть (сборка из block5) ──
    print(f"  [5/6] Техническая часть…", flush=True)
    by_place_b5 = {k: v.get("вывод", "—") for k, v in b5.get("tech_by_place", {}).items()}
    sections["техническая часть"] = _build_section_from_block(
        place_order,
        by_place_b5,
        b5.get("вывод_по_опорному", ""),
    )
    print(f"    done ({len(sections['техническая часть'])} симв.)", flush=True)

    # ── 6. Бизнес-рекомендации (единственный LLM-вызов) ──
    print(f"  [6/6] Бизнес-рекомендации…", flush=True)
    if api_key:
        prompt = P.RECOMMENDATIONS.format(
            ref_name=ref_name,
            section_positioning=sections.get("позиционирование", "данных нет"),
            section_menu=sections.get("меню", "данных нет"),
            section_reviews=sections.get("отзывы", "данных нет"),
            section_marketing=sections.get("маркетинг", "данных нет"),
            section_tech=sections.get("техническая часть", "данных нет"),
        )
        sections["бизнес-рекомендации"] = _call_llm(P.SYSTEM, prompt, api_key)
        print(f"    done ({len(sections['бизнес-рекомендации'])} симв.)", flush=True)
    else:
        sections["бизнес-рекомендации"] = "Не сгенерировано (нет API-ключа)."
        print("    пропущено", flush=True)

    return sections
