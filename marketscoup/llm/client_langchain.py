from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, List

from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.exceptions import LangChainException
from pydantic import Field
import httpx


@dataclass(frozen=True)
class LlmSettings:
    provider: str
    api_key: str
    model: str


class LlmError(Exception):
    """Ошибка при работе с LLM через LangChain."""
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


class PerplexityChatModel(BaseChatModel):
    """Кастомный LangChain ChatModel для Perplexity AI API."""
    
    api_key: str = Field(description="Perplexity API key")
    model: str = Field(description="Model name")
    base_url: str = Field(default="https://api.perplexity.ai/chat/completions", description="API base URL")
    temperature: float = Field(default=0, description="Temperature")
    timeout: int = Field(default=60, description="Request timeout")
    
    class Config:
        arbitrary_types_allowed = True
    
    @property
    def _llm_type(self) -> str:
        return "perplexity"
    
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Any:
        """Синхронная генерация (не используется, так как мы async)."""
        raise NotImplementedError("Use async methods instead")
    
    async def _agenerate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Any:
        """Асинхронная генерация через Perplexity API."""
        from langchain_core.outputs import ChatGeneration, ChatResult
        
        # Конвертируем сообщения в формат Perplexity
        api_messages = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                api_messages.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                api_messages.append({"role": "user", "content": msg.content})
            else:
                # Для других типов сообщений используем content
                api_messages.append({"role": "user", "content": str(msg.content)})
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": self.model,
            "messages": api_messages,
            "temperature": self.temperature,
            **kwargs,  # Позволяем передавать max_tokens и другие параметры
        }
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.base_url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            
            try:
                content = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as exc:
                raise LangChainException("Invalid Perplexity response structure") from exc
            
            # Создаем ChatGeneration и ChatResult для LangChain
            generation = ChatGeneration(message=HumanMessage(content=content))
            return ChatResult(generations=[generation])


class LangChainPerplexityClient:
    """LangChain-based client for Perplexity AI API."""
    
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model
        # Создаем кастомный LangChain ChatModel для Perplexity
        self.llm = PerplexityChatModel(
            api_key=api_key,
            model=model,
        )
        self.json_parser = JsonOutputParser()
        self.str_parser = StrOutputParser()
    
    def _escape_braces(self, text: str) -> str:
        """
        Экранирует фигурные скобки в тексте для LangChain.
        Заменяет { на {{ и } на }}, чтобы LangChain не интерпретировал их как переменные шаблона.
        """
        # Экранируем все фигурные скобки
        return text.replace("{", "{{").replace("}", "}}")
    
    async def complete_json(
        self, 
        system: str, 
        user: str, 
        max_tokens: int = 1500
    ) -> Dict[str, Any]:
        """
        Выполняет запрос к LLM и возвращает JSON.
        
        Сохраняет обратную совместимость со старым интерфейсом:
        - Возвращает Dict[str, Any] с распарсенным JSON
        - Возвращает {"_raw": text} если JSON не удалось распарсить
        """
        try:
            # Экранируем фигурные скобки в промптах, чтобы LangChain не интерпретировал их как переменные
            system_escaped = self._escape_braces(system)
            user_escaped = self._escape_braces(user)
            
            # Создаем промпт с системным и пользовательским сообщениями
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_escaped),
                ("user", user_escaped),
            ])
            
            # Создаем цепочку: промпт -> LLM -> парсер
            # Передаем max_tokens через bind для LLM
            llm_with_config = self.llm.bind(max_tokens=max_tokens)
            chain = prompt | llm_with_config | self.json_parser
            
            # Выполняем запрос
            try:
                result = await chain.ainvoke({})
                
                # Если результат - словарь, возвращаем его
                if isinstance(result, dict):
                    return result
                
                # Если результат - строка, пытаемся извлечь JSON
                if isinstance(result, str):
                    extracted = _extract_json_block(result)
                    try:
                        return json.loads(extracted)
                    except json.JSONDecodeError:
                        return {"_raw": extracted}
                
                # Если результат другой тип, оборачиваем в словарь
                return {"_raw": str(result)}
            except Exception as parse_error:
                # Если парсер не смог распарсить (например, из-за reasoning в ответе),
                # получаем сырой текст и извлекаем JSON вручную
                from langchain_core.exceptions import OutputParserException
                
                if isinstance(parse_error, OutputParserException):
                    # Получаем сырой текст из LLM без парсера
                    llm_with_config = self.llm.bind(max_tokens=max_tokens)
                    chain_text = prompt | llm_with_config | self.str_parser
                    raw_text = await chain_text.ainvoke({})
                    
                    # Извлекаем JSON из текста
                    extracted = _extract_json_block(str(raw_text))
                    try:
                        return json.loads(extracted)
                    except json.JSONDecodeError:
                        return {"_raw": extracted}
                else:
                    # Если это другая ошибка, пробрасываем дальше
                    raise
            
        except LangChainException as e:
            # Обрабатываем ошибки LangChain (кроме OutputParserException, которая уже обработана)
            from langchain_core.exceptions import OutputParserException
            if isinstance(e, OutputParserException):
                # OutputParserException уже обработана в блоке try выше, но если она пробросилась,
                # значит обработка не сработала - пробрасываем дальше
                raise
            raise LlmError(f"LangChain error: {str(e)}") from e
        except Exception as e:
            # Обрабатываем другие ошибки
            raise LlmError(f"Unexpected error: {str(e)}") from e
    
    async def complete_text(
        self,
        system: str,
        user: str,
        max_tokens: int = 1500
    ) -> str:
        """
        Выполняет запрос к LLM и возвращает текст (без парсинга JSON).
        Полезно для случаев, когда нужен просто текст.
        """
        try:
            # Экранируем фигурные скобки
            system_escaped = self._escape_braces(system)
            user_escaped = self._escape_braces(user)
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_escaped),
                ("user", user_escaped),
            ])
            
            llm_with_config = self.llm.bind(max_tokens=max_tokens)
            chain = prompt | llm_with_config | self.str_parser
            
            result = await chain.ainvoke({})
            return str(result)
            
        except LangChainException as e:
            raise LlmError(f"LangChain error: {str(e)}") from e
        except Exception as e:
            raise LlmError(f"Unexpected error: {str(e)}") from e


def get_langchain_llm_client(settings: LlmSettings):
    """
    Создает LangChain-клиент для указанного провайдера.
    
    Args:
        settings: Настройки LLM (provider, api_key, model)
    
    Returns:
        LangChain-клиент для работы с LLM
    
    Raises:
        LlmError: Если провайдер не поддерживается
    """
    provider = settings.provider.strip().lower()
    
    if provider == "perplexity":
        return LangChainPerplexityClient(
            api_key=settings.api_key,
            model=settings.model
        )
    
    raise LlmError(f"Unsupported LLM provider: {settings.provider}")

