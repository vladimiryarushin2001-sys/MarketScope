from __future__ import annotations

import base64
import io
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
import requests
from pydantic import BaseModel, Field


class MenuItem(BaseModel):
    category: Optional[str] = Field(None, description="Категория блюда (супы, салаты, горячее, напитки и т.д.)")
    name: str = Field(description="Название позиции меню")
    price: Optional[float] = Field(None, description="Цена в рублях. Если не указана — null")


class MenuParseResult(BaseModel):
    items: list[MenuItem] = Field(description="Список позиций меню")


def _project_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower().replace("ё", "е"))


def _find_menu_links(source_csv: str, place_name: str) -> tuple[list[str], list[str]]:
    """Ищет ссылки на меню в source_csv по названию заведения. Возвращает (urls, types)."""
    df = pd.read_csv(source_csv, usecols=["название", "меню_ссылки", "меню_типы"], low_memory=False)
    df["_norm"] = df["название"].fillna("").map(_norm)
    target = _norm(place_name)

    row = df[df["_norm"] == target]
    if len(row) == 0:
        row = df[df["_norm"].str.contains(target, regex=False)]
    if len(row) == 0:
        return [], []

    raw_links = str(row.iloc[0]["меню_ссылки"] or "")
    raw_types = str(row.iloc[0]["меню_типы"] or "")

    if not raw_links.strip() or raw_links == "nan":
        return [], []

    urls = [u.strip() for u in raw_links.split("|") if u.strip()]
    types = [t.strip() for t in raw_types.split("|")] if raw_types.strip() and raw_types != "nan" else []

    return urls, types


_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/pdf,image/*,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
}


def _guess_ext(content_type: str, url: str, content_head: bytes) -> str:
    ct = content_type.lower()
    if "pdf" in ct or url.lower().endswith(".pdf"):
        return ".pdf"
    if "png" in ct or url.lower().endswith(".png"):
        return ".png"
    if "jpeg" in ct or "jpg" in ct or url.lower().endswith((".jpeg", ".jpg")):
        return ".jpeg"
    return ".pdf" if b"%PDF" in content_head[:10] else ".jpeg"


def _download_with_playwright(url: str, timeout: int = 30) -> tuple[bytes, str]:
    """Скачивает файл через headless Chromium: проходит JS-верификацию, затем качает."""
    import time as _time
    from urllib.parse import urlparse
    from playwright.sync_api import sync_playwright

    origin = urlparse(url).scheme + "://" + urlparse(url).netloc

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=_BROWSER_HEADERS["User-Agent"],
            accept_downloads=True,
        )
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined})")

        page.goto(origin, wait_until="domcontentloaded", timeout=timeout * 1000)
        _time.sleep(5)

        if "verify" in page.content().lower() or "checking" in page.content().lower():
            _time.sleep(8)

        resp = page.request.get(url, timeout=timeout * 1000)
        content = resp.body()
        ct = resp.headers.get("content-type", "")

        if b"verify" in content[:500].lower() or b"javascript" in content[:500].lower():
            page.goto(url, wait_until="networkidle", timeout=timeout * 1000)
            _time.sleep(3)

            with page.expect_download(timeout=timeout * 1000) as dl_info:
                page.goto(url, timeout=timeout * 1000)
            download = dl_info.value
            tmp = download.path()
            if tmp:
                content = Path(tmp).read_bytes()
                ct = "application/pdf"

        browser.close()

    ext = _guess_ext(ct, url, content)
    return content, ext


def _download_file(url: str, timeout: int = 30) -> tuple[bytes, str]:
    """Скачивает файл. Цепочка: requests → cloudscraper → Playwright."""
    from urllib.parse import urlparse

    origin = urlparse(url).scheme + "://" + urlparse(url).netloc

    resp = requests.get(url, timeout=timeout, headers={
        **_BROWSER_HEADERS, "Referer": origin + "/",
    })

    if resp.status_code in (403, 412):
        try:
            import cloudscraper
            scraper = cloudscraper.create_scraper()
            scraper.headers.update({**_BROWSER_HEADERS, "Referer": origin + "/"})
            scraper.get(origin, timeout=10)
            resp = scraper.get(url, timeout=timeout)
        except ImportError:
            pass

    if resp.status_code in (403, 412):
        print(f"      ↳ requests/cloudscraper не помогли ({resp.status_code}), пробую Playwright…",
              flush=True)
        return _download_with_playwright(url, timeout)

    resp.raise_for_status()
    ext = _guess_ext(
        resp.headers.get("content-type", ""), url, resp.content,
    )
    return resp.content, ext


def _convert_to_images(file_bytes: bytes, ext: str, max_dpi: int = 150) -> list:
    """Конвертирует PDF/изображение в список PIL Image."""
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = 300_000_000

    if ext == ".pdf":
        import fitz  # PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        images = []
        for page in doc:
            pix = page.get_pixmap(dpi=max_dpi)
            images.append(Image.open(io.BytesIO(pix.tobytes("jpeg"))))
        doc.close()
        return images
    else:
        return [Image.open(io.BytesIO(file_bytes))]


def _slice_tall_image(image, max_height: int = 2000, overlap: int = 80) -> list:
    """Нарезает высокое изображение на полосы с перекрытием, чтобы не потерять строки на стыках."""
    w, h = image.size
    if h <= max_height:
        return [image]

    slices = []
    y = 0
    while y < h:
        bottom = min(y + max_height, h)
        slices.append(image.crop((0, y, w, bottom)))
        y = bottom - overlap
        if bottom == h:
            break
    return slices


def _image_to_data_url(image) -> str:
    """Конвертирует PIL Image в base64 data URL для OpenAI-совместимого API."""
    if image.mode in ("RGBA", "P", "LA"):
        image = image.convert("RGB")
    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


_KIDS_KEYWORDS = (
    "детск", "kids", "children", "малыш", "ребён", "ребен",
    "для детей", "kid's", "детям",
)

_MENU_TASK = (
    "Ты — детерминированный экстрактор позиций меню с изображения.\n"
    "Задача: извлечь ВСЕ позиции меню без пропусков.\n\n"

    "ОБХОД СТРАНИЦЫ (важно):\n"
    "1) Сначала найди все заголовки разделов (категории).\n"
    "2) Затем для каждого раздела считай позиции строго сверху вниз.\n"
    "3) Если меню в 2+ колонках: обработай колонки по очереди слева направо, "
    "не смешивая строки из разных колонок.\n"
    "4) Если есть мелкий шрифт/подписи/доп. цены справа — это тоже позиции/варианты, не игнорируй.\n\n"

    "ПРАВИЛА ПОЛЕЙ:\n"
    "- category: точное название раздела как на изображении; если это детский раздел — 'Детское меню'.\n"
    "- name: точное название позиции; если есть размер/объём/граммовка — добавь в name.\n"
    "- price: только число; если цены нет — null; если несколько цен (размеры) — отдельные записи.\n\n"

    "КРИТИЧЕСКОЕ ПРАВИЛО: лучше вернуть лишнюю позицию с price=null, чем пропустить позицию.\n"
)


def _detect_kids_menu(items: list[dict]) -> bool:
    """Определяет наличие детского меню по категориям и названиям позиций."""
    for item in items:
        text = f"{item.get('category', '')} {item.get('name', '')}".lower()
        if any(kw in text for kw in _KIDS_KEYWORDS):
            return True
    return False


def _extract_categories(items: list[dict]) -> list[str]:
    """Извлекает уникальные категории из позиций меню."""
    cats: dict[str, None] = {}
    for item in items:
        cat = (item.get("category") or "").strip()
        if cat and cat not in cats:
            cats[cat] = None
    return list(cats.keys())


def _menu_place_conclusion(entry: dict) -> str:
    status = entry.get("status")
    if status == "no_menu_links":
        return "По заведению не найдено доступных ссылок или файлов меню, поэтому ассортимент в этом блоке не раскрыт."
    if status == "no_api_key":
        urls = len(entry.get("menu_urls") or [])
        return f"Источники меню найдены ({urls}), но без ключа парсинг не выполнен, поэтому сравнение ассортимента ограничено."

    items_count = int(entry.get("items_count") or 0)
    categories = entry.get("categories") or []
    kids = bool(entry.get("has_kids_menu"))
    if items_count >= 60:
        breadth = "широкое"
    elif items_count >= 25:
        breadth = "сбалансированное"
    else:
        breadth = "компактное"
    kids_text = "Есть детское меню." if kids else "Детское меню не подтверждено."
    return (
        f"Меню выглядит как {breadth}: {items_count} позиций в {len(categories)} категориях. "
        f"{kids_text}"
    )


def _menu_block_conclusion(menu_by_place: dict[str, dict]) -> str:
    total = len(menu_by_place)
    parsed_entries = [entry for entry in menu_by_place.values() if entry.get("status") == "parsed"]
    if not parsed_entries:
        return (
            f"В блоке меню обработано {total} заведений, но структурированные данные меню не получены, "
            "поэтому глубоко сравнить ассортимент пока нельзя."
        )

    with_kids = sum(1 for entry in parsed_entries if entry.get("has_kids_menu"))
    avg_items = round(sum(int(entry.get("items_count") or 0) for entry in parsed_entries) / len(parsed_entries))
    dense = sum(1 for entry in parsed_entries if int(entry.get("items_count") or 0) >= 60)
    compact = sum(1 for entry in parsed_entries if int(entry.get("items_count") or 0) < 25)

    return (
        f"Данные меню собраны по {len(parsed_entries)} из {total} заведений; в среднем это около {avg_items} позиций на игрока. "
        f"Широкие меню встречаются у {dense} заведений, компактные у {compact}, детское меню подтверждено у {with_kids}, "
        "поэтому в нише заметен разброс между гастрономическими и более утилитарными форматами."
    )


def _build_market_context_block2(menu_by_place: dict[str, dict]) -> str:
    if not menu_by_place:
        return "Данные меню по заведениям отсутствуют."

    blocks = []
    for idx, (name, entry) in enumerate(menu_by_place.items(), 1):
        status = entry.get("status") or "unknown"
        menu_urls = entry.get("menu_urls") or []
        lines = [
            f"{idx}. {name}",
            f"   Статус: {status}",
            f"   Источников меню: {len(menu_urls)}",
        ]

        if status == "parsed":
            items = entry.get("items") or []
            prices = [
                float(item["price"])
                for item in items
                if isinstance(item.get("price"), (int, float))
            ]
            category_counts: dict[str, int] = {}
            for item in items:
                category = str(item.get("category") or "").strip() or "Без категории"
                category_counts[category] = category_counts.get(category, 0) + 1
            top_categories = sorted(category_counts.items(), key=lambda x: (-x[1], x[0]))[:5]
            top_categories_text = ", ".join(f"{cat} ({count})" for cat, count in top_categories) or "не выделены"
            price_text = (
                f"{round(min(prices))}-{round(max(prices))}₽"
                if prices else "нет цен"
            )
            lines.extend([
                f"   Позиций: {entry.get('items_count') or 0}",
                f"   Категорий: {len(entry.get('categories') or [])}",
                f"   Топ-категории: {top_categories_text}",
                f"   Детское меню: {'да' if entry.get('has_kids_menu') else 'нет'}",
                f"   Диапазон цен по найденным позициям: {price_text}",
            ])
        else:
            lines.append("   Разбор структуры меню не выполнен.")

        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_market_llm_analysis(
    menu_by_place: dict[str, dict],
    query_context: str,
    api_key: str,
    model: str,
) -> str:
    fallback_overall = _menu_block_conclusion(menu_by_place)
    fallback_by_name = {
        name: _menu_place_conclusion(entry)
        for name, entry in menu_by_place.items()
    }

    for name, summary in fallback_by_name.items():
        menu_by_place[name]["вывод"] = summary

    if not api_key or not menu_by_place:
        return fallback_overall

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from restaurant_pipeline.blocks.market_llm import apply_block_analysis, call_market_block_llm
    from restaurant_pipeline.blocks.block2_menu.prompts_market import SYSTEM, USER_TEMPLATE

    try:
        analysis = call_market_block_llm(
            system_prompt=SYSTEM,
            user_prompt=USER_TEMPLATE.format(
                query_context=query_context or "не указан",
                block_context=_build_market_context_block2(menu_by_place),
            ),
            api_key=api_key,
            model=model,
        )
        return apply_block_analysis(
            place_names=list(menu_by_place.keys()),
            analysis=analysis,
            per_place_setter=lambda name, summary: menu_by_place[name].__setitem__("вывод", summary),
            fallback_per_place=fallback_by_name,
            fallback_overall=fallback_overall,
        )
    except Exception as e:
        print(f"[block2] Market LLM analysis fallback: {e}", flush=True)
        return fallback_overall


ITEMS_PER_CATEGORY_LIMIT = 10


def _build_single_place_context_block2(menu_by_place: dict[str, dict], place_name: str) -> str:
    """Контекст для одного заведения: до 10 позиций на категорию."""
    entry = menu_by_place.get(place_name)
    if not entry:
        return ""
    status = entry.get("status") or "unknown"
    if status != "parsed":
        return f"Статус: {status}. Разбор меню не выполнен."

    items = entry.get("items") or []
    if not items:
        return "Позиций: 0. Меню пустое."

    # Группируем по категориям, считаем всего и берём до 10 примеров на категорию
    cat_total: dict[str, int] = {}
    cat_samples: dict[str, list[dict]] = {}
    for it in items:
        cat = str(it.get("category") or "").strip() or "Без категории"
        cat_total[cat] = cat_total.get(cat, 0) + 1
        if cat not in cat_samples:
            cat_samples[cat] = []
        if len(cat_samples[cat]) < ITEMS_PER_CATEGORY_LIMIT:
            cat_samples[cat].append(it)

    prices = [float(i["price"]) for i in items if isinstance(i.get("price"), (int, float))]
    price_txt = f"{round(min(prices))}-{round(max(prices))}₽" if prices else "нет цен"

    lines = [
        f"Позиций всего: {entry.get('items_count') or len(items)}",
        f"Категорий: {len(cat_total)}",
        f"Детское меню: {'да' if entry.get('has_kids_menu') else 'нет'}",
        f"Диапазон цен: {price_txt}",
        "",
        "Примеры позиций по категориям (до 10 на категорию):",
    ]
    for cat in sorted(cat_total.keys(), key=lambda c: (-cat_total[c], c)):
        total = cat_total[cat]
        samples = cat_samples[cat]
        lines.append(f"\n  {cat} ({total} позиций):")
        for it in samples:
            p = it.get("price")
            p_str = f"{round(p)}₽" if isinstance(p, (int, float)) else "—"
            lines.append(f"    - {it.get('name', '?')} — {p_str}")
    return "\n".join(lines)


def _build_competitive_context_block2(menu_by_place: dict[str, dict], ref_name: str) -> str:
    """Контекст для competitive LLM: меню по заведениям с пометкой [ОПОРНОЕ]."""
    if not menu_by_place:
        return "Данные меню отсутствуют."

    blocks = []
    ref_key = str(ref_name).strip().lower()
    for idx, (name, entry) in enumerate(menu_by_place.items(), 1):
        is_ref = str(name).strip().lower() == ref_key or entry.get("is_reference_place")
        tag = " [ОПОРНОЕ]" if is_ref else ""
        status = entry.get("status") or "unknown"
        lines = [f"{idx}. {name}{tag}", f"   Статус: {status}"]
        if status == "parsed":
            items = entry.get("items") or []
            prices = [float(i["price"]) for i in items if isinstance(i.get("price"), (int, float))]
            cat_counts: dict[str, int] = {}
            for item in items:
                cat = str(item.get("category") or "").strip() or "Без категории"
                cat_counts[cat] = cat_counts.get(cat, 0) + 1
            top_cats = sorted(cat_counts.items(), key=lambda x: (-x[1], x[0]))[:5]
            top_cats_txt = ", ".join(f"{c} ({n})" for c, n in top_cats) or "не выделены"
            price_txt = f"{round(min(prices))}-{round(max(prices))}₽" if prices else "нет цен"
            lines.extend([
                f"   Позиций: {entry.get('items_count') or 0}",
                f"   Категорий: {len(entry.get('categories') or [])}",
                f"   Топ-категории: {top_cats_txt}",
                f"   Детское меню: {'да' if entry.get('has_kids_menu') else 'нет'}",
                f"   Диапазон цен: {price_txt}",
            ])
        else:
            lines.append("   Разбор структуры меню не выполнен.")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _apply_competitive_llm_analysis_block2(
    menu_by_place: dict[str, dict],
    ref_name: str,
    api_key: str,
    model: str,
) -> str:
    """Краткие выводы по заведениям + подробный по опорному. Возвращает вывод_по_опорному."""
    fallback_per_place = {name: _menu_place_conclusion(entry) for name, entry in menu_by_place.items()}
    fallback_ref = (
        f"По меню опорного заведения «{ref_name}» в выборке из {len(menu_by_place)} заведений. "
        "Для детального сравнительного вывода нужен LLM."
    )
    for name, summary in fallback_per_place.items():
        menu_by_place[name]["вывод"] = summary

    if not api_key or not menu_by_place or not ref_name:
        return fallback_ref

    project_root = _project_root()
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    try:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block2_menu.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )
    except ImportError:
        from restaurant_pipeline.blocks.competitive_llm import apply_competitive_per_place_then_compare
        from restaurant_pipeline.blocks.block2_menu.prompts_competitive import (
            PER_PLACE_SYSTEM,
            PER_PLACE_USER_TEMPLATE,
            COMPARISON_SYSTEM,
            COMPARISON_USER_TEMPLATE,
        )

    try:
        return apply_competitive_per_place_then_compare(
            place_names=list(menu_by_place.keys()),
            build_single_place_context=lambda name: _build_single_place_context_block2(menu_by_place, name),
            ref_name=ref_name,
            per_place_system=PER_PLACE_SYSTEM,
            per_place_user_template=PER_PLACE_USER_TEMPLATE,
            comparison_system=COMPARISON_SYSTEM,
            comparison_user_template=COMPARISON_USER_TEMPLATE,
            api_key=api_key,
            model=model,
            per_place_setter=lambda n, s: menu_by_place[n].__setitem__("вывод", s),
            fallback_per_place=fallback_per_place,
            fallback_ref_summary=fallback_ref,
        )
    except Exception as e:
        print(f"[block2] Competitive LLM analysis fallback: {e}", flush=True)
        return fallback_ref


def _parse_menu_images(
    images: list,
    api_key: str
    # model: str = "qwen/qwen3-vl-235b-a22b-thinking" ,
) -> list[dict]:
    """Отправляет изображения в OpenRouter (Vision) через LangChain, возвращает список позиций меню."""
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage
    from langchain_core.output_parsers import PydanticOutputParser

    parser = PydanticOutputParser(pydantic_object=MenuParseResult)
    prompt = _MENU_TASK + parser.get_format_instructions()

    llm = ChatOpenAI(
    model="openai/gpt-4o",          # или переменная model
    api_key=api_key,                      # <-- ключ OpenRouter
    base_url="https://openrouter.ai/api/v1",
    temperature=0.0,                      # для извлечения лучше 0
    max_tokens=4096,
    default_headers={
        "HTTP-Referer": "https://your-app.example",      # рекомендуется
        "X-OpenRouter-Title": "menu-parser",             # рекомендуется (иногда X-Title)
    },
)

    all_items: list[dict] = []

    for image in images:
        data_url = _image_to_data_url(image)

        message = HumanMessage(content=[
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": prompt},
        ])

        response = llm.invoke([message])
        content = response.content if hasattr(response, "content") else str(response)

        # Убираем блоки <think>...</think> у thinking-моделей
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()

        try:
            result: MenuParseResult = parser.parse(content)
            all_items.extend(item.model_dump() for item in result.items)
        except Exception:
            try:
                match = re.search(r"\{.*\}", content, re.DOTALL)
                if match:
                    result = parser.parse(match.group(0))
                    all_items.extend(item.model_dump() for item in result.items)
                else:
                    match_arr = re.search(r"\[.*\]", content, re.DOTALL)
                    if match_arr:
                        raw = json.loads(match_arr.group(0))
                        all_items.extend(raw)
            except Exception:
                pass

    return all_items


def _dump_images_to_tmp(images: list, place_name: str, file_idx: int, tmp_dir: Path) -> None:
    """Сохраняет сконвертированные изображения в tmp/ для отладки."""
    safe_name = re.sub(r"[^\w\-]", "_", place_name)
    place_dir = tmp_dir / safe_name
    place_dir.mkdir(parents=True, exist_ok=True)
    for page_idx, img in enumerate(images):
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        path = place_dir / f"file{file_idx}_page{page_idx}.jpg"
        img.save(path, format="JPEG", quality=90)
    print(f"    Изображения сохранены: {place_dir}/")


def _collect_reference_menu_sources(place: dict) -> list[str]:
    """Собирает URL/пути к меню из карточки reference_place."""
    sources = []

    menu_files = place.get("menu_files")
    if isinstance(menu_files, list):
        for p in menu_files:
            p = str(p).strip()
            if p:
                sources.append(p)

    for key in ("menu_file", "menu_url"):
        val = (place.get(key) or "").strip()
        if val and val not in sources:
            sources.append(val)

    return sources


def run(input_json_path: str, output_json_path: str, dump_images: bool = False, only: str | None = None) -> dict:
    root = _project_root()

    with open(input_json_path, "r", encoding="utf-8") as f:
        block1 = json.load(f)

    try:
        from dotenv import load_dotenv
        load_dotenv(root / ".env")
    except Exception:
        pass

    is_market = block1.get("report_type") == "market"
    is_competitive = block1.get("report_type") == "competitive"
    ref_name = str((block1.get("reference_place") or {}).get("name") or "").strip()
    competitive_api_key = os.environ.get("PPLX_API_KEY", "") if is_competitive else ""
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    market_api_key = os.environ.get("PPLX_API_KEY", "")
    perplexity_model = block1.get("perplexity_model", "sonar")
    source_csv = block1.get("source_csv", str(root / "final_blyat_v3.csv"))
    query_context = str(block1.get("query_context") or "").strip()
    places = block1.get("selected_places", [])

    tmp_dir = Path(output_json_path).parent / "tmp_menu_images"
    if dump_images:
        tmp_dir.mkdir(parents=True, exist_ok=True)
        print(f"  [dump-images] Сохранение в {tmp_dir}")

    if only:
        places = [p for p in places if only.lower() in (p.get("название") or "").lower()]
        if not places:
            print(f"  Заведение «{only}» не найдено в block1_output")

    menu_by_place: dict[str, dict] = {}

    for i, place in enumerate(places, 1):
        name = place.get("название", f"place_{i}")
        is_ref = place.get("is_reference_place", False)
        print(f"  [{i}/{len(places)}] Меню «{name}»{'  [reference]' if is_ref else ''}...", flush=True)

        if is_ref:
            ref_urls = _collect_reference_menu_sources(place)
            if not ref_urls:
                print(f"    Нет файлов/URL меню для опорного заведения")
                menu_by_place[name] = {
                    "status": "no_menu_links",
                    "items": [],
                    "is_reference_place": True,
                }
                if is_market or is_competitive:
                    menu_by_place[name]["вывод"] = _menu_place_conclusion({"status": "no_menu_links", "items": []})
                continue
            urls, types = ref_urls, ["user_provided"] * len(ref_urls)
        else:
            urls, types = _find_menu_links(source_csv, name)
            if not urls:
                print(f"    Нет ссылок на меню в базе")
                menu_by_place[name] = {
                    "status": "no_menu_links",
                    "items": [],
                }
                if is_market or is_competitive:
                    menu_by_place[name]["вывод"] = _menu_place_conclusion({"status": "no_menu_links", "items": []})
                continue

        if not api_key:
            print(f"    Нет OPENROUTER_API_KEY — пропуск")
            entry = {
                "status": "no_api_key",
                "menu_urls": urls,
                "items": [],
            }
            if is_market or is_competitive:
                entry["вывод"] = _menu_place_conclusion({
                    "status": "no_api_key",
                    "menu_urls": urls,
                    "items": [],
                })
            if is_ref:
                entry["is_reference_place"] = True
            menu_by_place[name] = entry
            continue

        all_items = []
        for j, url in enumerate(urls):
            file_type = types[j] if j < len(types) else "unknown"
            print(f"    [{j+1}/{len(urls)}] {file_type}: {url[:80]}...")

            try:
                if url.startswith("/") or url.startswith("."):
                    file_bytes = Path(url).read_bytes()
                    ext = Path(url).suffix.lower()
                    if ext not in (".pdf", ".png", ".jpg", ".jpeg"):
                        ext = ".pdf" if b"%PDF" in file_bytes[:10] else ".jpeg"
                else:
                    file_bytes, ext = _download_file(url)

                raw_images = _convert_to_images(file_bytes, ext)
                images = []
                for img in raw_images:
                    images.extend(_slice_tall_image(img))
                print(f"    Страниц/изображений: {len(raw_images)} → {len(images)} (после нарезки)")
                if dump_images:
                    _dump_images_to_tmp(images, name, j, tmp_dir)
                items = _parse_menu_images(images, api_key)
                print(f"    Позиций найдено: {len(items)}")
                all_items.extend(items)
            except Exception as e:
                print(f"    Ошибка: {e}")

        entry = {
            "status": "parsed",
            "menu_urls": urls,
            "items_count": len(all_items),
            "has_kids_menu": _detect_kids_menu(all_items),
            "categories": _extract_categories(all_items),
            "items": all_items,
        }
        if is_market or is_competitive:
            entry["вывод"] = _menu_place_conclusion(entry)
        if is_ref:
            entry["is_reference_place"] = True
        menu_by_place[name] = entry

    payload = {
        "block": "block2_menu",
        "source_csv": source_csv,
        "menu_by_place": menu_by_place,
    }
    if is_market:
        payload["общий_вывод"] = _apply_market_llm_analysis(
            menu_by_place,
            query_context=query_context,
            api_key=market_api_key,
            model=perplexity_model,
        )
    elif is_competitive and menu_by_place:
        if not competitive_api_key:
            print("[block2] ⚠ PPLX_API_KEY не задан — LLM-анализ пропущен, используются fallback-выводы", flush=True)
        payload["вывод_по_опорному"] = _apply_competitive_llm_analysis_block2(
            menu_by_place,
            ref_name=ref_name,
            api_key=competitive_api_key,
            model=perplexity_model,
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
    parser.add_argument("--dump-images", action="store_true", help="Сохранить конвертированные изображения в tmp/")
    parser.add_argument("--only", type=str, default=None, help="Обработать только заведение с этим названием")
    args = parser.parse_args()
    run(args.input, args.output, dump_images=args.dump_images, only=args.only)
