from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import redis as redis_lib

from .celery_app import celery_app, REDIS_URL

PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", "/app"))
JOBS_DIR = PROJECT_ROOT / "jobs"
SOURCE_CSV = Path(os.getenv("SOURCE_CSV", str(PROJECT_ROOT / "final_blyat_v3.csv")))

_redis = redis_lib.from_url(REDIS_URL, decode_responses=True)


@celery_app.task(bind=True)
def run_pipeline(self, input_request: dict):
    job_id = self.request.id
    exchange_dir = JOBS_DIR / job_id
    exchange_dir.mkdir(parents=True, exist_ok=True)

    def _progress(block: int):
        _redis.hset(f"job:{job_id}", "progress", f"{block}/6")

    try:
        _redis.hset(f"job:{job_id}", mapping={"status": "running", "progress": "0/6"})
        _redis.expire(f"job:{job_id}", 86400)

        input_request["source_csv"] = str(SOURCE_CSV)

        input_path = exchange_dir / "input_request.json"
        with open(input_path, "w", encoding="utf-8") as f:
            json.dump(input_request, f, ensure_ascii=False, indent=2)

        if str(PROJECT_ROOT) not in sys.path:
            sys.path.insert(0, str(PROJECT_ROOT))

        from restaurant_pipeline.orchestrator import main as run_orchestrator
        run_orchestrator(exchange_dir=exchange_dir, progress_callback=_progress)

        outputs = _collect_outputs(exchange_dir)

        # Проверяем были ли ошибки в параллельных блоках
        warnings_path = exchange_dir / "pipeline_warnings.json"
        status = "done"
        mapping: dict[str, str] = {
            "status": status,
            "progress": "6/6",
            "outputs": json.dumps(outputs, ensure_ascii=False),
        }
        if warnings_path.exists():
            with open(warnings_path, "r", encoding="utf-8") as f:
                warnings = json.load(f)
            if warnings.get("failed_blocks"):
                mapping["status"] = "done_partial"
                mapping["warnings"] = json.dumps(warnings, ensure_ascii=False)

        _redis.hset(f"job:{job_id}", mapping=mapping)

    except Exception as exc:
        _redis.hset(f"job:{job_id}", mapping={
            "status": "error",
            "error": str(exc),
        })
        raise


def _collect_outputs(exchange_dir: Path) -> dict:
    outputs: dict = {}

    for block in range(1, 7):
        path = exchange_dir / f"block{block}_output.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                outputs[f"block{block}"] = json.load(f)

    # Дополнительные файлы блока 3
    extra_files = {
        "block3_reviews_raw": "block3_reviews_raw.json",
        "block3_reviews_enriched": "block3_reviews_enriched.json",
    }
    for key, filename in extra_files.items():
        path = exchange_dir / filename
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                outputs[key] = json.load(f)

    # Markdown-отчёт
    md_path = exchange_dir / "block6_output.md"
    if md_path.exists():
        outputs["report_md"] = md_path.read_text(encoding="utf-8")

    return outputs
