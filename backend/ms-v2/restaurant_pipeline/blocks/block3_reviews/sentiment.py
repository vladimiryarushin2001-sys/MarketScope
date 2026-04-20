"""
Модуль оценки тональности отзывов на русском языке.
Использует seara/rubert-tiny2-russian-sentiment — лёгкую модель для ~1000 отзывов.
Метки: -1 (негатив), 0 (нейтрал), 1 (позитив).
"""

from __future__ import annotations

from typing import Optional

# Маппинг выхода модели в -1/0/1 (зависит от модели)
# seara/rubert-tiny2-russian-sentiment: 0=neutral, 1=positive, 2=negative
_LABEL_TO_SENTIMENT = {0: 0, 1: 1, 2: -1}

_MODEL_ID = "seara/rubert-tiny2-russian-sentiment"
_BATCH_SIZE = 32
_MAX_LENGTH = 256


def _get_model_and_tokenizer():
    """Ленивая загрузка модели и токенизатора."""
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    import torch

    tokenizer = AutoTokenizer.from_pretrained(_MODEL_ID)
    model = AutoModelForSequenceClassification.from_pretrained(_MODEL_ID)
    model.eval()
    return model, tokenizer


def predict_sentiment(texts: list[str], batch_size: int = _BATCH_SIZE) -> list[int]:
    """
    Предсказывает тональность для списка текстов.
    Возвращает список значений: -1 (негатив), 0 (нейтрал), 1 (позитив).
    """
    if not texts:
        return []

    import torch

    model, tokenizer = _get_model_and_tokenizer()
    results = [0] * len(texts)  # по умолчанию нейтрал

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        batch_clean = []
        batch_positions = []
        for j, t in enumerate(batch):
            s = str(t or "").strip()
            if len(s) >= 3:
                batch_clean.append(s)
                batch_positions.append(i + j)

        if not batch_clean:
            continue

        enc = tokenizer(
            batch_clean,
            padding=True,
            truncation=True,
            max_length=_MAX_LENGTH,
            return_tensors="pt",
        )
        with torch.no_grad():
            logits = model(**enc).logits
        preds = logits.argmax(dim=1).tolist()

        for pos, pred in zip(batch_positions, preds):
            results[pos] = _LABEL_TO_SENTIMENT.get(pred, 0)

    return results


def add_sentiment_to_reviews(reviews_data: list[dict]) -> list[dict]:
    """
    Добавляет поле sentiment (-1/0/1) к каждому отзыву во всех заведениях.
    Модифицирует reviews_data in-place и возвращает его.
    """
    all_texts: list[str] = []
    all_refs: list[tuple[int, int]] = []  # (place_idx, review_idx)

    for place_idx, place in enumerate(reviews_data):
        reviews = place.get("reviews") or []
        for rev_idx, rev in enumerate(reviews):
            text = str(rev.get("text") or "").strip()
            all_texts.append(text)
            all_refs.append((place_idx, rev_idx))

    if not all_texts:
        return reviews_data

    sentiments = predict_sentiment(all_texts)

    for (place_idx, rev_idx), sent in zip(all_refs, sentiments):
        reviews_data[place_idx]["reviews"][rev_idx]["sentiment"] = sent

    return reviews_data
