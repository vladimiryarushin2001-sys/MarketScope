import json
import os
import sys
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

try:
    import cloudscraper
    _scraper = cloudscraper.create_scraper()
except ImportError:
    _scraper = None

try:
    import undetected_chromedriver as uc
    _HAS_UC = True
except ImportError:
    _HAS_UC = False


_DESKTOP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

_MOBILE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.0 Mobile/15E148 Safari/604.1"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _detect_chrome_version() -> int | None:
    """Определяет мажорную версию установленного Chrome."""
    import subprocess, re
    for path in [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "google-chrome", "chromium-browser", "chromium",
    ]:
        try:
            out = subprocess.check_output([path, "--version"], stderr=subprocess.DEVNULL, timeout=5)
            m = re.search(r"(\d+)\.", out.decode())
            if m:
                return int(m.group(1))
        except Exception:
            continue
    return None


def _fetch_with_browser(url: str, timeout: int = 20) -> tuple[int, bytes]:
    """
    Fallback: загружает страницу через headless Chrome (undetected_chromedriver).
    Возвращает (status_code, html_bytes).
    """
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-gpu")

    version = _detect_chrome_version()
    kwargs = {"options": options, "headless": True}
    if version:
        kwargs["version_main"] = version

    driver = uc.Chrome(**kwargs)
    try:
        driver.set_page_load_timeout(timeout)
        driver.get(url)
        # Даём JS-challenge пройти (Qrator, Cloudflare и т.п. требуют времени)
        time.sleep(5)
        # Проверяем, прошёл ли challenge (перезагрузка может помочь)
        html = driver.page_source
        if "403" in driver.title or len(html) < 500:
            driver.get(url)
            time.sleep(5)
            html = driver.page_source
        return 200, html.encode("utf-8")
    finally:
        driver.quit()


def _parse_html(html: bytes, result: dict) -> None:
    """Извлекает title, meta_description, has_viewport из HTML и пишет в result."""
    result["page_size_kb"] = round(len(html) / 1024, 2)
    soup = BeautifulSoup(html, "html.parser")

    title_tag = soup.find("title")
    result["title"] = title_tag.get_text(strip=True) if title_tag else None

    meta_desc = soup.find("meta", attrs={"name": "description"})
    result["meta_description"] = (
        meta_desc.get("content")
        if meta_desc and meta_desc.get("content")
        else None
    )
    result["has_viewport"] = soup.find("meta", attrs={"name": "viewport"}) is not None


def check_website(url: str) -> dict:
    """Проверяет сайт: статус, время загрузки, размер, title, meta-теги.

    Цепочка попыток:
      1. requests + браузерные заголовки
      2. cloudscraper (если 401/403)
      3. headless Chrome через undetected_chromedriver (если всё ещё 401/403)
    """
    result = {
        "url": url,
        "status_code": None,
        "load_time_sec": 0,
        "mobile_load_time_sec": None,
        "page_size_kb": 0,
        "title": None,
        "meta_description": None,
        "https": url.startswith("https://"),
        "has_viewport": False,
        "error": None,
    }

    status_code = None

    # --- 1) Обычный requests ---
    try:
        start = time.perf_counter()
        response = requests.get(url, headers=_DESKTOP_HEADERS, timeout=10)
        elapsed = round(time.perf_counter() - start, 2)
        status_code = response.status_code
    except requests.RequestException as e:
        result["error"] = str(e)
        return result

    # --- 2) cloudscraper fallback ---
    if status_code in (401, 403) and _scraper is not None:
        try:
            start = time.perf_counter()
            response = _scraper.get(url, timeout=15)
            elapsed = round(time.perf_counter() - start, 2)
            status_code = response.status_code
        except Exception:
            pass  # оставляем предыдущий результат

    # --- 3) headless Chrome fallback ---
    if status_code in (401, 403) and _HAS_UC:
        try:
            print("    ↳ anti-bot защита, запускаю браузер…", flush=True)
            start = time.perf_counter()
            status_code, html_bytes = _fetch_with_browser(url)
            elapsed = round(time.perf_counter() - start, 2)

            result["status_code"] = status_code
            result["load_time_sec"] = elapsed
            _parse_html(html_bytes, result)

            # Если после браузера title «403»/пустой — сайт за жёсткой защитой
            title = result.get("title") or ""
            if "403" in title or "401" in title or result["page_size_kb"] < 2:
                result["anti_bot_protected"] = True
                result["error"] = (
                    "Сайт за anti-bot защитой (Qrator/Cloudflare), "
                    "данные могут быть неполными"
                )
        except Exception as e:
            result["error"] = f"browser fallback failed: {e}"
            result["anti_bot_protected"] = True

        # Мобильный запрос (обычный requests, не через браузер)
        try:
            mobile_start = time.perf_counter()
            requests.get(url, headers=_MOBILE_HEADERS, timeout=10)
            result["mobile_load_time_sec"] = round(
                time.perf_counter() - mobile_start, 2
            )
        except requests.RequestException:
            result["mobile_load_time_sec"] = None

        return result

    # Если 401/403 но нет UC — просто помечаем
    if status_code in (401, 403):
        result["status_code"] = status_code
        result["load_time_sec"] = elapsed
        result["anti_bot_protected"] = True
        result["error"] = "Сайт вернул 401/403, возможно anti-bot защита"
        return result

    # --- Обычный путь: requests/cloudscraper сработал ---
    result["status_code"] = status_code
    result["load_time_sec"] = elapsed
    _parse_html(response.content, result)

    # Мобильный запрос
    try:
        mobile_start = time.perf_counter()
        requests.get(url, headers=_MOBILE_HEADERS, timeout=10)
        result["mobile_load_time_sec"] = round(
            time.perf_counter() - mobile_start, 2
        )
    except requests.RequestException:
        result["mobile_load_time_sec"] = None

    return result


def _tech_place_conclusion(entry: dict) -> str:
    if entry.get("error") or not entry.get("status_code"):
        return "Технический контакт с пользователем выглядит слабым: сайт недоступен или не дал стабильного результата при проверке."

    load_time = float(entry.get("load_time_sec") or 0)
    https = bool(entry.get("https"))
    viewport = bool(entry.get("has_viewport"))
    title = bool(entry.get("title"))
    meta = bool(entry.get("meta_description"))

    if load_time <= 2:
        speed = "сайт загружается быстро"
    elif load_time <= 4:
        speed = "сайт загружается на приемлемом уровне"
    else:
        speed = "сайт загружается медленно"

    seo_bits = []
    if title:
        seo_bits.append("title")
    if meta:
        seo_bits.append("meta description")
    seo_text = ", ".join(seo_bits) if seo_bits else "SEO-метаданные почти не заполнены"

    return (
        f"Технически {speed}; HTTPS {'есть' if https else 'нет'}, "
        f"мобильная адаптация {'подтверждена' if viewport else 'не подтверждена'}, {seo_text}."
    )


def _tech_block_conclusion(tech_by_place: dict[str, dict]) -> str:
    total = len(tech_by_place)
    if total == 0:
        return "Технические данные по сайтам не собраны."

    healthy = []
    broken = 0
    for entry in tech_by_place.values():
        if entry.get("error") or not entry.get("status_code"):
            broken += 1
        else:
            healthy.append(entry)

    if not healthy:
        return (
            f"Проверено {total} сайтов, но ни один не дал полноценного технического результата; "
            "веб-контакт с пользователем в нише выглядит нестабильным."
        )

    avg_load = sum(float(entry.get("load_time_sec") or 0) for entry in healthy) / len(healthy)
    with_https = sum(1 for entry in healthy if entry.get("https"))
    with_mobile = sum(1 for entry in healthy if entry.get("has_viewport"))

    return (
        f"Проверено {total} сайтов: полноценно ответили {len(healthy)}, недоступны или проблемны {broken}. "
        f"Средняя скорость загрузки у доступных сайтов составляет {avg_load:.2f}с, HTTPS есть у {with_https} из {len(healthy)}, "
        f"мобильная адаптация подтверждена у {with_mobile}, поэтому технологический уровень игроков заметно различается."
    )


def _build_market_context_block5(tech_by_place: dict[str, dict]) -> str:
    if not tech_by_place:
        return "Технические данные по сайтам отсутствуют."

    blocks = []
    for idx, (name, entry) in enumerate(tech_by_place.items(), 1):
        lines = [
            f"{idx}. {name}",
            f"   URL: {entry.get('url') or 'не указан'}",
            f"   Статус-код: {entry.get('status_code') if entry.get('status_code') is not None else 'нет'}",
            f"   Ошибка: {entry.get('error') or 'нет'}",
            f"   Anti-bot защита: {'да' if entry.get('anti_bot_protected') else 'нет'}",
            f"   Время загрузки: {entry.get('load_time_sec') if entry.get('load_time_sec') is not None else 'нет'}",
            f"   Мобильная загрузка: {entry.get('mobile_load_time_sec') if entry.get('mobile_load_time_sec') is not None else 'нет'}",
            f"   HTTPS: {'да' if entry.get('https') else 'нет'}",
            f"   Title: {'есть' if entry.get('title') else 'нет'}",
            f"   Meta description: {'есть' if entry.get('meta_description') else 'нет'}",
            f"   Viewport: {'есть' if entry.get('has_viewport') else 'нет'}",
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_market_llm_analysis(
    tech_by_place: dict[str, dict],
    query_context: str,
    api_key: str,
    model: str,
) -> str:
    fallback_overall = _tech_block_conclusion(tech_by_place)
    fallback_by_name = {
        name: _tech_place_conclusion(entry)
        for name, entry in tech_by_place.items()
    }

    for name, summary in fallback_by_name.items():
        tech_by_place[name]["вывод"] = summary

    if not api_key or not tech_by_place:
        return fallback_overall

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from restaurant_pipeline.blocks.market_llm import apply_block_analysis, call_market_block_llm
    from restaurant_pipeline.blocks.block5_tech.prompts_market import SYSTEM, USER_TEMPLATE

    try:
        analysis = call_market_block_llm(
            system_prompt=SYSTEM,
            user_prompt=USER_TEMPLATE.format(
                query_context=query_context or "не указан",
                block_context=_build_market_context_block5(tech_by_place),
            ),
            api_key=api_key,
            model=model,
        )
        return apply_block_analysis(
            place_names=list(tech_by_place.keys()),
            analysis=analysis,
            per_place_setter=lambda name, summary: tech_by_place[name].__setitem__("вывод", summary),
            fallback_per_place=fallback_by_name,
            fallback_overall=fallback_overall,
        )
    except Exception as e:
        print(f"[block5] Market LLM analysis fallback: {e}", flush=True)
        return fallback_overall


def _build_single_place_context_block5(tech_by_place: dict[str, dict], place_name: str) -> str:
    """Контекст для одного заведения (per-place анализ техпроверки)."""
    entry = tech_by_place.get(place_name)
    if not entry:
        return ""
    return "\n".join([
        f"URL: {entry.get('url') or 'не указан'}",
        f"Статус: {entry.get('status_code') if entry.get('status_code') is not None else 'нет'}",
        f"Ошибка: {entry.get('error') or 'нет'}",
        f"Загрузка: {entry.get('load_time_sec') if entry.get('load_time_sec') is not None else 'нет'}",
        f"HTTPS: {'да' if entry.get('https') else 'нет'}",
        f"Viewport: {'да' if entry.get('has_viewport') else 'нет'}",
        f"Title: {'есть' if entry.get('title') else 'нет'}",
        f"Meta: {'есть' if entry.get('meta_description') else 'нет'}",
    ])


def _build_competitive_context_block5(tech_by_place: dict[str, dict], ref_name: str) -> str:
    """Контекст для competitive LLM: техпроверка по заведениям с пометкой [ОПОРНОЕ]."""
    if not tech_by_place:
        return "Технические данные отсутствуют."

    blocks = []
    ref_key = str(ref_name).strip().lower()
    for idx, (name, entry) in enumerate(tech_by_place.items(), 1):
        is_ref = str(name).strip().lower() == ref_key or entry.get("is_reference_place")
        tag = " [ОПОРНОЕ]" if is_ref else ""
        lines = [
            f"{idx}. {name}{tag}",
            f"   URL: {entry.get('url') or 'не указан'}",
            f"   Статус: {entry.get('status_code') if entry.get('status_code') is not None else 'нет'}",
            f"   Ошибка: {entry.get('error') or 'нет'}",
            f"   Загрузка: {entry.get('load_time_sec') if entry.get('load_time_sec') is not None else 'нет'}",
            f"   HTTPS: {'да' if entry.get('https') else 'нет'}",
            f"   Viewport: {'да' if entry.get('has_viewport') else 'нет'}",
            f"   Title: {'есть' if entry.get('title') else 'нет'}",
            f"   Meta: {'есть' if entry.get('meta_description') else 'нет'}",
        ]
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_competitive_llm_analysis_block5(
    tech_by_place: dict[str, dict],
    ref_name: str,
    api_key: str,
    model: str,
) -> str:
    """Краткие выводы по заведениям + подробный по опорному. Возвращает вывод_по_опорному."""
    fallback_per_place = {name: _tech_place_conclusion(entry) for name, entry in tech_by_place.items()}
    fallback_ref = (
        f"По сайту опорного заведения «{ref_name}» в выборке из {len(tech_by_place)} заведений. "
        "Для детального сравнительного вывода нужен LLM."
    )
    for name, summary in fallback_per_place.items():
        tech_by_place[name]["вывод"] = summary

    if not api_key or not tech_by_place or not ref_name:
        return fallback_ref

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    try:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block5_tech.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )
    except ImportError:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block5_tech.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )

    try:
        return apply_competitive_per_place_then_compare(
            place_names=list(tech_by_place.keys()),
            build_single_place_context=lambda name: _build_single_place_context_block5(tech_by_place, name),
            ref_name=ref_name,
            per_place_system=PER_PLACE_SYSTEM,
            per_place_user_template=PER_PLACE_USER_TEMPLATE,
            comparison_system=COMPARISON_SYSTEM,
            comparison_user_template=COMPARISON_USER_TEMPLATE,
            api_key=api_key,
            model=model,
            per_place_setter=lambda n, s: tech_by_place[n].__setitem__("вывод", s),
            fallback_per_place=fallback_per_place,
            fallback_ref_summary=fallback_ref,
        )
    except Exception as e:
        print(f"[block5] Competitive LLM analysis fallback: {e}", flush=True)
        return fallback_ref


def run(input_json_path: str, output_json_path: str) -> dict:
    """
    Вход:  block1_output.json  (selected_places с полями «название», «сайт»)
    Выход: block5_output.json  {"block": ..., "tech_by_place": {"Тануки": {...}, ...}}
    """
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
    market_api_key = os.environ.get("PPLX_API_KEY", "")
    perplexity_model = block1.get("perplexity_model", "sonar")
    query_context = str(block1.get("query_context") or "").strip()
    ref_name = str((block1.get("reference_place") or {}).get("name") or "").strip()

    tech_by_place: dict[str, dict] = {}

    for p in places:
        name = p.get("название", "unknown")
        site = (p.get("сайт") or "").strip()
        is_ref = p.get("is_reference_place", False)

        if not site or "://" not in site:
            entry = {
                "url": site or None,
                "error": "сайт не указан или невалидный URL",
            }
            if is_market or is_competitive:
                entry["вывод"] = _tech_place_conclusion(entry)
            if is_ref:
                entry["is_reference_place"] = True
            tech_by_place[name] = entry
            print(f"  [{name}]{'  [ref]' if is_ref else ''} пропущен — нет валидного сайта")
            continue

        print(f"  [{name}]{'  [ref]' if is_ref else ''} проверяю {site} …", flush=True)
        result = check_website(site)
        if is_market or is_competitive:
            result["вывод"] = _tech_place_conclusion(result)
        if is_ref:
            result["is_reference_place"] = True
        tech_by_place[name] = result
        print(
            f"  [{name}] статус={result['status_code']}, "
            f"время={result['load_time_sec']}с"
        )

    payload = {
        "block": "block5_tech",
        "tech_by_place": tech_by_place,
    }
    if is_market:
        payload["общий_вывод"] = _apply_market_llm_analysis(
            tech_by_place,
            query_context=query_context,
            api_key=market_api_key,
            model=perplexity_model,
        )
    elif is_competitive and tech_by_place:
        if not market_api_key:
            print("[block5] ⚠ PPLX_API_KEY не задан — LLM-анализ пропущен", flush=True)
        payload["вывод_по_опорному"] = _apply_competitive_llm_analysis_block5(
            tech_by_place,
            ref_name=ref_name,
            api_key=market_api_key,
            model=perplexity_model,
        )

    Path(output_json_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\nГотово — результаты в {output_json_path}")
    return payload


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run(args.input, args.output)
