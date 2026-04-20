import time as t
import argparse
import json
import random
import re
import time
from pathlib import Path
from urllib.parse import quote_plus


import pandas as pd
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoSuchElementException, TimeoutException, StaleElementReferenceException


# Парсер отзывов (открывает свою страницу по org_id)
from yandex_reviews_parser.utils import YandexParser
from yandex_reviews_parser.parsers import Parser
from yandex_reviews_parser.helpers import ParserHelper
from yandex_reviews_parser.storage import Review
from dataclasses import asdict



# --- запасные селекторы для текста отзыва (Яндекс мог изменить разметку) ---
REVIEW_TEXT_SELECTORS = [
    ".//span[@class='business-review-view__body-text']",
    ".//*[contains(@class, 'business-review-view__body-text')]",
    ".//*[contains(@class, 'body-text')]",
    ".//div[contains(@class, 'business-review-view')]//span[contains(@class, 'text')]",
    ".//span[contains(@class, 'business-review-view') and contains(@class, 'body')]",
    ".//div[contains(@class, 'review-view')]//*[contains(@class, 'text')]",
    ".//*[@itemprop='reviewBody']",
]



# Текст кнопок/ссылок, который не является текстом отзыва — отбрасываем
REVIEW_TEXT_JUNK = frozenset({
    "подписаться", "ответить", "поделиться", "читать далее", "развернуть",
    "свернуть", "subscribe", "reply", "share", "ещё", "еще",
})
MIN_REVIEW_TEXT_LEN = 15  # короче — скорее всего не отзыв
SKIP_ANSWER_PARSING = True  # ответы заведения не парсим (лишние клики, не нужны)



def _is_valid_review_text(t: str) -> bool:
    """Проверяет, что строка похожа на текст отзыва, а не на подпись кнопки."""
    if not t or len(t) < MIN_REVIEW_TEXT_LEN:
        return False
    lower = t.strip().lower()
    if lower in REVIEW_TEXT_JUNK:
        return False
    if len(lower.split()) <= 2 and lower in {"показать ещё", "показать еще"}:
        return False
    return True



def _get_review_text_with_fallbacks(elem, driver=None, by=By.XPATH) -> str | None:
    """Пробует несколько селекторов для текста отзыва. При необходимости кликает «Читать далее»."""
    if driver is not None:
        try:
            expand_btns = elem.find_elements(
                by,
                ".//*[contains(text(), 'Читать далее') or contains(text(), 'Развернуть') or contains(@class, 'expand')]",
            )
            for btn in expand_btns:
                try:
                    driver.execute_script("arguments[0].click();", btn)
                    time.sleep(0.2)
                except Exception:
                    pass
        except NoSuchElementException:
            pass


    for selector in REVIEW_TEXT_SELECTORS:
        try:
            el = elem.find_element(by, selector)
            if el:
                text = (el.text or "").strip()
                if text and _is_valid_review_text(text):
                    return text
        except NoSuchElementException:
            continue
    return None



def _patched_get_data_item(self, elem):
    """Версия __get_data_item с запасными селекторами для текста отзыва."""
    try:
        name = elem.find_element(By.XPATH, ".//span[@itemprop='name']").text
    except NoSuchElementException:
        name = None


    try:
        icon_href = elem.find_element(By.XPATH, ".//div[@class='user-icon-view__icon']").get_attribute("style")
        icon_href = icon_href.split('"')[1] if icon_href else None
    except NoSuchElementException:
        icon_href = None


    try:
        date = elem.find_element(By.XPATH, ".//meta[@itemprop='datePublished']").get_attribute("content")
    except NoSuchElementException:
        date = None


    text = _get_review_text_with_fallbacks(elem, driver=self.driver)
    if not text:
        text = None


    try:
        stars = elem.find_elements(By.XPATH, ".//div[contains(@class, 'business-rating-badge-view__stars')]/span")
        stars = ParserHelper.get_count_star(stars)
    except Exception:
        stars = 0


    answer = ""
    if not SKIP_ANSWER_PARSING:
        try:
            answer_btn = elem.find_element(By.CLASS_NAME, "business-review-view__comment-expand")
            if answer_btn:
                self.driver.execute_script("arguments[0].click()", answer_btn)
                time.sleep(0.3)
                answer = elem.find_element(By.CLASS_NAME, "business-review-comment-content__bubble").text
        except NoSuchElementException:
            pass


    try:
        date_ts = ParserHelper.form_date(date) if (date and str(date).strip()) else 0.0
    except Exception:
        date_ts = 0.0


    return asdict(
        Review(
            name=name or "",
            icon_href=icon_href,
            date=date_ts,
            text=text or "",
            stars=stars,
            answer=answer if answer is not None else "",
        )
    )



# Подменяем метод парсера отзывов, чтобы текст извлекался запасными селекторами
Parser._Parser__get_data_item = _patched_get_data_item  # noqa: SLF001



# Увеличиваем ожидание после открытия страницы отзывов (меньше «Страница не найдена»)
_original_open_page = YandexParser._YandexParser__open_page  # noqa: SLF001



def _patched_open_page(self):
    parser = _original_open_page(self)
    time.sleep(5)  # доп. пауза для загрузки контента
    return parser



YandexParser._YandexParser__open_page = _patched_open_page  # noqa: SLF001



# --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: скроллим только пока не собрали MAX_REVIEWS_PER_PLACE ---
_original_scroll_to_bottom = Parser._Parser__scroll_to_bottom  # noqa: SLF001



def _patched_scroll_to_bottom(self, elem):
    """Скроллит лениво-грузящийся список отзывов до лимита, а не до «дна» страницы."""
    target = int(globals().get("MAX_REVIEWS_PER_PLACE", 100))
    cls = "business-reviews-card-view__review"


    stable_iters = 0
    last_len = 0


    while True:
        elements = self.driver.find_elements(By.CLASS_NAME, cls)
        cur_len = len(elements)


        if cur_len >= target:
            return


        # Если список не растёт несколько итераций подряд — выходим
        if cur_len == last_len:
            stable_iters += 1
            if stable_iters >= 3:
                return
        else:
            stable_iters = 0
            last_len = cur_len


        if not elements:
            return


        anchor = elements[-1]
        self.driver.execute_script("arguments[0].scrollIntoView({block:'end'});", anchor)


        # Ждём, пока догрузится следующая порция отзывов
        try:
            WebDriverWait(self.driver, 8).until(
                lambda d: len(d.find_elements(By.CLASS_NAME, cls)) > cur_len
            )
        except TimeoutException:
            # Не догрузилось — цикл сам завершится по stable_iters
            pass



Parser._Parser__scroll_to_bottom = _patched_scroll_to_bottom  # noqa: SLF001



# --- константы ---
DEFAULT_CSV = "final_blyat_v3.csv"
DEFAULT_OUTPUT = "yandex_reviews_results.json"
DELAY_BETWEEN_PLACES = (8, 15)  # рандомная задержка между заведениями (мин, макс секунд)
MAX_REVIEWS_PER_PLACE = 100
SEARCH_WAIT_TIMEOUT = 15



def extract_org_id_from_url(href: str) -> str | None:
    """
    Из ссылки на организацию в Яндекс Картах извлекает числовой org_id.
    Примеры: /maps/org/123456/ или /maps/org/novy-ton/95413856541/
    """
    if not href or "/org/" not in href:
        return None
    match = re.search(r"/org/(?:[^/]+/)*(\d+)/?", href)
    return match.group(1) if match else None



def search_yandex_maps_and_get_org_id(driver: uc.Chrome, query: str, max_retries: int = 3) -> str | None:
    """
    Открывает Яндекс Карты, вводит запрос (название + адрес), возвращает org_id первого результата.
    Защита от StaleElementReferenceException через повторный поиск элементов.
    """
    search_url = "https://yandex.ru/maps/?text=" + quote_plus(query.strip())
    driver.get(search_url)

    wait = WebDriverWait(driver, SEARCH_WAIT_TIMEOUT)
    try:
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='/org/']")))
    except Exception:
        return None

    # Дополнительная пауза для стабилизации DOM
    time.sleep(2)

    for attempt in range(max_retries):
        try:
            # Каждый раз заново ищем элементы (защита от stale element)
            links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/org/']")
            
            for i in range(len(links)):
                try:
                    # Повторно получаем список на каждой итерации
                    links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/org/']")
                    if i >= len(links):
                        break
                    
                    href = links[i].get_attribute("href") or ""
                    org_id = extract_org_id_from_url(href)
                    if org_id:
                        return org_id
                except StaleElementReferenceException:
                    # Пропускаем этот элемент, продолжаем со следующего
                    continue
            
            # Если дошли сюда и ничего не нашли, выходим
            return None
            
        except StaleElementReferenceException:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            return None
    
    return None



def parse_reviews_for_place(
    place_name: str,
    place_address: str,
    org_id: str,
    *,
    max_retries: int = 2,
    retry_delay: float = 6.0,
) -> dict:
    """
    Парсит отзывы по org_id через yandex-reviews-parser. Возвращает не более MAX_REVIEWS_PER_PLACE отзывов.
    При «Страница не найдена» повторяет попытку до max_retries раз с паузой retry_delay.
    """
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            parser = YandexParser(int(org_id))
            data = parser.parse(type_parse="default")
        except Exception as e:
            last_error = str(e)
            if attempt < max_retries:
                time.sleep(retry_delay)
            continue


        if "error" in data and data["error"] == "Страница не найдена":
            last_error = data["error"]
            if attempt < max_retries:
                time.sleep(retry_delay)
            continue


        if "error" in data:
            return {
                "place_name": place_name,
                "place_address": place_address,
                "org_id": org_id,
                "error": data["error"],
                "company_info": data.get("company_info"),
                "reviews": [],
            }


        reviews = data.get("company_reviews") or []
        reviews = reviews[:MAX_REVIEWS_PER_PLACE]
        return {
            "place_name": place_name,
            "place_address": place_address,
            "org_id": org_id,
            "error": None,
            "company_info": data.get("company_info"),
            "reviews": reviews,
        }


    return {
        "place_name": place_name,
        "place_address": place_address,
        "org_id": org_id,
        "error": last_error or "Страница не найдена",
        "company_info": None,
        "reviews": [],
    }



def main():
    parser = argparse.ArgumentParser(description="Парсинг отзывов Яндекс Карт по CSV заведений")
    parser.add_argument(
        "--csv",
        default=DEFAULT_CSV,
        help=f"Путь к CSV с колонками название, адрес (по умолчанию: {DEFAULT_CSV})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"Файл для сохранения результатов (по умолчанию: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Обработать только первые N заведений (для теста)",
    )
    parser.add_argument(
        "--start",
        type=int,
        default=0,
        help="Начать с строки N (для дозаписи/продолжения)",
    )
    parser.add_argument(
        "--chrome-version",
        type=int,
        default=145,
        help="Мажорная версия Chrome (например 145). Должна совпадать с установленной. По умолчанию 145.",
    )
    parser.add_argument(
        "--save-page",
        metavar="FILE",
        default=None,
        help=(
            "Сохранить HTML страницы отзывов в файл (для первого заведения). "
            "Открой в браузере и найди класс блока с текстом отзыва."
        ),
    )
    parser.add_argument(
        "--profile-dir",
        default=str(Path.home() / ".chrome_yandex_profile"),
        help="Папка профиля Chrome (куки сохраняются между запусками). По умолчанию ~/.chrome_yandex_profile",
    )
    args = parser.parse_args()


    profile_dir = Path(args.profile_dir)
    profile_dir.mkdir(parents=True, exist_ok=True)

    _chrome_version = args.chrome_version
    _original_chrome_init = uc.Chrome.__init__

    def _patched_chrome_init(self, *args_init, **kwargs):
        kwargs.setdefault("version_main", _chrome_version)
        _original_chrome_init(self, *args_init, **kwargs)

    uc.Chrome.__init__ = _patched_chrome_init


    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"Файл не найден: {csv_path}")
        return 1


    df = pd.read_csv(csv_path)
    if "название" not in df.columns or "адрес" not in df.columns:
        print("В CSV должны быть колонки 'название' и 'адрес'.")
        return 1


    # срез по --start и --limit
    df = df.iloc[args.start:]
    if args.limit is not None:
        df = df.head(args.limit)


    total = len(df)
    print(f"Обработка {total} заведений (старт с индекса {args.start}). Результат: {args.output}")
    print(f"Профиль Chrome: {profile_dir}")

    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-data-dir={profile_dir}")


    # --- УСКОРЕНИЕ: отключаем загрузку тяжелых ресурсов (картинки) ---
    prefs = {
        "profile.managed_default_content_settings.images": 2,
    }
    options.add_experimental_option("prefs", prefs)
    # На некоторых сборках Chrome дополнительно помогает:
    options.add_argument("--blink-settings=imagesEnabled=false")


    # headless при желании можно включить; иногда поиск ведёт себя иначе
    # options.add_argument("--headless=new")


    results = []
    print(
        f"Используется ChromeDriver для Chrome {args.chrome_version} "
        "(укажи --chrome-version N, если версия другая)."
    )


    with uc.Chrome(options=options) as driver:
        for num, (_, row) in enumerate(df.iterrows(), start=1):
            name = str(row["название"]).strip() if pd.notna(row["название"]) else ""
            address = str(row["адрес"]).strip() if pd.notna(row["адрес"]) else ""
            if not name and not address:
                print(f"  [{num}/{total}] Пропуск: нет названия и адреса")
                continue


            query = f"{name} {address}".strip()
            print(f"  [{num}/{total}] {name[:50]}...")
            t0 = t.time()
            org_id = search_yandex_maps_and_get_org_id(driver, query)
            
            # --- НОВАЯ ЛОГИКА: повторный поиск с добавлением "Москва" ---
            if not org_id:
                print(f"      Первый поиск не дал результатов, пробую с добавлением 'Москва'...")
                query_with_city = f"{name} Москва".strip()
                org_id = search_yandex_maps_and_get_org_id(driver, query_with_city)
            
            print(f"      Поиск: {t.time()-t0:.1f} с")
            
            if not org_id:
                print(f"      Не найдено в Яндекс Картах даже с 'Москва': {name[:60]}...")
                results.append({
                    "place_name": name,
                    "place_address": address,
                    "org_id": None,
                    "error": "Организация не найдена в поиске",
                    "company_info": None,
                    "reviews": [],
                })
                delay = random.uniform(*DELAY_BETWEEN_PLACES)
                print(f"      Пауза {delay:.1f} с...")
                time.sleep(delay)
                continue


            # По желанию сохраняем HTML страницы отзывов для поиска нужного блока (один раз)
            if args.save_page and not results:
                save_path = Path(args.save_page)
                print(f"      Сохраняю HTML страницы отзывов в {save_path}...")
                try:
                    driver.get(f"https://yandex.ru/maps/org/{org_id}/reviews/")
                    time.sleep(6)
                    save_path.write_text(driver.page_source, encoding="utf-8")
                    print("      Готово. Открой файл в браузере/редакторе и найди класс блока с текстом отзыва.")
                except Exception as e:
                    print(f"      Ошибка сохранения HTML: {e}")


            print(f"      org_id={org_id}, парсинг отзывов (<= {MAX_REVIEWS_PER_PLACE})...")
            t1 = t.time()
            place_result = parse_reviews_for_place(name, address, org_id)
            print(f"      Парсинг: {t.time()-t1:.1f} с")
            results.append(place_result)
            n_reviews = len(place_result.get("reviews") or [])
            print(f"      Отзывов: {n_reviews}")

            delay = random.uniform(*DELAY_BETWEEN_PLACES)
            print(f"      Пауза {delay:.1f} с...")
            time.sleep(delay)


    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


    print(f"Готово. Результаты сохранены в {out_path}")
    return 0



if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Парсинг отзывов с Яндекс Карт по заведениям из CSV.

Для каждого заведения: поиск в Яндекс Картах по названию и адресу,
извлечение org_id, парсинг отзывов (топ 100). Результаты сохраняются в отдельный файл.

Изменения (ускорение без потери функциональности):
- Скролл на странице отзывов останавливается, когда собрано >= MAX_REVIEWS_PER_PLACE карточек.
- Отключена загрузка тяжелых ресурсов (картинки) в основном драйвере поиска.
"""

# import time as t
# import argparse
# import json
# import re
# import time
# from pathlib import Path
# from urllib.parse import quote_plus

# import pandas as pd
# import undetected_chromedriver as uc
# from selenium.webdriver.common.by import By
# from selenium.webdriver.support import expected_conditions as EC
# from selenium.webdriver.support.ui import WebDriverWait
# from selenium.common.exceptions import NoSuchElementException, TimeoutException

# # Парсер отзывов (открывает свою страницу по org_id)
# from yandex_reviews_parser.utils import YandexParser
# from yandex_reviews_parser.parsers import Parser
# from yandex_reviews_parser.helpers import ParserHelper
# from yandex_reviews_parser.storage import Review
# from dataclasses import asdict


# # --- запасные селекторы для текста отзыва (Яндекс мог изменить разметку) ---
# REVIEW_TEXT_SELECTORS = [
#     ".//span[@class='business-review-view__body-text']",
#     ".//*[contains(@class, 'business-review-view__body-text')]",
#     ".//*[contains(@class, 'body-text')]",
#     ".//div[contains(@class, 'business-review-view')]//span[contains(@class, 'text')]",
#     ".//span[contains(@class, 'business-review-view') and contains(@class, 'body')]",
#     ".//div[contains(@class, 'review-view')]//*[contains(@class, 'text')]",
#     ".//*[@itemprop='reviewBody']",
# ]


# # Текст кнопок/ссылок, который не является текстом отзыва — отбрасываем
# REVIEW_TEXT_JUNK = frozenset({
#     "подписаться", "ответить", "поделиться", "читать далее", "развернуть",
#     "свернуть", "subscribe", "reply", "share", "ещё", "еще",
# })
# MIN_REVIEW_TEXT_LEN = 15  # короче — скорее всего не отзыв
# SKIP_ANSWER_PARSING = True  # ответы заведения не парсим (лишние клики, не нужны)


# def _is_valid_review_text(t: str) -> bool:
#     """Проверяет, что строка похожа на текст отзыва, а не на подпись кнопки."""
#     if not t or len(t) < MIN_REVIEW_TEXT_LEN:
#         return False
#     lower = t.strip().lower()
#     if lower in REVIEW_TEXT_JUNK:
#         return False
#     if len(lower.split()) <= 2 and lower in {"показать ещё", "показать еще"}:
#         return False
#     return True


# def _get_review_text_with_fallbacks(elem, driver=None, by=By.XPATH) -> str | None:
#     """Пробует несколько селекторов для текста отзыва. При необходимости кликает «Читать далее»."""
#     if driver is not None:
#         try:
#             expand_btns = elem.find_elements(
#                 by,
#                 ".//*[contains(text(), 'Читать далее') or contains(text(), 'Развернуть') or contains(@class, 'expand')]",
#             )
#             for btn in expand_btns:
#                 try:
#                     driver.execute_script("arguments[0].click();", btn)
#                     time.sleep(0.2)
#                 except Exception:
#                     pass
#         except NoSuchElementException:
#             pass

#     for selector in REVIEW_TEXT_SELECTORS:
#         try:
#             el = elem.find_element(by, selector)
#             if el:
#                 text = (el.text or "").strip()
#                 if text and _is_valid_review_text(text):
#                     return text
#         except NoSuchElementException:
#             continue
#     return None


# def _patched_get_data_item(self, elem):
#     """Версия __get_data_item с запасными селекторами для текста отзыва."""
#     try:
#         name = elem.find_element(By.XPATH, ".//span[@itemprop='name']").text
#     except NoSuchElementException:
#         name = None

#     try:
#         icon_href = elem.find_element(By.XPATH, ".//div[@class='user-icon-view__icon']").get_attribute("style")
#         icon_href = icon_href.split('"')[1] if icon_href else None
#     except NoSuchElementException:
#         icon_href = None

#     try:
#         date = elem.find_element(By.XPATH, ".//meta[@itemprop='datePublished']").get_attribute("content")
#     except NoSuchElementException:
#         date = None

#     text = _get_review_text_with_fallbacks(elem, driver=self.driver)
#     if not text:
#         text = None

#     try:
#         stars = elem.find_elements(By.XPATH, ".//div[contains(@class, 'business-rating-badge-view__stars')]/span")
#         stars = ParserHelper.get_count_star(stars)
#     except Exception:
#         stars = 0

#     answer = ""
#     if not SKIP_ANSWER_PARSING:
#         try:
#             answer_btn = elem.find_element(By.CLASS_NAME, "business-review-view__comment-expand")
#             if answer_btn:
#                 self.driver.execute_script("arguments[0].click()", answer_btn)
#                 time.sleep(0.3)
#                 answer = elem.find_element(By.CLASS_NAME, "business-review-comment-content__bubble").text
#         except NoSuchElementException:
#             pass

#     try:
#         date_ts = ParserHelper.form_date(date) if (date and str(date).strip()) else 0.0
#     except Exception:
#         date_ts = 0.0

#     return asdict(
#         Review(
#             name=name or "",
#             icon_href=icon_href,
#             date=date_ts,
#             text=text or "",
#             stars=stars,
#             answer=answer if answer is not None else "",
#         )
#     )


# # Подменяем метод парсера отзывов, чтобы текст извлекался запасными селекторами
# Parser._Parser__get_data_item = _patched_get_data_item  # noqa: SLF001


# # Увеличиваем ожидание после открытия страницы отзывов (меньше «Страница не найдена»)
# _original_open_page = YandexParser._YandexParser__open_page  # noqa: SLF001


# def _patched_open_page(self):
#     parser = _original_open_page(self)
#     time.sleep(5)  # доп. пауза для загрузки контента
#     return parser


# YandexParser._YandexParser__open_page = _patched_open_page  # noqa: SLF001


# # --- КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: скроллим только пока не собрали MAX_REVIEWS_PER_PLACE ---
# _original_scroll_to_bottom = Parser._Parser__scroll_to_bottom  # noqa: SLF001


# def _patched_scroll_to_bottom(self, elem):
#     """Скроллит лениво-грузящийся список отзывов до лимита, а не до «дна» страницы."""
#     target = int(globals().get("MAX_REVIEWS_PER_PLACE", 100))
#     cls = "business-reviews-card-view__review"

#     stable_iters = 0
#     last_len = 0

#     while True:
#         elements = self.driver.find_elements(By.CLASS_NAME, cls)
#         cur_len = len(elements)

#         if cur_len >= target:
#             return

#         # Если список не растёт несколько итераций подряд — выходим
#         if cur_len == last_len:
#             stable_iters += 1
#             if stable_iters >= 3:
#                 return
#         else:
#             stable_iters = 0
#             last_len = cur_len

#         if not elements:
#             return

#         anchor = elements[-1]
#         self.driver.execute_script("arguments[0].scrollIntoView({block:'end'});", anchor)

#         # Ждём, пока догрузится следующая порция отзывов
#         try:
#             WebDriverWait(self.driver, 8).until(
#                 lambda d: len(d.find_elements(By.CLASS_NAME, cls)) > cur_len
#             )
#         except TimeoutException:
#             # Не догрузилось — цикл сам завершится по stable_iters
#             pass


# Parser._Parser__scroll_to_bottom = _patched_scroll_to_bottom  # noqa: SLF001


# # --- константы ---
# DEFAULT_CSV = "final_blyat_v3.csv"
# DEFAULT_OUTPUT = "yandex_reviews_results.json"
# DELAY_BETWEEN_PLACES = 3  # секунд между заведениями (снижение риска блокировки)
# MAX_REVIEWS_PER_PLACE = 100
# SEARCH_WAIT_TIMEOUT = 15


# def extract_org_id_from_url(href: str) -> str | None:
#     """
#     Из ссылки на организацию в Яндекс Картах извлекает числовой org_id.
#     Примеры: /maps/org/123456/ или /maps/org/novy-ton/95413856541/
#     """
#     if not href or "/org/" not in href:
#         return None
#     match = re.search(r"/org/(?:[^/]+/)*(\d+)/?", href)
#     return match.group(1) if match else None


# def search_yandex_maps_and_get_org_id(driver: uc.Chrome, query: str) -> str | None:
#     """Открывает Яндекс Карты, вводит запрос (название + адрес), возвращает org_id первого результата."""
#     search_url = "https://yandex.ru/maps/?text=" + quote_plus(query.strip())
#     driver.get(search_url)

#     wait = WebDriverWait(driver, SEARCH_WAIT_TIMEOUT)
#     try:
#         wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "a[href*='/org/']")))
#     except Exception:
#         return None

#     links = driver.find_elements(By.CSS_SELECTOR, "a[href*='/org/']")
#     for link in links:
#         href = link.get_attribute("href") or ""
#         org_id = extract_org_id_from_url(href)
#         if org_id:
#             return org_id
#     return None


# def parse_reviews_for_place(
#     place_name: str,
#     place_address: str,
#     org_id: str,
#     *,
#     max_retries: int = 2,
#     retry_delay: float = 6.0,
# ) -> dict:
#     """
#     Парсит отзывы по org_id через yandex-reviews-parser. Возвращает не более MAX_REVIEWS_PER_PLACE отзывов.
#     При «Страница не найдена» повторяет попытку до max_retries раз с паузой retry_delay.
#     """
#     last_error = None
#     for attempt in range(max_retries + 1):
#         try:
#             parser = YandexParser(int(org_id))
#             data = parser.parse(type_parse="default")
#         except Exception as e:
#             last_error = str(e)
#             if attempt < max_retries:
#                 time.sleep(retry_delay)
#             continue

#         if "error" in data and data["error"] == "Страница не найдена":
#             last_error = data["error"]
#             if attempt < max_retries:
#                 time.sleep(retry_delay)
#             continue

#         if "error" in data:
#             return {
#                 "place_name": place_name,
#                 "place_address": place_address,
#                 "org_id": org_id,
#                 "error": data["error"],
#                 "company_info": data.get("company_info"),
#                 "reviews": [],
#             }

#         reviews = data.get("company_reviews") or []
#         reviews = reviews[:MAX_REVIEWS_PER_PLACE]
#         return {
#             "place_name": place_name,
#             "place_address": place_address,
#             "org_id": org_id,
#             "error": None,
#             "company_info": data.get("company_info"),
#             "reviews": reviews,
#         }

#     return {
#         "place_name": place_name,
#         "place_address": place_address,
#         "org_id": org_id,
#         "error": last_error or "Страница не найдена",
#         "company_info": None,
#         "reviews": [],
#     }


# def main():
#     parser = argparse.ArgumentParser(description="Парсинг отзывов Яндекс Карт по CSV заведений")
#     parser.add_argument(
#         "--csv",
#         default=DEFAULT_CSV,
#         help=f"Путь к CSV с колонками название, адрес (по умолчанию: {DEFAULT_CSV})",
#     )
#     parser.add_argument(
#         "--output",
#         default=DEFAULT_OUTPUT,
#         help=f"Файл для сохранения результатов (по умолчанию: {DEFAULT_OUTPUT})",
#     )
#     parser.add_argument(
#         "--limit",
#         type=int,
#         default=None,
#         help="Обработать только первые N заведений (для теста)",
#     )
#     parser.add_argument(
#         "--start",
#         type=int,
#         default=0,
#         help="Начать с строки N (для дозаписи/продолжения)",
#     )
#     parser.add_argument(
#         "--chrome-version",
#         type=int,
#         default=144,
#         help="Мажорная версия Chrome (например 144). Должна совпадать с установленной. По умолчанию 144.",
#     )
#     parser.add_argument(
#         "--save-page",
#         metavar="FILE",
#         default=None,
#         help=(
#             "Сохранить HTML страницы отзывов в файл (для первого заведения). "
#             "Открой в браузере и найди класс блока с текстом отзыва."
#         ),
#     )
#     args = parser.parse_args()

#     # Чтобы ChromeDriver совпадал с установленным Chrome, задаём version_main.
#     # Патчим uc.Chrome, чтобы и наш драйвер, и драйвер внутри yandex-reviews-parser использовали эту версию.
#     _chrome_version = args.chrome_version
#     _original_chrome_init = uc.Chrome.__init__

#     def _patched_chrome_init(self, *args_init, **kwargs):
#         kwargs.setdefault("version_main", _chrome_version)
#         _original_chrome_init(self, *args_init, **kwargs)

#     uc.Chrome.__init__ = _patched_chrome_init

#     csv_path = Path(args.csv)
#     if not csv_path.exists():
#         print(f"Файл не найден: {csv_path}")
#         return 1

#     df = pd.read_csv(csv_path)
#     if "название" not in df.columns or "адрес" not in df.columns:
#         print("В CSV должны быть колонки 'название' и 'адрес'.")
#         return 1

#     # срез по --start и --limit
#     df = df.iloc[args.start:]
#     if args.limit is not None:
#         df = df.head(args.limit)

#     total = len(df)
#     print(f"Обработка {total} заведений (старт с индекса {args.start}). Результат: {args.output}")

#     options = uc.ChromeOptions()
#     options.add_argument("--no-sandbox")
#     options.add_argument("--disable-dev-shm-usage")

#     # --- УСКОРЕНИЕ: отключаем загрузку тяжелых ресурсов (картинки) ---
#     prefs = {
#         "profile.managed_default_content_settings.images": 2,
#     }
#     options.add_experimental_option("prefs", prefs)
#     # На некоторых сборках Chrome дополнительно помогает:
#     options.add_argument("--blink-settings=imagesEnabled=false")

#     # headless при желании можно включить; иногда поиск ведёт себя иначе
#     # options.add_argument("--headless=new")

#     results = []
#     print(
#         f"Используется ChromeDriver для Chrome {args.chrome_version} "
#         "(укажи --chrome-version N, если версия другая)."
#     )

#     with uc.Chrome(options=options) as driver:
#         for num, (_, row) in enumerate(df.iterrows(), start=1):
#             name = str(row["название"]).strip() if pd.notna(row["название"]) else ""
#             address = str(row["адрес"]).strip() if pd.notna(row["адрес"]) else ""
#             if not name and not address:
#                 print(f"  [{num}/{total}] Пропуск: нет названия и адреса")
#                 continue

#             query = f"{name} {address}".strip()
#             print(f"  [{num}/{total}] {name[:50]}...")
#             t0 = t.time()
#             org_id = search_yandex_maps_and_get_org_id(driver, query)
#             print(f"      Поиск: {t.time()-t0:.1f} с")
#             if not org_id:
#                 print(f"      Не найдено в Яндекс Картах: {query[:60]}...")
#                 results.append({
#                     "place_name": name,
#                     "place_address": address,
#                     "org_id": None,
#                     "error": "Организация не найдена в поиске",
#                     "company_info": None,
#                     "reviews": [],
#                 })
#                 time.sleep(DELAY_BETWEEN_PLACES)
#                 continue

#             # По желанию сохраняем HTML страницы отзывов для поиска нужного блока (один раз)
#             if args.save_page and not results:
#                 save_path = Path(args.save_page)
#                 print(f"      Сохраняю HTML страницы отзывов в {save_path}...")
#                 try:
#                     driver.get(f"https://yandex.ru/maps/org/{org_id}/reviews/")
#                     time.sleep(6)
#                     save_path.write_text(driver.page_source, encoding="utf-8")
#                     print("      Готово. Открой файл в браузере/редакторе и найди класс блока с текстом отзыва.")
#                 except Exception as e:
#                     print(f"      Ошибка сохранения HTML: {e}")

#             print(f"      org_id={org_id}, парсинг отзывов (<= {MAX_REVIEWS_PER_PLACE})...")
#             t1 = t.time()
#             place_result = parse_reviews_for_place(name, address, org_id)
#             print(f"      Парсинг: {t.time()-t1:.1f} с")
#             results.append(place_result)
#             n_reviews = len(place_result.get("reviews") or [])
#             print(f"      Отзывов: {n_reviews}")

#             time.sleep(DELAY_BETWEEN_PLACES)

#     out_path = Path(args.output)
#     out_path.parent.mkdir(parents=True, exist_ok=True)
#     with open(out_path, "w", encoding="utf-8") as f:
#         json.dump(results, f, ensure_ascii=False, indent=2)

#     print(f"Готово. Результаты сохранены в {out_path}")
#     return 0


# if __name__ == "__main__":
#     raise SystemExit(main())
