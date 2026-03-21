from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


@dataclass(frozen=True)
class LlmSettings:
    provider: str
    api_key: str
    model: str


class LlmError(Exception):
    pass


def _extract_json_block(text: str) -> str:
    """Extract JSON from a response that may contain code fences or prose."""
    # Try code-fenced JSON first
    fence = re.search(r"```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```", text, re.IGNORECASE)
    if fence:
        return fence.group(1)
    # Fallback: find first {..} or [..]
    brace = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if brace:
        return brace.group(1)
    return text


class PerplexityClient:
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = "https://api.perplexity.ai/chat/completions"

    @retry(
        reraise=True,
        retry=retry_if_exception_type((httpx.HTTPError, LlmError)),
        wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
        stop=stop_after_attempt(4),
    )
    async def complete_json(self, system: str, user: str, max_tokens: int = 1500) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0,
            "max_tokens": max_tokens,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(self.base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            try:
                content = data["choices"][0]["message"]["content"]
            except Exception as exc:  # noqa: BLE001
                raise LlmError("Invalid Perplexity response structure") from exc
            text = _extract_json_block(content)
            try:
                return json.loads(text)
            except json.JSONDecodeError as exc:  # noqa: BLE001
                # Return raw text so caller can attempt coercion
                return {"_raw": text}


def get_llm_client(settings: LlmSettings, use_langchain: bool = False):
    """
    Создает LLM клиент. Поддерживает как старый, так и новый LangChain-клиент.
    
    Args:
        settings: Настройки LLM
        use_langchain: Если True, использует LangChain клиент, иначе старый
    
    Returns:
        LLM клиент (PerplexityClient или LangChainPerplexityClient)
    """
    provider = settings.provider.strip().lower()
    
    if provider == "perplexity":
        if use_langchain:
            # Импортируем LangChain клиент
            from .client_langchain import get_langchain_llm_client
            return get_langchain_llm_client(settings)
        else:
            return PerplexityClient(api_key=settings.api_key, model=settings.model)
    
    raise LlmError(f"Unsupported LLM provider: {settings.provider}")


