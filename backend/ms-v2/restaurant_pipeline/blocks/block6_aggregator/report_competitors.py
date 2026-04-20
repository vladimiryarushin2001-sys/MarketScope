"""Режим «Обзор конкурентов» — структурированные карточки заведений + аналитический комментарий."""
from __future__ import annotations

import re
import textwrap


def generate_competitor_sections(
    b1: dict, b2: dict, b3: dict, b4: dict, b5: dict,
    query: str, api_key: str,
) -> dict[str, str]:
    try:
        from .run import (
            _SYSTEM_PROMPT, _call_llm, _classify_category, _META_CATEGORIES,
            _NETWORK_LABELS,
        )
    except ImportError:
        from run import (
            _SYSTEM_PROMPT, _call_llm, _classify_category, _META_CATEGORIES,
            _NETWORK_LABELS,
        )

    places = b1.get("selected_places", [])
    menu_data = b2.get("menu_by_place", {})
    summaries = {s.get("заведение"): s for s in b3.get("summaries", [])}
    marketing = b4.get("marketing_by_place", {})
    tech = b5.get("tech_by_place", {})

    cards_md: list[str] = []
    cards_plain: list[str] = []

    print(f"  Построение карточек ({len(places)} заведений)…", flush=True)

    for idx, p in enumerate(places, 1):
        name = p.get("название", "?")
        card_md, card_plain = _build_card(
            name, p, menu_data, summaries, marketing, tech,
            _classify_category, _META_CATEGORIES, _NETWORK_LABELS,
        )
        cards_md.append(f"## {idx}. {name}\n\n{card_md}")
        cards_plain.append(f"[{idx}] {name}\n{card_plain}")

    print(f"    done ({len(cards_md)} карточек)\n")

    comments_by_name: dict[str, str] = {}
    if api_key:
        print("  LLM: аналитические комментарии…", flush=True)
        combined_plain = "\n\n".join(cards_plain)
        raw = _call_llm(
            _SYSTEM_PROMPT,
            _PROMPT_COMMENTS.format(query=query, cards=combined_plain),
            api_key,
        )
        comments_by_name = _parse_comments(raw, [p.get("название", "?") for p in places])
        print(f"    done ({len(raw)} симв.)\n")

    for idx, p in enumerate(places):
        name = p.get("название", "?")
        comment = comments_by_name.get(name, "")
        if comment:
            cards_md[idx] += f"\n### Аналитический комментарий\n\n{comment}\n"

    body = "\n\n".join(cards_md)
    return {"карточки конкурентов": body}


# ── Промпт для аналитических комментариев ────────────────────────────

_PROMPT_COMMENTS = textwrap.dedent("""\
    Запрос пользователя: «{query}»

    Ниже — структурированные карточки конкурентов с данными
    о позиционировании, меню, отзывах, маркетинге и сайте.

    Твоя задача — написать по каждому заведению развёрнутый
    аналитический комментарий (5–8 предложений, 2–3 абзаца).

    ЧТО ДОЛЖНО БЫТЬ В КОММЕНТАРИИ:

    1) ПОЗИЦИЯ НА РЫНКЕ
       Какое место занимает заведение среди конкурентов?
       Сравни чек, кухню, формат с остальными из списка.
       Есть ли у него уникальная ниша или оно «одно из многих»?

    2) СИЛЬНЫЕ СТОРОНЫ
       Что объективно выделяет: высокий рейтинг, широкое меню,
       активные соцсети, быстрый сайт, наличие программы лояльности?
       Опирайся на конкретные цифры из карточки.

    3) СЛАБЫЕ СТОРОНЫ И РИСКИ
       Что может мешать: отсутствие сайта или соцсетей,
       низкий рейтинг, жалобы в отзывах, узкое меню,
       отсутствие детского меню при семейном позиционировании?

    4) ОБЩЕЕ ВПЕЧАТЛЕНИЕ
       Одно-два предложения: если бы ты рекомендовал или не
       рекомендовал обратить внимание на это заведение как
       на конкурента — почему?

    ФОРМАТ ОТВЕТА — строго:
    [Название заведения]
    Текст комментария…

    [Следующее заведение]
    Текст комментария…

    ПРАВИЛА:
    — Работай ТОЛЬКО с фактами из карточек. Не выдумывай данные,
      не привлекай внешние знания, не придумывай проценты и прогнозы.
    — Называй конкретные цифры: рейтинг, количество позиций,
      средний чек, скорость загрузки сайта — всё, что есть в карточке.
    — Не пересказывай карточку — анализируй, сопоставляй, делай выводы.
    — Сравнивай заведения между собой: «самый дорогой в выборке»,
      «единственное с детским меню», «наименьшее количество соцсетей».
    — Пиши на чистом русском без англицизмов.
    — Если данных по какому-то аспекту нет — честно это отметь,
      но не выдумывай информацию.

    КАРТОЧКИ:
    {cards}
""")


# ── Парсинг ответа LLM ──────────────────────────────────────────────

def _parse_comments(raw: str, names: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    pattern = re.compile(r"^\[(.+?)\]\s*$", re.MULTILINE)
    parts = pattern.split(raw)
    # parts: [prefix, name1, text1, name2, text2, ...]
    i = 1
    while i + 1 < len(parts):
        heading = parts[i].strip()
        body = parts[i + 1].strip()
        matched = _fuzzy_match(heading, names)
        if matched:
            result[matched] = body
        i += 2
    return result


def _fuzzy_match(heading: str, names: list[str]) -> str | None:
    hl = heading.lower().strip()
    for n in names:
        if n.lower() in hl or hl in n.lower():
            return n
    return None


# ── Построение одной карточки ────────────────────────────────────────

def _build_card(
    name: str,
    place: dict,
    menu_data: dict,
    summaries: dict,
    marketing: dict,
    tech: dict,
    classify_fn,
    meta_cats: dict,
    network_labels: dict,
) -> tuple[str, str]:
    """Возвращает (markdown, plain_text) для одного заведения."""
    md_parts: list[str] = []
    plain_parts: list[str] = []

    # ── Позиционирование ──
    cuisine = place.get("кухня", "?")
    check = place.get("средний_чек")
    check_str = f"{check:.0f}₽" if check and check == check else "н/д"
    address = place.get("адрес", "?")
    hours = place.get("время_работы", "?")
    etype = place.get("тип_заведения", "?")
    delivery = {True: "да", False: "нет"}.get(place.get("доставка"), "н/д")
    desc = place.get("описание", "—")

    md_parts.append(
        f"### Позиционирование\n"
        f"- **Тип:** {etype}\n"
        f"- **Кухня:** {cuisine}\n"
        f"- **Средний чек:** {check_str}\n"
        f"- **Адрес:** {address}\n"
        f"- **Режим работы:** {hours}\n"
        f"- **Доставка:** {delivery}\n"
        f"- **Описание:** {desc}"
    )
    plain_parts.append(
        f"Позиционирование: {etype}, кухня {cuisine}, чек {check_str}, "
        f"адрес {address}, режим {hours}, доставка {delivery}"
    )

    # ── Меню ──
    m = menu_data.get(name, {})
    items = m.get("items", [])
    cats = m.get("categories", [])
    kids = m.get("has_kids_menu", False)

    if items:
        by_meta: dict[str, list[float]] = {}
        for it in items:
            price = it.get("price")
            if not price or price != price:
                continue
            raw_cat = it.get("category") or "Прочее"
            meta = classify_fn(raw_cat)
            by_meta.setdefault(meta, []).append(price)

        menu_lines_md = [
            f"### Меню\n"
            f"- **Позиций:** {len(items)} | **Категорий:** {len(cats)} | "
            f"**Детское меню:** {'да' if kids else 'нет'}",
        ]
        menu_lines_plain = [
            f"Меню: {len(items)} поз., {len(cats)} кат., детское: {'да' if kids else 'нет'}"
        ]

        for meta_name in list(meta_cats.keys()) + ["Прочее"]:
            prices = by_meta.get(meta_name)
            if not prices:
                continue
            avg = round(sum(prices) / len(prices))
            mn = round(min(prices))
            mx = round(max(prices))
            menu_lines_md.append(
                f"- {meta_name}: {len(prices)} поз., {mn}–{mx}₽, средняя {avg}₽"
            )
            menu_lines_plain.append(
                f"  {meta_name}: {len(prices)} поз., {mn}-{mx}р, ср. {avg}р"
            )

        md_parts.append("\n".join(menu_lines_md))
        plain_parts.append("\n".join(menu_lines_plain))
    else:
        md_parts.append("### Меню\n\nДанные о меню отсутствуют.")
        plain_parts.append("Меню: данных нет")

    # ── Отзывы ──
    s = summaries.get(name, {})
    review_count = s.get("количество_отзывов", 0)
    if review_count > 0:
        general = s.get("общая_информация", "")
        pos = s.get("положительное", [])
        neg = s.get("отрицательное", [])
        rating_match = re.search(r"(\d[.,]\d{1,2})", general)
        rating_str = rating_match.group(1).replace(",", ".") if rating_match else "?"

        rev_md = [f"### Отзывы\n- **Рейтинг:** {rating_str} | **Отзывов:** {review_count}"]
        rev_plain = [f"Отзывы: рейтинг {rating_str}, кол-во {review_count}"]

        if isinstance(pos, list) and pos:
            rev_md.append("- **Хвалят:** " + "; ".join(pos[:5]))
            rev_plain.append("  Хвалят: " + "; ".join(pos[:5]))
        if isinstance(neg, list) and neg:
            rev_md.append("- **Критикуют:** " + "; ".join(neg[:5]))
            rev_plain.append("  Критикуют: " + "; ".join(neg[:5]))

        md_parts.append("\n".join(rev_md))
        plain_parts.append("\n".join(rev_plain))
    else:
        md_parts.append("### Отзывы\n\nДанных об отзывах нет.")
        plain_parts.append("Отзывы: данных нет")

    # ── Маркетинг ──
    mk = marketing.get(name, {})
    socials = mk.get("соцсети", [])
    loyalty = mk.get("программа_лояльности", {})
    has_loy = loyalty.get("has_loyalty", False)

    if socials:
        links = []
        net_names = []
        for sc in socials:
            net = sc.get("network", "")
            url = sc.get("url", "")
            label = network_labels.get(net, net)
            links.append(f"[{label}]({url})")
            net_names.append(label)
        mk_md = f"### Маркетинг\n- **Соцсети:** {' · '.join(links)}"
        mk_plain = f"Маркетинг: соцсети — {', '.join(net_names)}"
    else:
        mk_md = "### Маркетинг\n- **Соцсети:** не найдены"
        mk_plain = "Маркетинг: соцсетей нет"

    loy_str = "нет"
    if has_loy:
        fmt = loyalty.get("loyalty_format")
        loy_str = "есть"
        if fmt:
            loy_str += f" ({', '.join(fmt) if isinstance(fmt, list) else fmt})"

    mk_md += f"\n- **Программа лояльности:** {loy_str}"
    mk_plain += f"; лояльность: {loy_str}"
    md_parts.append(mk_md)
    plain_parts.append(mk_plain)

    # ── Сайт ──
    t = tech.get(name, {})
    err = t.get("error")
    if err or not t.get("status_code"):
        reason = err or "нет данных"
        md_parts.append(f"### Сайт\n\nНедоступен: {reason}")
        plain_parts.append(f"Сайт: недоступен ({reason})")
    elif t:
        lt = t.get("load_time_sec", 0)
        https = "да" if t.get("https") else "нет"
        viewport = "да" if t.get("has_viewport") else "нет"
        title = t.get("title") or "отсутствует"
        meta_desc = t.get("meta_description") or "отсутствует"
        md_parts.append(
            f"### Сайт\n"
            f"- **URL:** {t.get('url', '?')}\n"
            f"- **Загрузка:** {lt:.2f}с | **HTTPS:** {https} | **Мобильная адаптация:** {viewport}\n"
            f"- **Title:** {title}\n"
            f"- **Meta description:** {meta_desc}"
        )
        plain_parts.append(
            f"Сайт: {t.get('url','?')}, загрузка {lt:.2f}с, "
            f"HTTPS: {https}, viewport: {viewport}"
        )
    else:
        md_parts.append("### Сайт\n\nДанных нет.")
        plain_parts.append("Сайт: данных нет")

    return "\n\n".join(md_parts), "\n".join(plain_parts)
