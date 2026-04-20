# -*- coding: utf-8 -*-
"""
Поиск заведений: чистый датафрейм → фильтр по типу, цене, кухне → косинусная близость по «особенности» → топ-20.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import numpy as np
import pandas as pd

# Папка для кэша весов энкодера (чтобы не скачивать каждый раз)
_ENCODER_CACHE_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "encoder_cache")


def _get_encoder_cache_dir(model_name: str) -> str:
    """Путь к папке с весами для данной модели (безопасное имя из model_name)."""
    safe_name = model_name.replace("/", "_").strip()
    return os.path.join(_ENCODER_CACHE_ROOT, safe_name)


def _encoder_cache_exists(cache_dir: str) -> bool:
    """Проверка: в папке уже есть сохранённая модель (config.json от sentence-transformers)."""
    return os.path.isdir(cache_dir) and os.path.isfile(os.path.join(cache_dir, "config.json"))


# Модель по умолчанию: лёгкий русский энкодер (кэшируется в encoder_cache)
DEFAULT_ENCODER_MODEL = "sergeyzh/rubert-mini-frida"


def download_encoder(
    model_name: str = DEFAULT_ENCODER_MODEL,
    device: Optional[str] = "cpu",
    force: bool = False,
) -> str:
    """
    Скачать энкодер и сохранить в encoder_cache. При повторном вызове загружает из кэша (если не force=True).
    Возвращает путь к папке с весами.
    """
    cache_dir = _get_encoder_cache_dir(model_name)
    if not force and _encoder_cache_exists(cache_dir):
        return cache_dir
    from sentence_transformers import SentenceTransformer
    kwargs = {} if device is None else {"device": device}
    model = SentenceTransformer(model_name, tokenizer_kwargs={"fix_mistral_regex": True}, **kwargs)
    os.makedirs(cache_dir, exist_ok=True)
    model.save(cache_dir)
    return cache_dir


# Обязательные колонки в датафрейме
REQUIRED_COLUMNS = ["тип_заведения", "средний_чек", "кухня", "описание_полное"]


def _normalize_set(values: Optional[list[str]]) -> set[str]:
    if not values:
        return set()
    return {str(v).strip().lower() for v in values if str(v).strip()}


def _split_set(s: str) -> set[str]:
    if pd.isna(s) or not str(s).strip():
        return set()
    return {p.strip().lower() for p in str(s).split(",") if p.strip()}


def _check_columns(df: pd.DataFrame) -> None:
    """Проверка наличия обязательных полей в датафрейме."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"В датафрейме нет колонок: {missing}. Нужны: {REQUIRED_COLUMNS}")


def get_available_cuisines(df: pd.DataFrame) -> list[str]:
    """Список всех кухонь, встречающихся в датафрейме (колонка «кухня», через запятую)."""
    if "кухня" not in df.columns:
        return []
    all_cuisines: set[str] = set()
    for v in df["кухня"].dropna().astype(str):
        all_cuisines |= _split_set(v)
    return sorted(all_cuisines)


def get_available_types(df: pd.DataFrame) -> list[str]:
    """Список всех типов заведений, встречающихся в датафрейме (колонка «тип_заведения», через запятую)."""
    if "тип_заведения" not in df.columns:
        return []
    all_types: set[str] = set()
    for v in df["тип_заведения"].dropna().astype(str):
        all_types |= _split_set(v)
    return sorted(all_types)


def _filter_df(
    df: pd.DataFrame,
    types: Optional[list[str]] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    cuisines: Optional[list[str]] = None,
) -> pd.DataFrame:
    """
    Одно логическое условие: (тип ∨ …) И (цена в диапазоне) И (все кухни из запроса есть у заведения).
    Тип: любое совпадение из списка; цена: средний_чек в [min, max]; кухня: все из запроса должны быть в ответе.
    """
    want_types = _normalize_set(types)
    want_cuisines = _normalize_set(cuisines)

    mask_type = (
        df["тип_заведения"].apply(lambda x: bool(_split_set(x) & want_types))
        if want_types
        else pd.Series(True, index=df.index)
    )
    PRICE_MARGIN = 0.3
    mask_price = pd.Series(True, index=df.index)
    if price_min is not None:
        soft_min = price_min * (1 - PRICE_MARGIN)
        mask_price &= (df["средний_чек"] >= soft_min) | df["средний_чек"].isna()
    if price_max is not None:
        soft_max = price_max * (1 + PRICE_MARGIN)
        mask_price &= (df["средний_чек"] <= soft_max) | df["средний_чек"].isna()
    # Все кухни из запроса должны быть у заведения (AND)
    mask_cuisine = (
        df["кухня"].apply(lambda x: want_cuisines.issubset(_split_set(x)))
        if want_cuisines
        else pd.Series(True, index=df.index)
    )

    return df.loc[mask_type & mask_price & mask_cuisine].reset_index(drop=True)


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """a (n, dim), b (1, dim) → (n,)"""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    if a.ndim == 1:
        a = a.reshape(1, -1)
    if b.ndim == 1:
        b = b.reshape(1, -1)
    an = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-12)
    bn = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-12)
    return np.dot(an, bn.T).ravel()


def build_places_df(raw_df: pd.DataFrame) -> pd.DataFrame:
    """Схлопывает строки по названию (одна строка на заведение). Нужно, если грузите сырой CSV."""
    def agg_join(ser: pd.Series) -> str:
        parts = ser.dropna().astype(str).str.strip()
        uniq = set()
        for v in parts:
            for p in str(v).split(","):
                if p.strip():
                    uniq.add(p.strip().lower())
        return ", ".join(sorted(uniq)) if uniq else ""

    def first_val(ser: pd.Series):
        for v in ser:
            if pd.notna(v) and str(v).strip():
                return v
        return ser.iloc[0] if len(ser) else None

    agg = {
        "тип_заведения": lambda s: agg_join(s),
        "кухня": lambda s: agg_join(s),
        "описание": first_val,
        "средний_чек": first_val,
        "ссылка": first_val,
        "адрес": first_val,
        "описание_полное": first_val,
        "меню_ссылки": first_val,
        "меню_названия": first_val,
        "меню_типы": first_val,
        "меню_количество": first_val,
    }
    return raw_df.groupby("название", as_index=False).agg(agg)


class PlaceSearch:
    """
    Поиск по чистому датафрейму: проверка полей → фильтр (тип → цена → кухня) →
    эмбеддинги по всем отфильтрованным + запрос «особенности» → косинусная близость → топ-n.
    """

    def __init__(
        self,
        df: pd.DataFrame,
        model_name: str = DEFAULT_ENCODER_MODEL,
        device: Optional[str] = "cpu",
    ):
        _check_columns(df)
        self._df = df.copy()
        self._model_name = model_name
        self._device = device
        self._model = None
        self._model_ok: Optional[bool] = None

    @classmethod
    def from_csv(
        cls,
        path: str,
        collapse: bool = True,
        **kwargs: Any,
    ) -> "PlaceSearch":
        """Загрузить датафрейм из CSV. collapse=True — схлопнуть по названию."""
        raw = pd.read_csv(path)
        df = build_places_df(raw) if collapse else raw
        return cls(df, **kwargs)

    def _get_model(self):
        if self._model is not None:
            return self._model
        if self._model_ok is False:
            return None
        try:
            from sentence_transformers import SentenceTransformer
            cache_dir = _get_encoder_cache_dir(self._model_name)
            kwargs = {} if self._device is None else {"device": self._device}
            if _encoder_cache_exists(cache_dir):
                self._model = SentenceTransformer(cache_dir, tokenizer_kwargs={"fix_mistral_regex": True}, **kwargs)
            else:
                self._model = SentenceTransformer(self._model_name, tokenizer_kwargs={"fix_mistral_regex": True}, **kwargs)
                os.makedirs(cache_dir, exist_ok=True)
                self._model.save(cache_dir)
            self._model_ok = True
            return self._model
        except Exception:
            self._model_ok = False
            return None

    def search(
        self,
        types: Optional[list[str]] = None,
        price_min: Optional[float] = None,
        price_max: Optional[float] = None,
        cuisines: Optional[list[str]] = None,
        особенности: Optional[str] = None,
        описание_полное: Optional[str] = None,
        n: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Фильтр: тип (любое совпадение) → цена → кухня.
        Для эмбеддинга приоритет: описание_полное (2-3 предложения) > особенности (ключевые слова).
        Возвращаем топ-n по косинусной близости.
        """
        filtered = _filter_df(
            self._df,
            types=types,
            price_min=price_min,
            price_max=price_max,
            cuisines=cuisines,
        )
        if len(filtered) == 0:
            return []

        price_mid = None
        if price_min is not None and price_max is not None:
            price_mid = (price_min + price_max) / 2.0
        elif price_min is not None:
            price_mid = float(price_min)
        elif price_max is not None:
            price_mid = float(price_max)

        def _sort_by_price_closeness(df: pd.DataFrame) -> pd.DataFrame:
            if price_mid is None:
                return df.sort_values("средний_чек", ascending=True, na_position="last")
            dist = (df["средний_чек"] - price_mid).abs()
            dist = dist.fillna(np.inf)
            return df.assign(_price_dist=dist).sort_values("_price_dist", ascending=True).drop(columns=["_price_dist"], errors="ignore")

        query_text = (описание_полное or "").strip() or (особенности or "").strip()
        if not query_text:
            filtered = _sort_by_price_closeness(filtered)
            return filtered.head(n).to_dict(orient="records")

        model = self._get_model()
        if model is None:
            import warnings
            warnings.warn(
                "Эмбеддинги недоступны. Возвращаем топ по фильтру (близость к середине диапазона по чеку).",
                UserWarning,
                stacklevel=2,
            )
            filtered = _sort_by_price_closeness(filtered)
            return filtered.head(n).to_dict(orient="records")

        texts = filtered["описание_полное"].fillna("").astype(str).tolist()
        place_embs = model.encode(texts, normalize_embeddings=True, prompt_name="document")
        query_emb = model.encode([query_text], normalize_embeddings=True, prompt_name="query")
        scores = _cosine_similarity(place_embs, query_emb)
        filtered = filtered.assign(cosine_score=scores)
        filtered = filtered.sort_values("cosine_score", ascending=False)
        return filtered.head(n).to_dict(orient="records")

    @property
    def df(self) -> pd.DataFrame:
        return self._df


def search_places(
    df: pd.DataFrame,
    query: dict[str, Any],
    n: int = 20,
) -> list[dict[str, Any]]:
    """
    Упрощённая точка входа: чистый датафрейм + запрос → топ-n (по умолчанию 20).

    query: types, price_min, price_max, cuisines, особенности, описание_полное.
    """
    _check_columns(df)
    engine = PlaceSearch(df)
    return engine.search(
        types=query.get("types"),
        price_min=query.get("price_min"),
        price_max=query.get("price_max"),
        cuisines=query.get("cuisines"),
        особенности=query.get("особенности"),
        описание_полное=query.get("описание_полное"),
        n=query.get("n", n),
    )
