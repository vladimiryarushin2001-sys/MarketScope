import os

from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "pipeline",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=86400,
    worker_prefetch_multiplier=1,  # не брать следующую задачу пока текущая не завершена
    task_acks_late=True,           # подтверждать только после успешного завершения
)
