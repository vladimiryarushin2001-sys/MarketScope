"""Режим «Обзор рынка» — сбор готовых выводов блоков 1-5."""
from __future__ import annotations


def _render_named_lines(items: list[tuple[str, str]]) -> str:
    lines = []
    for name, conclusion in items:
        if not conclusion:
            continue
        lines.append(f"### {name}\n{conclusion}")
    return "\n\n".join(lines)


def _section_from_list(overall: str, items: list[dict], name_key: str = "название") -> str:
    per_place = _render_named_lines([
        (str(item.get(name_key) or "?"), str(item.get("вывод") or ""))
        for item in items
    ])
    if per_place:
        return f"{overall}\n\n{per_place}"
    return overall


def _section_from_mapping(overall: str, mapping: dict[str, dict]) -> str:
    per_place = _render_named_lines([
        (name, str(data.get("вывод") or ""))
        for name, data in mapping.items()
    ])
    if per_place:
        return f"{overall}\n\n{per_place}"
    return overall


def generate_market_sections(
    b1: dict, b2: dict, b3: dict, b4: dict, b5: dict,
    query: str, api_key: str,
) -> dict[str, str]:
    del query, api_key

    print("  [1/7] Анализ рынка…", flush=True)
    market_section = _section_from_list(
        str(b1.get("общий_вывод") or ""),
        b1.get("selected_places") or [],
    )
    print(f"    done ({len(market_section)} симв.)\n")

    print("  [2/7] Анализ меню…", flush=True)
    menu_section = _section_from_mapping(
        str(b2.get("общий_вывод") or ""),
        b2.get("menu_by_place") or {},
    )
    print(f"    done ({len(menu_section)} симв.)\n")

    print("  [3/7] Анализ отзывов…", flush=True)
    reviews_section = _section_from_list(
        str(b3.get("общий_вывод") or ""),
        b3.get("summaries") or [],
        name_key="заведение",
    )
    print(f"    done ({len(reviews_section)} симв.)\n")

    print("  [4/7] Анализ маркетинга…", flush=True)
    marketing_section = _section_from_mapping(
        str(b4.get("общий_вывод") or ""),
        b4.get("marketing_by_place") or {},
    )
    print(f"    done ({len(marketing_section)} симв.)\n")

    print("  [5/7] Анализ сайтов…", flush=True)
    tech_section = _section_from_mapping(
        str(b5.get("общий_вывод") or ""),
        b5.get("tech_by_place") or {},
    )
    print(f"    done ({len(tech_section)} симв.)\n")

    return {
        "анализ рынка": market_section,
        "анализ меню": menu_section,
        "анализ отзывов": reviews_section,
        "анализ маркетинга": marketing_section,
        "анализ сайтов": tech_section,
    }
