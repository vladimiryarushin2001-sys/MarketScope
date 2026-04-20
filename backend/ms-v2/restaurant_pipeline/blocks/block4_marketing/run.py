"""
Block 4: Marketing — парсинг соцсетей и программ лояльности.

1. Playwright — соцсети и лояльность с сайтов (основа)
2. Perplexity — обогащение: по каждой соцсети — насколько активно ведут канал
3. Один синтезирующий промпт — вывод по каждому + общий/вывод_по_опорному
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urljoin, urlparse, urlunparse

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]

# ---------------------------------------------------------------------------
# Соцсети (Playwright)
# ---------------------------------------------------------------------------

SOCIAL_PATTERNS = {
    "telegram": r"tg://|t\.me/|telegram\.me/|telegram\.org/",
    "vk": r"vk\.com/",
    "ok": r"ok\.ru/",
    "instagram": r"instagram\.com/",
    "facebook": r"facebook\.com/",
    "youtube": r"youtube\.com/|youtu\.be/",
    "tiktok": r"tiktok\.com/",
    "twitter": r"twitter\.com/|x\.com/",
    "linkedin": r"linkedin\.com/",
    "dzen": r"dzen\.ru/",
    "rutube": r"rutube\.ru/",
}

_COMMON_TG_ACCOUNTS = frozenset({
    "yandex", "telegram", "support", "help", "blog",
    "app", "download", "android", "ios", "bot", "news",
})


def _normalize_telegram_url(url: str) -> str | None:
    if not url:
        return None
    url = url.strip()
    if url.startswith("tg://resolve?"):
        params = parse_qs(url.replace("tg://resolve?", ""))
        if "domain" in params and params["domain"][0]:
            return f"https://t.me/{params['domain'][0]}"
        return None
    if url.startswith("tg://t.me/"):
        username = url.replace("tg://t.me/", "").split("?")[0].split("/")[0]
        return f"https://t.me/{username}" if username else None
    if url.startswith("tg:"):
        username = url.replace("tg:", "").split("?")[0].split("/")[0]
        return f"https://t.me/{username}" if username else None
    if url.startswith(("http://", "https://", "//")):
        if url.startswith("//"):
            url = "https:" + url
        parsed = urlparse(url)
        if parsed.netloc.lower() in ("t.me", "telegram.me", "telegram.org"):
            path = parsed.path.strip("/")
            if path.startswith(("joinchat/", "+")):
                return urlunparse(("https", parsed.netloc, "/" + path, "", "", ""))
            if path:
                username = re.sub(r"[^a-zA-Z0-9_]", "", path.split("/")[0])
                if username and 2 <= len(username) <= 32:
                    return f"https://t.me/{username}"
    for pat in (r"t\.me/([a-zA-Z0-9_]{2,32})", r"telegram\.me/([a-zA-Z0-9_]{2,32})"):
        m = re.search(pat, url)
        if m and m.group(1).lower() not in _COMMON_TG_ACCOUNTS:
            return f"https://t.me/{m.group(1)}"
    return None


def _detect_social(url: str) -> str | None:
    if not url:
        return None
    low = url.lower()
    if "tg://" in low or re.search(r"t\.me/|telegram\.me/|telegram\.org/", low):
        return "telegram" if _normalize_telegram_url(url) else None
    for name, pattern in SOCIAL_PATTERNS.items():
        if name != "telegram" and re.search(pattern, low):
            return name
    return None


def _extract_social_links_from_html(html: str) -> list[tuple[str, str]]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    found: dict[str, str] = {}
    for a in soup.find_all(["a", "link"], href=True):
        href = a["href"]
        if not href or href.startswith(("#", "mailto:", "tel:")):
            continue
        social = _detect_social(href)
        if not social:
            continue
        if social == "telegram":
            norm = _normalize_telegram_url(href)
            if not norm:
                continue
            href = norm
        elif not href.startswith("http"):
            href = "https://" + href
        if social not in found or len(href) < len(found[social]):
            found[social] = href
    return list(found.items())


async def _parse_socials(page, website_url: str) -> list[dict[str, str]]:
    results: dict[str, str] = {}

    def _add(network: str, url: str) -> None:
        if network == "telegram":
            url = _normalize_telegram_url(url) or url
        if not url.startswith("http"):
            url = "https://" + url
        try:
            p = urlparse(url)
            norm = urlunparse((p.scheme, p.netloc.lower(), p.path.rstrip("/"), "", "", ""))
        except Exception:
            norm = url
        if network not in results or len(norm) < len(results[network]):
            results[network] = norm

    selectors = [
        'a[href*="vk.com"]', 'a[href*="t.me"]', 'a[href*="telegram"]',
        'a[href*="instagram.com"]', 'a[href*="facebook.com"]',
        'a[href*="youtube.com"]', 'a[href*="youtu.be"]',
        'a[href*="twitter.com"]', 'a[href*="x.com"]',
        'a[href*="ok.ru"]', 'a[href*="dzen.ru"]', 'a[href*="rutube.ru"]',
        '[class*="social"] a', 'footer a', 'header a',
        '.social-links a', '.socials a', '.social-media a', '.social-icons a',
    ]
    for sel in selectors:
        try:
            for el in await page.query_selector_all(sel):
                for attr in ("href", "data-href", "data-url", "data-link"):
                    val = await el.get_attribute(attr)
                    if val:
                        s = _detect_social(val)
                        if s:
                            _add(s, val)
        except Exception:
            continue
    html = await page.content()
    for net, url in _extract_social_links_from_html(html):
        _add(net, url)
    return [{"network": n, "url": u} for n, u in results.items()]


# ---------------------------------------------------------------------------
# Программа лояльности (Playwright)
# ---------------------------------------------------------------------------

LOYALTY_KEYWORDS = [
    "бонус", "балл", "копи", "накоп",
    "лояль", "club", "клуб",
    "cashback", "кешбек", "кэшбек",
]

STOP_PHRASES = [
    "все права защищены", "политика конфиденциальности", "наверх",
    "меню", "банкеты", "контакты", "новости", "доставка",
    "мы в соцсетях", "о нас", "забронировать", "отправить",
    "qr-код", "заполните анкету", "оформить карту", "добавьте карту",
    "отсканируйте", "инструкция",
]


def _extract_relevant_blocks(soup, require_numbers: bool = False) -> list[str]:
    blocks = []
    for tag in soup.find_all(["div", "section", "p", "span", "li", "article", "main"]):
        text = tag.getы_text(" ", strip=True)
        if not text or len(text) < 15:
            continue
        low = text.lower()
        if any(k in low for k in LOYALTY_KEYWORDS):
            if require_numbers and not re.search(r"\d", text):
                continue
            blocks.append(text)
    return blocks


def _extract_program_format(blocks: list[str]) -> list[str] | None:
    text = " ".join(blocks).lower()
    has_bonus = any(k in text for k in ["бонус", "балл"])
    has_percent_bonus = has_bonus and bool(re.search(r"\d+\s*%", text))
    has_cashback = any(k in text for k in ["cashback", "кешбек", "кэшбек"])
    has_discount = "скидк" in text
    if has_percent_bonus:
        return ["бонусная"]
    fmt = []
    if has_bonus:
        fmt.append("бонусная")
    if has_cashback:
        fmt.append("кэшбэк")
    if has_discount and not has_bonus:
        fmt.append("скидочная")
    return fmt or None


def _extract_cost_per_point(blocks: list[str]) -> str | None:
    text = " ".join(blocks)
    for p in (
        r"1\s*(?:бонус|балл)\s*[=—\-–]\s*1\s*(?:руб|₽)",
        r"\d+\s*(?:руб|₽)\s*[=—\-–]\s*\d+\s*(?:бонус|балл)",
        r"\d+\s*(?:бонус(?:ов)?|балл(?:ов)?)\s*=\s*\d+\s*(?:руб|₽)",
        r"начисляется\s+\d+\s*%",
        r"кешбэк\s+\d+\s*%",
    ):
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()
    return None


def _is_noise(text: str) -> bool:
    low = text.lower()
    if any(s in low for s in STOP_PHRASES):
        return True
    return len(text) < 10


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _extract_how_to_earn(blocks: list[str]) -> str | None:
    percent_pat = r"\d+\s*%\s*(?:накопления|начисляется|бонус|от\s*суммы|со\s*счета)"
    found = []
    for b in blocks:
        for sent in re.split(r"(?<=[.!?])\s+", b):
            if _is_noise(sent):
                continue
            if re.search(percent_pat, sent, re.IGNORECASE):
                found.append(sent.strip())
    if not found:
        earn_pat = r"(получайте|копите|начисляются|начисляется|накапливаются)"
        for b in blocks:
            for sent in re.split(r"(?<=[.!?])\s+", b):
                if _is_noise(sent):
                    continue
                low = sent.lower()
                if any(k in low for k in LOYALTY_KEYWORDS) and re.search(earn_pat, low):
                    found.append(sent.strip())
    if not found:
        return None
    unique, seen = [], set()
    for p in found:
        n = _normalize_text(p)
        if n not in seen and len(n) > 10:
            seen.add(n)
            unique.append(p)
    return ". ".join(unique[:2]) + "."


# ---------------------------------------------------------------------------
# Perplexity: обогащение соцсетей (активность)
# ---------------------------------------------------------------------------


def _enrich_socials_with_perplexity(
    marketing_by_place: dict[str, dict],
    api_key: str,
    model: str,
) -> None:
    """Добавляет в каждую соцсеть поле activity — насколько активно ведут канал."""
    if not api_key:
        return

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    try:
        from restaurant_pipeline.blocks.block4_marketing.prompts_enrich import SYSTEM, USER_TEMPLATE
    except ImportError:
        from .prompts_enrich import SYSTEM, USER_TEMPLATE

    from langchain_core.messages import HumanMessage, SystemMessage

    def _get_chat():
        try:
            from langchain_perplexity import ChatPerplexity
        except Exception:
            import warnings
            with warnings.catch_warnings():
                warnings.filterwarnings("ignore", message="The class `ChatPerplexity` was deprecated.*")
                from langchain_community.chat_models import ChatPerplexity
        return ChatPerplexity

    def _strip_thinking(t: str) -> str:
        return re.sub(r"<think>.*?</think>", "", t, flags=re.DOTALL).strip()

    ChatPerplexity = _get_chat()
    llm = ChatPerplexity(api_key=api_key, model=model, temperature=0.1, max_tokens=2048)

    for name, entry in marketing_by_place.items():
        socials = entry.get("соцсети") or []
        if not socials:
            continue

        socials_list = "\n".join(f"- {s.get('network', '?')}: {s.get('url', '?')}" for s in socials)
        website = entry.get("сайт") or "н/д"

        prompt = USER_TEMPLATE.format(
            place_name=name,
            website=website,
            socials_list=socials_list,
        )
        try:
            response = llm.invoke([SystemMessage(content=SYSTEM), HumanMessage(content=prompt)])
            content = response.content if hasattr(response, "content") else str(response)
            content = _strip_thinking(content).strip()

            json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
            if json_match:
                content = json_match.group(1).strip()
            obj_match = re.search(r"\{[\s\S]*\}", content)
            if obj_match:
                content = obj_match.group(0)

            data = json.loads(content)
            enriched = {str(s.get("url", "")).strip(): s for s in data.get("socials") or [] if isinstance(s, dict)}

            for s in socials:
                url_key = str(s.get("url", "")).strip()
                act = enriched.get(url_key, {}).get("activity")
                if act and isinstance(act, str):
                    s["activity"] = act.strip()
                    logger.info(f"    [{name}] {s.get('network')}: обогащено")
        except Exception as e:
            logger.warning(f"[block4] Perplexity enrich для {name}: {e}")


# ---------------------------------------------------------------------------
# Контекст и выводы
# ---------------------------------------------------------------------------


def _marketing_place_conclusion(entry: dict[str, Any]) -> str:
    site = bool(entry.get("сайт"))
    socials = entry.get("соцсети") or []
    loyalty = entry.get("программа_лояльности") or {}
    has_loyalty = bool(loyalty.get("has_loyalty"))
    if not site and not socials and not has_loyalty:
        return "Маркетинговые сигналы у заведения выражены слабо."
    parts = []
    if site:
        parts.append("есть сайт")
    if socials:
        act_info = [s.get("activity") for s in socials if s.get("activity")]
        if act_info:
            first = act_info[0]
            parts.append(f"соцсети ({len(socials)}): {first[:100]}{'...' if len(first) > 100 else ''}")
        else:
            parts.append(f"есть соцсети ({len(socials)})")
    if has_loyalty:
        parts.append("программа лояльности")
    return "Маркетинговая база: " + ", ".join(parts) + "."


def _marketing_block_conclusion(marketing_by_place: dict[str, dict]) -> str:
    total = len(marketing_by_place)
    if total == 0:
        return "Маркетинговые данные отсутствуют."
    with_sites = sum(1 for e in marketing_by_place.values() if e.get("сайт"))
    with_socials = sum(1 for e in marketing_by_place.values() if e.get("соцсети"))
    with_loyalty = sum(1 for e in marketing_by_place.values() if (e.get("программа_лояльности") or {}).get("has_loyalty"))
    platform_counts: dict[str, int] = {}
    for e in marketing_by_place.values():
        for s in e.get("соцсети") or []:
            n = s.get("network")
            if n:
                platform_counts[n] = platform_counts.get(n, 0) + 1
    top = sorted(platform_counts.items(), key=lambda x: (-x[1], x[0]))[:3]
    platforms = ", ".join(n for n, _ in top) if top else "не определены"
    return (
        f"Сайт у {with_sites}/{total}, соцсети у {with_socials}, лояльность у {with_loyalty}. "
        f"Платформы: {platforms}."
    )


def _build_market_context_block4(marketing_by_place: dict[str, dict]) -> str:
    if not marketing_by_place:
        return "Данные отсутствуют."
    blocks = []
    for idx, (name, entry) in enumerate(marketing_by_place.items(), 1):
        socials = entry.get("соцсети") or []
        loyalty = entry.get("программа_лояльности") or {}
        lines = [
            f"{idx}. {name}",
            f"   Сайт: {entry.get('сайт') or 'н/д'}",
            "   Соцсети:",
        ]
        for s in socials:
            act = s.get("activity") or "активность не оценена"
            lines.append(f"     - {s.get('network', '?')} ({s.get('url', '?')}): {act}")
        if not socials:
            lines.append("     не найдены")
        lines.append(f"   Лояльность: {'да' if loyalty.get('has_loyalty') else 'нет'}")
        if loyalty.get("loyalty_how_to_earn"):
            lines.append(f"   Условия: {str(loyalty.get('loyalty_how_to_earn', ''))[:150]}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _build_single_place_context_block4(marketing_by_place: dict[str, dict], place_name: str) -> str:
    """Контекст для одного заведения (per-place анализ маркетинга)."""
    entry = marketing_by_place.get(place_name)
    if not entry:
        return ""
    socials = entry.get("соцсети") or []
    loyalty = entry.get("программа_лояльности") or {}
    lines = [
        f"Сайт: {entry.get('сайт') or 'н/д'}",
        "Соцсети:",
    ]
    for s in socials:
        act = s.get("activity") or "активность не оценена"
        lines.append(f"  - {s.get('network', '?')}: {act}")
    if not socials:
        lines.append("  не найдены")
    lines.append(f"Лояльность: {'да' if loyalty.get('has_loyalty') else 'нет'}")
    return "\n".join(lines)


def _build_competitive_context_block4(marketing_by_place: dict[str, dict], ref_name: str) -> str:
    if not marketing_by_place:
        return "Данные отсутствуют."
    blocks = []
    ref_key = str(ref_name).strip().lower()
    for idx, (name, entry) in enumerate(marketing_by_place.items(), 1):
        is_ref = str(name).strip().lower() == ref_key or entry.get("is_reference_place")
        tag = " [ОПОРНОЕ]" if is_ref else ""
        socials = entry.get("соцсети") or []
        loyalty = entry.get("программа_лояльности") or {}
        lines = [
            f"{idx}. {name}{tag}",
            f"   Сайт: {entry.get('сайт') or 'н/д'}",
            "   Соцсети:",
        ]
        for s in socials:
            act = s.get("activity") or "активность не оценена"
            lines.append(f"     - {s.get('network', '?')}: {act}")
        if not socials:
            lines.append("     не найдены")
        lines.append(f"   Лояльность: {'да' if loyalty.get('has_loyalty') else 'нет'}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_market_llm_analysis(
    marketing_by_place: dict[str, dict],
    query_context: str,
    api_key: str,
    model: str,
) -> str:
    fallback_overall = _marketing_block_conclusion(marketing_by_place)
    fallback_by_name = {name: _marketing_place_conclusion(e) for name, e in marketing_by_place.items()}
    for name, summary in fallback_by_name.items():
        marketing_by_place[name]["вывод"] = summary
    if not api_key or not marketing_by_place:
        return fallback_overall

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    from restaurant_pipeline.blocks.market_llm import apply_block_analysis, call_market_block_llm
    from restaurant_pipeline.blocks.block4_marketing.prompts_market import SYSTEM, USER_TEMPLATE

    try:
        analysis = call_market_block_llm(
            system_prompt=SYSTEM,
            user_prompt=USER_TEMPLATE.format(
                query_context=query_context or "не указан",
                block_context=_build_market_context_block4(marketing_by_place),
            ),
            api_key=api_key,
            model=model,
        )
        return apply_block_analysis(
            place_names=list(marketing_by_place.keys()),
            analysis=analysis,
            per_place_setter=lambda n, s: marketing_by_place[n].__setitem__("вывод", s),
            fallback_per_place=fallback_by_name,
            fallback_overall=fallback_overall,
        )
    except Exception as e:
        logger.warning(f"[block4] Market LLM fallback: {e}")
        return fallback_overall


def _apply_competitive_llm_analysis_block4(
    marketing_by_place: dict[str, dict],
    ref_name: str,
    api_key: str,
    model: str,
) -> str:
    fallback_per_place = {name: _marketing_place_conclusion(e) for name, e in marketing_by_place.items()}
    fallback_ref = f"По маркетингу «{ref_name}» в выборке из {len(marketing_by_place)} заведений."
    for name, summary in fallback_per_place.items():
        marketing_by_place[name]["вывод"] = summary
    if not api_key or not marketing_by_place or not ref_name:
        return fallback_ref

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))
    try:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block4_marketing.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )
    except ImportError:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block4_marketing.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )

    try:
        return apply_competitive_per_place_then_compare(
            place_names=list(marketing_by_place.keys()),
            build_single_place_context=lambda name: _build_single_place_context_block4(marketing_by_place, name),
            ref_name=ref_name,
            per_place_system=PER_PLACE_SYSTEM,
            per_place_user_template=PER_PLACE_USER_TEMPLATE,
            comparison_system=COMPARISON_SYSTEM,
            comparison_user_template=COMPARISON_USER_TEMPLATE,
            api_key=api_key,
            model=model,
            per_place_setter=lambda n, s: marketing_by_place[n].__setitem__("вывод", s),
            fallback_per_place=fallback_per_place,
            fallback_ref_summary=fallback_ref,
        )
    except Exception as e:
        logger.warning(f"[block4] Competitive LLM fallback: {e}")
        return fallback_ref


async def _collect_loyalty_pages(page, base_url: str) -> list[str]:
    urls: set[str] = set()
    try:
        links = await page.evaluate("""() => {
            const out = [];
            document.querySelectorAll('a[href]').forEach(a =>
                out.push({text: a.innerText.trim(), href: a.href})
            );
            return out;
        }""")
        kw = ("лояль", "бонус", "акци", "программа", "накоп", "клуб")
        href_kw = ("loyalty", "bonus", "akcii", "programma", "club")
        for lnk in links:
            text = lnk["text"].lower()
            href = lnk["href"]
            full = urljoin(base_url, href)
            if full.startswith(base_url):
                if any(k in text for k in kw) or any(k in href.lower() for k in href_kw):
                    urls.add(full)
    except Exception:
        pass
    return list(urls)


async def _parse_loyalty(page, website_url: str, company_name: str) -> dict[str, Any]:
    from bs4 import BeautifulSoup
    parsed = urlparse(website_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    result: dict[str, Any] = {
        "has_loyalty": False,
        "loyalty_name": None,
        "loyalty_format": None,
        "loyalty_cost_per_point": None,
        "loyalty_how_to_earn": None,
    }
    html = await page.content()
    soup = BeautifulSoup(html, "html.parser")
    all_blocks = _extract_relevant_blocks(soup)
    loyalty_urls = await _collect_loyalty_pages(page, base_url)
    for path in ("/loyalty", "/bonus", "/club", "/programma-loyalnosti", "/akcii", "/promo"):
        full = urljoin(base_url, path)
        if full not in loyalty_urls:
            loyalty_urls.append(full)
    for url in loyalty_urls:
        try:
            resp = await page.goto(url, timeout=20000, wait_until="domcontentloaded")
            if not resp or resp.status != 200:
                continue
            await asyncio.sleep(2)
            page_html = await page.content()
            page_soup = BeautifulSoup(page_html, "html.parser")
            all_blocks.extend(_extract_relevant_blocks(page_soup, require_numbers=True))
            all_blocks.extend(_extract_relevant_blocks(page_soup))
        except Exception:
            continue
    if not all_blocks:
        return result
    unique, seen = [], set()
    for b in all_blocks:
        n = _normalize_text(b)
        if n not in seen and len(n) > 15:
            seen.add(n)
            unique.append(b)
    result["has_loyalty"] = True
    result["loyalty_format"] = _extract_program_format(unique)
    result["loyalty_cost_per_point"] = _extract_cost_per_point(unique)
    result["loyalty_how_to_earn"] = _extract_how_to_earn(unique)
    return result


async def _process_place(browser, place: dict, idx: int, total: int, add_conclusion: bool) -> tuple[str, dict]:
    name = place.get("название", f"place_{idx}")
    site = (place.get("сайт") or "").strip()
    is_ref = place.get("is_reference_place", False)

    entry: dict[str, Any] = {
        "сайт": site or None,
        "соцсети": [],
        "программа_лояльности": {
            "has_loyalty": False,
            "loyalty_name": None,
            "loyalty_format": None,
            "loyalty_cost_per_point": None,
            "loyalty_how_to_earn": None,
        },
    }
    if is_ref:
        entry["is_reference_place"] = True

    if not site or "://" not in site:
        logger.info(f"  [{idx}/{total}] {name}{'  [ref]' if is_ref else ''} — нет валидного сайта")
        if add_conclusion:
            entry["вывод"] = _marketing_place_conclusion(entry)
        return name, entry

    logger.info(f"  [{idx}/{total}] {name} — {site}")
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        locale="ru-RU",
        viewport={"width": 1920, "height": 1080},
    )
    page = await context.new_page()
    await page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")

    try:
        await page.goto(site, timeout=30000, wait_until="domcontentloaded")
        await asyncio.sleep(random.uniform(3, 5))
        for y in (500, 1500, 3000):
            await page.mouse.wheel(0, y)
            await asyncio.sleep(random.uniform(0.5, 1.5))
        socials = await _parse_socials(page, site)
        entry["соцсети"] = socials
        logger.info(f"    Соцсети: {[s['network'] for s in socials] or 'не найдены'}")
        loyalty = await _parse_loyalty(page, site, name)
        entry["программа_лояльности"] = loyalty
        logger.info(f"    Лояльность: {'да' if loyalty['has_loyalty'] else 'нет'}")
    except Exception as e:
        logger.warning(f"    Ошибка: {e}")
    finally:
        await context.close()

    if add_conclusion:
        entry["вывод"] = _marketing_place_conclusion(entry)
    return name, entry


async def _run_async(places: list[dict], add_conclusion: bool) -> dict[str, dict]:
    from playwright.async_api import async_playwright
    marketing: dict[str, dict] = {}
    total = len(places)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        for idx, place in enumerate(places, 1):
            name, entry = await _process_place(browser, place, idx, total, add_conclusion)
            marketing[name] = entry
            await asyncio.sleep(random.uniform(2, 4))
        await browser.close()
    return marketing


def run(input_json_path: str, output_json_path: str) -> dict:
    try:
        from dotenv import load_dotenv
        load_dotenv(_project_root() / ".env")
    except Exception:
        pass

    with open(input_json_path, "r", encoding="utf-8") as f:
        block1 = json.load(f)

    is_market = block1.get("report_type") == "market"
    is_competitive = block1.get("report_type") == "competitive"
    places = block1.get("selected_places", [])
    api_key = os.environ.get("PPLX_API_KEY", "")
    model = block1.get("perplexity_model", "sonar")
    query_context = str(block1.get("query_context") or "").strip()
    ref_name = str((block1.get("reference_place") or {}).get("name") or "").strip()

    logger.info(f"[block4] Обработка {len(places)} заведений")
    add_conclusion = is_market or is_competitive
    marketing_by_place = asyncio.run(_run_async(places, add_conclusion))

    logger.info("[block4] Обогащение соцсетей Perplexity (активность)…")
    _enrich_socials_with_perplexity(marketing_by_place, api_key, model)

    payload: dict[str, Any] = {
        "block": "block4_marketing",
        "marketing_by_place": marketing_by_place,
    }
    if is_market:
        payload["общий_вывод"] = _apply_market_llm_analysis(
            marketing_by_place, query_context=query_context, api_key=api_key, model=model,
        )
    elif is_competitive and marketing_by_place:
        if not api_key:
            logger.warning("[block4] PPLX_API_KEY не задан — LLM-анализ пропущен")
        payload["вывод_по_опорному"] = _apply_competitive_llm_analysis_block4(
            marketing_by_place, ref_name=ref_name, api_key=api_key, model=model,
        )

    Path(output_json_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return payload


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run(args.input, args.output)
