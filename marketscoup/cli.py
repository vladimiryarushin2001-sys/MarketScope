from __future__ import annotations

import asyncio
import json
import sys
from argparse import ArgumentParser

from .orchestrator import run_analysis
from .modules.report import create_report


async def _run_with_report(query: str, top_n: int, output_dir: str, create_pdf: bool) -> None:
    """Выполняет анализ и создаёт отчёт при необходимости."""
    print(f"[Начало анализа] Запрос: {query}, Топ заведений: {top_n}", file=sys.stderr)
    analysis = await run_analysis(query=query, top_n=top_n)
    
    # Если запрошен PDF отчёт
    if create_pdf:
        pdf_path = await create_report(analysis, output_dir=output_dir)
        print(f"\nPDF отчёт создан: {pdf_path}", file=sys.stderr)
    
    # Support both Pydantic v2 (model_dump) and v1 (dict)
    analysis_dict = (
        analysis.model_dump() if hasattr(analysis, "model_dump") else analysis.dict()
    )
    print(json.dumps(analysis_dict, ensure_ascii=False, indent=2))


def main() -> None:
    parser = ArgumentParser(description="MarketScoup CLI")
    parser.add_argument("--query", required=True, help="Пользовательский запрос (описание заведения)")
    parser.add_argument("--top", type=int, default=10, help="Сколько похожих заведений выбрать")
    parser.add_argument("--output-dir", type=str, default=".", help="Директория для сохранения PDF отчёта (по умолчанию текущая)")
    parser.add_argument("--pdf", action="store_true", help="Создать PDF отчёт")
    args = parser.parse_args()

    asyncio.run(_run_with_report(
        query=args.query,
        top_n=args.top,
        output_dir=args.output_dir,
        create_pdf=args.pdf
    ))


if __name__ == "__main__":
    main()


