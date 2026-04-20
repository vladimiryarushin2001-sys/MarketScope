#!/usr/bin/env python3
"""
Ручной вызов Edge Function ingest из папки джобы (как Redis outputs после пайплайна).

Важно: перед exec на хосте обязательно export, иначе -e передаст пустые строки:
  export SUPABASE_URL='https://xxxx.supabase.co'
  export SUPABASE_SERVICE_ROLE_KEY='eyJ...'

Пример:
  docker compose ... exec -e SUPABASE_URL -e SUPABASE_SERVICE_ROLE_KEY worker \\
    python3 /app/scripts/manual_ingest_job.py /app/jobs/<job_id> \\
    --user-id UUID --request-id 1 --run-id 2

Либо одной строкой (без export):
  SUPABASE_URL='https://....supabase.co' SUPABASE_SERVICE_ROLE_KEY='eyJ...' \\
  docker compose ... exec -e SUPABASE_URL -e SUPABASE_SERVICE_ROLE_KEY worker ...

user_id / request_id / run_id возьми из Supabase: analysis_runs + client_requests.

Требуется Python 3.10+ и только стандартная библиотека.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


def collect_outputs(exchange_dir: Path) -> dict:
    """Та же логика, что service/app/tasks._collect_outputs."""
    outputs: dict = {}
    for block in range(1, 7):
        path = exchange_dir / f"block{block}_output.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                outputs[f"block{block}"] = json.load(f)
    extra_files = {
        "block3_reviews_raw": "block3_reviews_raw.json",
        "block3_reviews_enriched": "block3_reviews_enriched.json",
    }
    for key, filename in extra_files.items():
        path = exchange_dir / filename
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                outputs[key] = json.load(f)
    md_path = exchange_dir / "block6_output.md"
    if md_path.exists():
        outputs["report_md"] = md_path.read_text(encoding="utf-8")
    return outputs


def main() -> int:
    p = argparse.ArgumentParser(description="POST job folder outputs to Supabase ingest")
    p.add_argument("job_dir", type=Path, help="Каталог джобы (например /app/jobs/<celery-uuid>)")
    p.add_argument("--user-id", required=True, help="UUID пользователя (client_requests.user_id)")
    p.add_argument("--request-id", type=int, required=True)
    p.add_argument("--run-id", type=int, required=True)
    p.add_argument("--supabase-url", default=os.environ.get("SUPABASE_URL", ""))
    p.add_argument("--service-role-key", default=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
    args = p.parse_args()

    if not args.supabase_url or not str(args.supabase_url).strip():
        print(
            "SUPABASE_URL пустой. На хосте выполни: export SUPABASE_URL='https://<project>.supabase.co'\n"
            "Проверка: docker compose ... exec worker env | grep SUPABASE",
            file=sys.stderr,
        )
        return 1
    if not args.service_role_key or not str(args.service_role_key).strip():
        print("SUPABASE_SERVICE_ROLE_KEY пустой — задай export на хосте или --service-role-key.", file=sys.stderr)
        return 1

    parsed = urlparse(args.supabase_url if "://" in args.supabase_url else f"https://{args.supabase_url}")
    if not parsed.hostname:
        print(f"Некорректный SUPABASE_URL: {args.supabase_url!r}", file=sys.stderr)
        return 1

    job_dir = args.job_dir.resolve()
    if not job_dir.is_dir():
        print(f"Нет каталога: {job_dir}", file=sys.stderr)
        return 1

    blocks = collect_outputs(job_dir)
    if not blocks.get("block1"):
        print("В каталоге нет block1_output.json — ingest не сможет собрать restaurants.", file=sys.stderr)
        return 1

    base = args.supabase_url.strip().rstrip("/")
    if not base.startswith("http"):
        base = "https://" + base
    url = base + "/functions/v1/ingest"
    body = json.dumps(
        {
            "user_id": args.user_id,
            "blocks": blocks,
            "request": {
                "request_id": args.request_id,
                "run_id": args.run_id,
                "query_text": "",
            },
        },
        ensure_ascii=False,
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": args.service_role_key,
            "Authorization": f"Bearer {args.service_role_key}",
            "X-Internal-User-Id": args.user_id,
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            print(f"HTTP {resp.status}")
            print(raw)
            return 0 if 200 <= resp.status < 300 else 1
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}", file=sys.stderr)
        print(err_body, file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"Сеть/DNS: {e.reason!r}", file=sys.stderr)
        print(f"URL: {url!r}", file=sys.stderr)
        print(
            "Чаще всего SUPABASE_URL не попал в контейнер: на хосте сделай "
            "export SUPABASE_URL=... && export SUPABASE_SERVICE_ROLE_KEY=... и снова exec -e ...",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
