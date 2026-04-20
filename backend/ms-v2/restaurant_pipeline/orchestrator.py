import json
import sys
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


PIPELINE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = PIPELINE_ROOT.parent
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from blocks.block1_relevance.run import run as run_block1
from blocks.block2_menu.run import run as run_block2
from blocks.block3_reviews.run import run as run_block3
from blocks.block4_marketing.run import run as run_block4
from blocks.block5_tech.run import run as run_block5
from blocks.block6_aggregator.run import run as run_block6


def _run_block(label: str, fn, *args):
    """Обёртка для запуска блока в потоке с логированием."""
    print(f"[{label}] старт …", flush=True)
    try:
        fn(*args)
        print(f"[{label}] готов ✓", flush=True)
        return label, None
    except Exception as e:
        print(f"[{label}] ОШИБКА: {e}", flush=True)
        traceback.print_exc()
        return label, e


def main(exchange_dir=None, progress_callback=None) -> int:
    exchange = Path(exchange_dir) if exchange_dir else PIPELINE_ROOT / "data_exchange"
    exchange.mkdir(parents=True, exist_ok=True)

    input_path = exchange / "input_request.json"
    b1_path = exchange / "block1_output.json"
    b2_path = exchange / "block2_output.json"
    b3_path = exchange / "block3_output.json"
    b4_path = exchange / "block4_output.json"
    b5_path = exchange / "block5_output.json"
    b6_path = exchange / "block6_output.json"

    if not input_path.exists():
        sample = {
            "report_type": "market",
            "mode": "template",
            "top_n": 10,
            "source_csv": str(PROJECT_ROOT / "final_blyat_v3.csv"),
            "template": {
                "types": ["ресторан"],
                "cuisines": ["русская"],
                "price_min": 2000,
                "price_max": 5000,
                "особенности": "уютная атмосфера",
            },
        }
        with open(input_path, "w", encoding="utf-8") as f:
            json.dump(sample, f, ensure_ascii=False, indent=2)

    with open(input_path, "r", encoding="utf-8") as f:
        input_data = json.load(f)
    report_type = input_data.get("report_type", "market")

    print(f"=== Режим: {report_type} ===\n", flush=True)

    # ── Block 1: последовательно (от него зависят все остальные) ──
    print("[1/6] block1_relevance ...", flush=True)
    run_block1(str(input_path), str(b1_path))
    if progress_callback:
        progress_callback(1)

    # ── Blocks 2–5: параллельно ──
    print("\n[2-5/6] Блоки 2–5 параллельно …", flush=True)

    parallel_tasks = [
        ("2/6 block2_menu",      run_block2, str(b1_path), str(b2_path)),
        ("3/6 block3_reviews",   run_block3, str(b1_path), str(b3_path)),
        ("4/6 block4_marketing", run_block4, str(b1_path), str(b4_path)),
        ("5/6 block5_tech",      run_block5, str(b1_path), str(b5_path)),
    ]

    errors = {}
    completed_parallel = 1
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {
            pool.submit(_run_block, label, fn, *args): label
            for label, fn, *args in parallel_tasks
        }
        for future in as_completed(futures):
            label, err = future.result()
            if err:
                errors[label] = err
            completed_parallel += 1
            if progress_callback:
                progress_callback(completed_parallel)

    if errors:
        print(f"\n⚠ Ошибки в блоках: {list(errors.keys())}", flush=True)
        print("  Продолжаю генерацию отчёта с имеющимися данными.\n", flush=True)

    # Сохраняем информацию об ошибках для downstream
    failed_blocks = list(errors.keys())
    warnings_path = exchange / "pipeline_warnings.json"
    with open(warnings_path, "w", encoding="utf-8") as f:
        json.dump({
            "failed_blocks": failed_blocks,
            "errors": {k: str(v) for k, v in errors.items()},
        }, f, ensure_ascii=False, indent=2)

    # ── Block 6: последовательно (нужны все выходы) ──
    print(f"[6/6] block6_aggregator ({report_type}) ...", flush=True)
    run_block6(str(b1_path), str(b2_path), str(b3_path), str(b4_path), str(b5_path), str(b6_path), report_type)
    if progress_callback:
        progress_callback(6)

    print(f"\nГотово. Итог: {b6_path}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

