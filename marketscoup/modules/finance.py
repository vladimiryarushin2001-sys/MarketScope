from __future__ import annotations

from typing import Any, Dict, List
import re
import json

import httpx

from ..config import AppConfig, load_config
from ..domain.models import Establishment, FinanceSnapshot
from ..llm.client import LlmSettings, get_llm_client, LlmError


FINANCE_SYSTEM_PROMPT = (
    "Ты — аналитик по финансовым оценкам малого бизнеса. "
    "На основе среднего чека, посещаемости, доступной информации в интернете и отзывов "
    "оцени минимальные, максимальные и средние значения по выручке, расходам и доходам; по среднему чеку верни только среднее значение "
    "для конкретного заведения (в России). Если точных данных нет — рассчитай правдоподобные диапазоны. "
    "Не отказывайся из-за отсутствия точных данных — оцени на основе разумных допущений. "
    "ВСЕ суммы указывай в рублях. Расходы указывай за год (годовые значения); если данные помесячные — переведи в годовые. "
    "Верни СТРОГО валидный JSON без каких-либо пояснений, текста до/после и без кодовых блоков. "
    "Игнорируй размышления/объяснения. В ответе указывай только числа (не 'number'/'string')."
)


def _build_finance_user_prompt(est: Establishment) -> str:
    lines = [
        "Заведение:",
        f"- id: {est.id}",
        f"- название: {est.name}",
        f"- город: {est.city or ''}",
        f"- страна: {est.country or ''}",
        f"- категория: {est.category or ''}",
        f"- url: {est.url or ''}",
        "",
        "Требование пользователя:",
        "Найди примерную информацию или проведи расчеты сам по среднему чеку, расходам, выручке, доходам заведения "
        "на основе среднего чека, посещаемости и отзывов. Должна вернуться информация по минимальной границе, "
        "максимальной и в среднем.",
        "",
        "Важно: расходы указывай за год (годовые значения). Если исходные данные помесячные — пересчитай в годовые.",
        "",
        "Строго верни JSON такого вида:",
        '{'
        '"establishment_id": "string",'
        '"avg_check": number,'
        '"min_revenue": number, "max_revenue": number, "avg_revenue": number,'
        '"min_expenses": number, "max_expenses": number, "avg_expenses": number,'
        '"min_income": number, "max_income": number, "avg_income": number'
        "}",
        "",
        "Важно: никаких пояснений, только валидный JSON-объект.",
    ]
    return "\n".join(lines)


def _parse_finance_payload(establishment_id: str, payload: Any) -> FinanceSnapshot:
    def _num(value: Any) -> Any:
        if value is None:
            return None
        # Accept numbers, numeric strings, and strings with currency/symbols (e.g., "1 200 000 руб.", "1,2 млн")
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            s = value.strip().lower()
            # normalize million/billion shortcuts if present (очень грубо)
            if "млрд" in s or "bn" in s:
                match = re.search(r"([\d\s.,]+)", s)
                if match:
                    base = match.group(1).replace(" ", "").replace(",", ".")
                    try:
                        return float(base) * 1_000_000_000
                    except ValueError:
                        return None
            if "млн" in s or "m" in s:
                match = re.search(r"([\d\s.,]+)", s)
                if match:
                    base = match.group(1).replace(" ", "").replace(",", ".")
                    try:
                        return float(base) * 1_000_000
                    except ValueError:
                        return None
            # extract first numeric like 1 234 567,89
            match = re.search(r"[\d][\d\s.,]*", s)
            if match:
                candidate = match.group(0).replace(" ", "").replace(",", ".")
                try:
                    return float(candidate)
                except ValueError:
                    return None
            return None
        return None

    data_raw = payload
    if isinstance(data_raw, list):
        # Автопочинка: ищем первый словарь в списке
        dict_candidate = next((item for item in data_raw if isinstance(item, dict)), None)
        if dict_candidate is not None:
            data_raw = dict_candidate
        else:
            # Если только числовые/строковые значения, берем первый элемент как попытку
            data_raw = data_raw[0] if data_raw else {}
    if isinstance(data_raw, dict):
        data = data_raw
        # Accept nested shapes like {"finance": {...}} or {"data": {...}}
        for key in ("finance", "data", "result"):
            if isinstance(data.get(key), dict):
                data = data[key]
                break
    else:
        data = {}
    return FinanceSnapshot(
        establishment_id=establishment_id,
        avg_check=_num(data.get("avg_check")),
        min_revenue=_num(data.get("min_revenue")),
        max_revenue=_num(data.get("max_revenue")),
        avg_revenue=_num(data.get("avg_revenue")),
        min_expenses=_num(data.get("min_expenses")),
        max_expenses=_num(data.get("max_expenses")),
        avg_expenses=_num(data.get("avg_expenses")),
        min_income=_num(data.get("min_income")),
        max_income=_num(data.get("max_income")),
        avg_income=_num(data.get("avg_income")),
        source="llm",
    )

def _build_finance_user_prompt_strict(est: Establishment) -> str:
    # Strongly constrained variant for retry when model returns invalid JSON
    return (
        _build_finance_user_prompt(est)
        + "\n\nТолько один JSON-объект. Никаких комментариев, кода, markdown, текста до или после."
    )

def _build_coerce_prompt(est: Establishment, raw: str) -> str:
    # Ask model to convert messy content into the strict JSON shape
    schema = (
        '{'
        '"establishment_id": "string",'
        '"avg_check": number,'
        '"min_revenue": number, "max_revenue": number, "avg_revenue": number,'
        '"min_expenses": number, "max_expenses": number, "avg_expenses": number,'
        '"min_income": number, "max_income": number, "avg_income": number'
        '}'
    )
    return "\n".join(
        [
            "Преобразуй приведённый ниже контент в валидный JSON строго по этой схеме (если данных не хватает — оцени правдоподобные значения):",
            schema,
            "",
            f'establishment_id должен быть "{est.id}". Все суммы в рублях.',
            "Если значения не указаны явно — рассчитай правдоподобные диапазоны на основе среднего чека/посещаемости/типовой структуры затрат.",
            "Строго верни только валидный JSON, без пояснений/markdown. Не используй слова 'number'/'string', только числа.",
            "Пример (формат, числа выдуманные): "
            '{"establishment_id":"ID","avg_check":2000,"min_revenue":50000000,"max_revenue":120000000,"avg_revenue":80000000,'
            '"min_expenses":35000000,"max_expenses":90000000,"avg_expenses":60000000,'
            '"min_income":15000000,"max_income":30000000,"avg_income":20000000}',
            "",
            "Контекст заведения:",
            f"id: {est.id}",
            f"name: {est.name}",
            f"city: {est.city or ''}",
            f"country: {est.country or ''}",
            f"category: {est.category or ''}",
            f"url: {est.url or ''}",
            "",
            "Контент:",
            raw[:8000],  # safety limit
        ]
    )
 


async def _fetch_finance_one_llm(est: Establishment, config: AppConfig) -> FinanceSnapshot:
    if not config.llm_api_key:
        # Safe mock fallback
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[finance-llm-skip] no LLM_API_KEY; establishment_id={est.id} name={est.name}")
        return FinanceSnapshot(
            establishment_id=est.id,
            min_revenue=None,
            max_revenue=None,
            avg_revenue=None,
            min_expenses=None,
            max_expenses=None,
            avg_expenses=None,
            min_income=None,
            max_income=None,
            avg_income=None,
            source="mock",
        )

    settings = LlmSettings(
        provider=config.llm_provider or "perplexity",
        api_key=config.llm_api_key,
        model=config.llm_model or "sonar-reasoning-pro",
    )
    client = get_llm_client(settings, use_langchain=config.use_langchain)

    try:
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[finance-llm-start] establishment_id={est.id} name={est.name}")
        payload = await client.complete_json(
            system=FINANCE_SYSTEM_PROMPT,
            user=_build_finance_user_prompt(est),
            max_tokens=4000,
        )
        # If client returned raw due to decode error, try coercion
        if isinstance(payload, dict) and "_raw" in payload:
            if (config.log_level or "").upper() == "DEBUG":
                print(f"[finance-llm-coerce] establishment_id={est.id} got _raw, trying coercion")
            payload = await client.complete_json(
                system="Ты — конвертор данных в строгий JSON.",
                user=_build_coerce_prompt(est, str(payload.get("_raw", ""))),
                max_tokens=3500,
            )
        snapshot = _parse_finance_payload(est.id, payload)
        # If everything came back empty, log a hint in DEBUG
        if (config.log_level or "").upper() == "DEBUG":
            all_none = all(
                getattr(snapshot, field) is None
                for field in [
                    "avg_check",
                    "min_revenue",
                    "max_revenue",
                    "avg_revenue",
                    "min_expenses",
                    "max_expenses",
                    "avg_expenses",
                    "min_income",
                    "max_income",
                    "avg_income",
                ]
            )
            if all_none:
                preview = payload if isinstance(payload, dict) else {"_raw": str(payload)[:300]}
                print(f"[finance-llm-empty] establishment_id={est.id} name={est.name} payload_preview={preview}")
        return snapshot
    except LlmError as exc:
        # Single strict attempt; if fails, return empty
        import sys
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[finance-llm-error] establishment_id={est.id} name={est.name}: {exc} -> strict", file=sys.stderr)
        try:
            payload = await client.complete_json(
                system=FINANCE_SYSTEM_PROMPT,
                user=_build_finance_user_prompt_strict(est),
                max_tokens=3500,
            )
            if isinstance(payload, dict) and "_raw" in payload:
                if (config.log_level or "").upper() == "DEBUG":
                    print(f"[finance-llm-coerce-strict] establishment_id={est.id} got _raw after strict, coercing", file=sys.stderr)
                payload = await client.complete_json(
                    system="Ты — конвертор данных в строгий JSON.",
                    user=_build_coerce_prompt(est, str(payload.get("_raw", ""))),
                    max_tokens=3000,
                )
            return _parse_finance_payload(est.id, payload)
        except LlmError:
            # Если и retry не сработал, возвращаем пустой результат
            if (config.log_level or "").upper() == "DEBUG":
                print(f"[finance-llm-failed] establishment_id={est.id} name={est.name}: все попытки не удались", file=sys.stderr)
            return FinanceSnapshot(
                establishment_id=est.id,
                avg_check=None,
                min_revenue=None,
                max_revenue=None,
                avg_revenue=None,
                min_expenses=None,
                max_expenses=None,
                avg_expenses=None,
                min_income=None,
                max_income=None,
                avg_income=None,
                source="error",
            )


async def fetch_finance_batch(establishments: List[Establishment], config: AppConfig | None = None) -> Dict[str, FinanceSnapshot]:
    import sys
    cfg = config or load_config()
    results: Dict[str, FinanceSnapshot] = {}
    print(f"[Финансы] Начинаю сбор финансовых данных для {len(establishments)} заведений...", file=sys.stderr)
    success_count = 0
    failed_count = 0
    for idx, est in enumerate(establishments, 1):
        snapshot = await _fetch_finance_one_llm(est, cfg)
        results[est.id] = snapshot
        # Проверяем, есть ли хотя бы одно поле заполнено
        has_data = any([
            snapshot.avg_check is not None,
            snapshot.avg_revenue is not None,
            snapshot.avg_expenses is not None,
            snapshot.avg_income is not None,
        ])
        if has_data:
            success_count += 1
        else:
            failed_count += 1
            print(f"[Финансы] Предупреждение: для {est.name} (id={est.id}) не удалось получить финансовые данные", file=sys.stderr)
        if (cfg.log_level or "").upper() == "DEBUG":
            print(f"[Финансы] Обработано {idx}/{len(establishments)}: {est.name}", file=sys.stderr)
    print(f"[Финансы] Сбор финансовых данных завершён: успешно {success_count}, неудачно {failed_count}", file=sys.stderr)
    return results


