from __future__ import annotations

import json
import logging
from typing import Any, Literal, Optional

import redis as redis_lib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, model_validator

from .celery_app import celery_app, REDIS_URL  # noqa: F401 — регистрирует воркер
from .tasks import run_pipeline

logger = logging.getLogger(__name__)

app = FastAPI(title="Restaurant Pipeline API", version="1.0.0")

_redis = redis_lib.from_url(REDIS_URL, decode_responses=True)


# ── Модели запроса ──────────────────────────────────────────────

class TemplateParams(BaseModel):
    types: list[str]
    cuisines: list[str] | None = None
    price_min: int | None = None
    price_max: int | None = None
    особенности: str | None = None


class ReferencePlace(BaseModel):
    name: str
    address: str | None = None
    yandex_maps_link: str | None = None
    website: str | None = None
    menu_file: str | None = None
    menu_files: list[str] | None = None
    menu_url: str | None = None


class AnalyzeRequest(BaseModel):
    report_type: Literal["market", "competitors", "competitive"] = "market"
    mode: Literal["template", "free_form"] = "template"
    top_n: int = 10
    enrich_with_perplexity: bool = True
    perplexity_model: str = "sonar"
    template: TemplateParams | None = None
    free_form_text: str | None = None
    reference_place: ReferencePlace | None = None

    @model_validator(mode="after")
    def check_mode_params(self):
        if self.mode == "template" and self.template is None:
            raise ValueError("template обязателен при mode='template'")
        if self.mode == "free_form" and not self.free_form_text:
            raise ValueError("free_form_text обязателен при mode='free_form'")
        if self.report_type == "competitive" and self.reference_place is None:
            raise ValueError("reference_place обязателен при report_type='competitive'")
        return self


# ── Эндпоинты ───────────────────────────────────────────────────

@app.get("/health")
def health():
    try:
        _redis.ping()
    except redis_lib.ConnectionError:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    return {"status": "ok"}


@app.post("/analyze", status_code=202)
def analyze(body: AnalyzeRequest):
    """
    Запустить пайплайн анализа ресторанов.

    Тело запроса — input_request.json (report_type, mode, template / free_form и т.д.).
    Возвращает job_id для последующего опроса статуса.
    """
    try:
        task = run_pipeline.delay(body.model_dump(exclude_none=True))
        _redis.hset(f"job:{task.id}", mapping={"status": "pending", "progress": "0/6"})
        _redis.expire(f"job:{task.id}", 86400)
    except redis_lib.ConnectionError:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    return {"job_id": task.id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    """
    Получить статус и результаты задачи.

    status: pending | running | done | error
    progress: "N/6" — сколько блоков завершено
    outputs: все выходные JSON-файлы (только когда status == done)
    """
    try:
        data = _redis.hgetall(f"job:{job_id}")
    except redis_lib.ConnectionError:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    if not data:
        raise HTTPException(status_code=404, detail="Job not found or expired (data is kept for 24h)")

    result: dict[str, Any] = {
        "job_id": job_id,
        "status": data.get("status", "unknown"),
        "progress": data.get("progress", "0/6"),
    }

    if "error" in data:
        result["error"] = data["error"]

    if "warnings" in data:
        result["warnings"] = json.loads(data["warnings"])

    if "outputs" in data:
        result["outputs"] = json.loads(data["outputs"])

    return result
