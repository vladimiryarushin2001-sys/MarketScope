from __future__ import annotations

import os
import sys
from datetime import datetime
from typing import List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from ..config import AppConfig, load_config
from ..domain.models import AggregatedAnalysis, AggregatedEstablishment
from ..llm.client import LlmSettings, get_llm_client, LlmError


NICHE_ANALYSIS_PROMPT = (
    "Ты — аналитик рынка общественного питания. На основе предоставленной информации о заведениях "
    "сформируй развёрнутое описание ниши и общего запроса. Опиши: "
    "1) Общую характеристику ниши (тип кухни, концепция, целевая аудитория), "
    "2) Типичные особенности заведений в этой нише, "
    "3) Средний ценовой сегмент и его особенности, "
    "4) Общие тренды и паттерны, "
    "5) Ключевые конкурентные преимущества и недостатки. "
    "КРИТИЧЕСКИ ВАЖНО: В поле niche_description должен быть РЕАЛЬНЫЙ развёрнутый текст описания, "
    "а НЕ placeholder типа 'текст описания' или 'описание'. "
    "Верни СТРОГО валидный JSON: {\"niche_description\": \"развёрнутый текст с реальным описанием ниши\"} без пояснений."
)

BUSINESS_RECOMMENDATIONS_PROMPT = (
    "Ты — бизнес-консультант по ресторанному бизнесу. На основе анализа заведений в нише "
    "сформируй практические бизнес-рекомендации для открытия или развития заведения в этой сфере. "
    "Включи рекомендации по: "
    "1) Ценовой политике и позиционированию, "
    "2) Концепции и формату заведения, "
    "3) Финансовому планированию (инвестиции, окупаемость), "
    "4) Маркетингу и привлечению клиентов, "
    "5) Операционным рискам и способам их минимизации. "
    "Стиль: деловой, конкретный, с цифрами и примерами. "
    "КРИТИЧЕСКИ ВАЖНО: "
    "1) В поле recommendations должен быть РЕАЛЬНЫЙ развёрнутый текст рекомендаций, "
    "а НЕ placeholder типа 'текст рекомендаций' или 'рекомендации'. "
    "2) Рекомендации должны СТРОГО соответствовать ценовому сегменту из запроса пользователя. "
    "Если запрос про ПРЕМИУМ-сегмент — рекомендации только для премиум-заведений, "
    "если про СРЕДНИЙ — только для среднего сегмента, если про БЮДЖЕТНЫЙ — только для бюджетного. "
    "3) ЗАПРЕЩЕНО упоминать заведения или концепции из других ценовых сегментов. "
    "Например, для премиум стейкхауса НЕ упоминать массовые или бюджетные заведения. "
    "4) Анализируй средний чек и финансовые показатели из анализа заведений, "
    "чтобы точно определить сегмент и давать рекомендации только для этого сегмента. "
    "Верни СТРОГО валидный JSON: {\"recommendations\": \"развёрнутый текст с реальными рекомендациями\"} без пояснений."
)


async def _generate_business_recommendations(analysis: AggregatedAnalysis, config: AppConfig) -> str:
    """Генерирует бизнес-рекомендации для ниши на основе анализа заведений."""
    import sys
    if not config.llm_api_key:
        return "Бизнес-рекомендации недоступны (отсутствует LLM API ключ)."
    
    # Формируем сводку по заведениям для LLM
    establishments_summary = []
    for item in analysis.items:
        est = item.establishment
        finance = item.finance
        reviews = item.reviews
        
        summary_parts = [
            f"Название: {est.name}",
            f"Категория: {est.category or 'не указана'}",
        ]
        
        if finance and finance.avg_check:
            summary_parts.append(f"Средний чек: {finance.avg_check:.0f} руб")
        if finance and finance.avg_revenue:
            summary_parts.append(f"Выручка: {finance.avg_revenue:,.0f} руб/год")
        if finance and finance.avg_expenses:
            summary_parts.append(f"Расходы: {finance.avg_expenses:,.0f} руб/год")
        
        if reviews and reviews.avg_rating:
            summary_parts.append(f"Рейтинг: {reviews.avg_rating:.1f}")
        
        establishments_summary.append(" | ".join(summary_parts))
    
    # Определяем ценовой сегмент на основе среднего чека
    avg_checks = [
        item.finance.avg_check 
        for item in analysis.items 
        if item.finance and item.finance.avg_check
    ]
    segment_hint = ""
    if avg_checks:
        avg_check = sum(avg_checks) / len(avg_checks)
        if avg_check >= 3000:
            segment_hint = "ВАЖНО: Анализируемые заведения относятся к ПРЕМИУМ-сегменту (средний чек от 3000 руб). Рекомендации должны быть ТОЛЬКО для премиум-заведений. ЗАПРЕЩЕНО упоминать средние или бюджетные концепции."
        elif avg_check >= 1500:
            segment_hint = "ВАЖНО: Анализируемые заведения относятся к СРЕДНЕМУ сегменту (средний чек 1500-3000 руб). Рекомендации должны быть ТОЛЬКО для среднего сегмента. ЗАПРЕЩЕНО упоминать премиум или бюджетные концепции."
        else:
            segment_hint = "ВАЖНО: Анализируемые заведения относятся к БЮДЖЕТНОМУ сегменту (средний чек до 1500 руб). Рекомендации должны быть ТОЛЬКО для бюджетного сегмента. ЗАПРЕЩЕНО упоминать премиум или средние концепции."
    
    user_prompt = "\n".join([
        f"Запрос пользователя: {analysis.query}",
        "",
        segment_hint,
        "",
        "Анализ заведений в нише:",
        "\n".join(f"{i+1}. {s}" for i, s in enumerate(establishments_summary)),
        "",
        "Сформируй практические бизнес-рекомендации для этой ниши, СТРОГО соответствующие ценовому сегменту из запроса и анализа заведений.",
        "Рекомендации должны быть только для указанного сегмента, без упоминания других ценовых категорий.",
    ])
    
    settings = LlmSettings(
        provider=config.llm_provider or "perplexity",
        api_key=config.llm_api_key,
        model=config.llm_model or "sonar-reasoning-pro",
    )
    client = get_llm_client(settings, use_langchain=config.use_langchain)
    
    try:
        payload = await client.complete_json(
            system=BUSINESS_RECOMMENDATIONS_PROMPT,
            user=user_prompt,
            max_tokens=3000,
        )
        
        # Если клиент вернул _raw, пробуем коэрсию
        if isinstance(payload, dict) and "_raw" in payload:
            if (config.log_level or "").upper() == "DEBUG":
                print(f"[Отчёт] Бизнес-рекомендации: получен _raw ответ, выполняю коэрсию", file=sys.stderr)
            raw_text = str(payload.get("_raw", ""))
            # Определяем сегмент для промпта коэрсии
            avg_checks = [
                item.finance.avg_check 
                for item in analysis.items 
                if item.finance and item.finance.avg_check
            ]
            segment_note = ""
            if avg_checks:
                avg_check = sum(avg_checks) / len(avg_checks)
                if avg_check >= 3000:
                    segment_note = "КРИТИЧЕСКИ ВАЖНО: Рекомендации должны быть ТОЛЬКО для ПРЕМИУМ-сегмента. ЗАПРЕЩЕНО упоминать средние или бюджетные концепции."
                elif avg_check >= 1500:
                    segment_note = "КРИТИЧЕСКИ ВАЖНО: Рекомендации должны быть ТОЛЬКО для СРЕДНЕГО сегмента. ЗАПРЕЩЕНО упоминать премиум или бюджетные концепции."
                else:
                    segment_note = "КРИТИЧЕСКИ ВАЖНО: Рекомендации должны быть ТОЛЬКО для БЮДЖЕТНОГО сегмента. ЗАПРЕЩЕНО упоминать премиум или средние концепции."
            
            payload = await client.complete_json(
                system="Ты — конвертор данных в строгий JSON.",
                user=f"""Преобразуй текст ниже в валидный JSON:
{{
  "recommendations": "развёрнутый текст бизнес-рекомендаций"
}}

ВАЖНО: 
1) recommendations должен содержать развёрнутые практические бизнес-рекомендации (не просто "текст рекомендаций", а реальные рекомендации).
2) {segment_note}

Текст для преобразования:
{raw_text[:7000]}""",
                max_tokens=3000,
            )
        
        # Извлекаем рекомендации из ответа
        if isinstance(payload, dict):
            # Пробуем разные варианты ключей
            recommendations = (
                payload.get("recommendations") 
                or payload.get("recommendation") 
                or payload.get("text")
                or payload.get("content")
            )
            
            if recommendations:
                rec_str = str(recommendations).strip()
                # Проверяем, что это не просто placeholder
                if rec_str and rec_str.lower() not in ["текст рекомендаций", "рекомендации", "text", "none", "null"]:
                    if (config.log_level or "").upper() == "DEBUG":
                        print(f"[Отчёт] Бизнес-рекомендации успешно извлечены (длина: {len(rec_str)})", file=sys.stderr)
                    return rec_str
                else:
                    if (config.log_level or "").upper() == "DEBUG":
                        print(f"[Отчёт] Бизнес-рекомендации: получен placeholder вместо реального текста", file=sys.stderr)
        
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[Отчёт] Бизнес-рекомендации: не удалось извлечь из payload={payload}", file=sys.stderr)
        return "Не удалось сгенерировать бизнес-рекомендации."
    except LlmError as e:
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[Отчёт] Бизнес-рекомендации: ошибка LLM - {e}", file=sys.stderr)
        return "Не удалось сгенерировать бизнес-рекомендации (ошибка LLM)."


async def _generate_niche_description(analysis: AggregatedAnalysis, config: AppConfig) -> str:
    """Генерирует общее описание ниши на основе анализа заведений."""
    if not config.llm_api_key:
        return "Описание ниши недоступно (отсутствует LLM API ключ)."
    
    # Формируем краткую сводку по заведениям для LLM
    establishments_summary = []
    for item in analysis.items[:5]:  # Берем топ-5 для анализа
        est = item.establishment
        finance = item.finance
        reviews = item.reviews
        
        summary_parts = [
            f"Название: {est.name}",
            f"Категория: {est.category or 'не указана'}",
            f"Город: {est.city or 'не указан'}",
        ]
        
        if finance and finance.avg_check:
            summary_parts.append(f"Средний чек: {finance.avg_check:.0f} руб")
        
        if reviews and reviews.avg_rating:
            summary_parts.append(f"Рейтинг: {reviews.avg_rating:.1f}")
        
        if reviews and reviews.overall_opinion:
            summary_parts.append(f"Особенности: {reviews.overall_opinion[:200]}...")
        
        establishments_summary.append(" | ".join(summary_parts))
    
    user_prompt = "\n".join([
        f"Запрос пользователя: {analysis.query}",
        "",
        "Информация о найденных заведениях:",
        "\n".join(f"{i+1}. {s}" for i, s in enumerate(establishments_summary)),
        "",
        "Сформируй развёрнутое описание ниши на основе этой информации.",
    ])
    
    settings = LlmSettings(
        provider=config.llm_provider or "perplexity",
        api_key=config.llm_api_key,
        model=config.llm_model or "sonar-reasoning-pro",
    )
    client = get_llm_client(settings, use_langchain=config.use_langchain)
    
    try:
        import sys
        payload = await client.complete_json(
            system=NICHE_ANALYSIS_PROMPT,
            user=user_prompt,
            max_tokens=2000,
        )
        
        # Если клиент вернул _raw, пробуем коэрсию
        if isinstance(payload, dict) and "_raw" in payload:
            if (config.log_level or "").upper() == "DEBUG":
                print(f"[Отчёт] Описание ниши: получен _raw ответ, выполняю коэрсию", file=sys.stderr)
            raw_text = str(payload.get("_raw", ""))
            payload = await client.complete_json(
                system="Ты — конвертор данных в строгий JSON.",
                user=f"""Преобразуй текст ниже в валидный JSON:
{{
  "niche_description": "развёрнутый текст описания ниши"
}}

ВАЖНО: niche_description должен содержать развёрнутое описание ниши (не просто "текст описания", а реальное описание).

Текст для преобразования:
{raw_text[:7000]}""",
                max_tokens=2000,
            )
        
        # Извлекаем описание из ответа
        if isinstance(payload, dict):
            description = (
                payload.get("niche_description") 
                or payload.get("description")
                or payload.get("text")
                or payload.get("content")
            )
            if description:
                desc_str = str(description).strip()
                # Проверяем, что это не просто placeholder
                if desc_str and desc_str.lower() not in ["текст описания", "описание", "text", "none", "null"]:
                    if (config.log_level or "").upper() == "DEBUG":
                        print(f"[Отчёт] Описание ниши успешно извлечено (длина: {len(desc_str)})", file=sys.stderr)
                    return desc_str
                else:
                    if (config.log_level or "").upper() == "DEBUG":
                        print(f"[Отчёт] Описание ниши: получен placeholder вместо реального текста", file=sys.stderr)
        
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[Отчёт] Описание ниши: не удалось извлечь из payload={payload}", file=sys.stderr)
        return "Не удалось сгенерировать описание ниши."
    except LlmError as e:
        import sys
        if (config.log_level or "").upper() == "DEBUG":
            print(f"[Отчёт] Описание ниши: ошибка LLM - {e}, пробую retry", file=sys.stderr)
        # Retry с более строгим промптом
        try:
            retry_prompt = "\n".join([
                f"Запрос пользователя: {analysis.query}",
                "",
                "Информация о найденных заведениях:",
                "\n".join(f"{i+1}. {s}" for i, s in enumerate(establishments_summary)),
                "",
                "Сформируй развёрнутое описание ниши на основе этой информации. Верни СТРОГО валидный JSON:",
                '{"niche_description": "развёрнутый текст описания ниши"}',
                "",
                "ВАЖНО: niche_description должен содержать развёрнутое описание ниши (не просто 'текст описания', а реальное описание).",
            ])
            payload = await client.complete_json(
                system="Ты — аналитик рынка. Верни СТРОГО валидный JSON без пояснений, текста до/после и без markdown.",
                user=retry_prompt,
                max_tokens=2000,
            )
            
            # Извлекаем описание из ответа
            if isinstance(payload, dict):
                description = (
                    payload.get("niche_description") 
                    or payload.get("description")
                    or payload.get("text")
                    or payload.get("content")
                )
                if description:
                    desc_str = str(description).strip()
                    if desc_str and desc_str.lower() not in ["текст описания", "описание", "text", "none", "null"]:
                        if (config.log_level or "").upper() == "DEBUG":
                            print(f"[Отчёт] Описание ниши успешно извлечено после retry (длина: {len(desc_str)})", file=sys.stderr)
                        return desc_str
            
            if (config.log_level or "").upper() == "DEBUG":
                print(f"[Отчёт] Описание ниши: retry не помог, payload={payload}", file=sys.stderr)
            return "Не удалось сгенерировать описание ниши."
        except LlmError as retry_exc:
            if (config.log_level or "").upper() == "DEBUG":
                print(f"[Отчёт] Описание ниши: retry также не удался - {retry_exc}", file=sys.stderr)
            return "Не удалось сгенерировать описание ниши (ошибка LLM)."


def _format_establishment_table(items: List[AggregatedEstablishment], font_name: str = "Helvetica") -> Table:
    """Формирует таблицу с информацией о заведениях."""
    data = [["№", "Название", "Город", "Категория", "Ср. чек", "Рейтинг", "Схожесть"]]
    
    for idx, item in enumerate(items, 1):
        est = item.establishment
        finance = item.finance
        reviews = item.reviews
        
        avg_check = f"{finance.avg_check:.0f} руб" if finance and finance.avg_check else "—"
        rating = f"{reviews.avg_rating:.1f}" if reviews and reviews.avg_rating else "—"
        similarity = f"{est.similarity_score:.2f}" if est.similarity_score is not None else "—"
        
        data.append([
            str(idx),
            est.name[:30],  # Ограничиваем длину
            est.city or "—",
            (est.category or "—")[:20],
            avg_check,
            rating,
            similarity,
        ])
    
    bold_font = f"{font_name}-Bold" if font_name != "UnicodeFont" else "UnicodeFont"
    table = Table(data, colWidths=[1*cm, 5*cm, 3*cm, 3*cm, 2.5*cm, 2*cm, 2*cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),  # Заголовки по центру
        ("ALIGN", (0, 1), (0, -1), "CENTER"),  # Колонка № по центру
        ("ALIGN", (1, 1), (1, -1), "LEFT"),  # Название слева
        ("ALIGN", (2, 1), (2, -1), "LEFT"),  # Город слева
        ("ALIGN", (3, 1), (3, -1), "LEFT"),  # Категория слева
        ("ALIGN", (4, 1), (4, -1), "RIGHT"),  # Ср. чек справа
        ("ALIGN", (5, 1), (5, -1), "CENTER"),  # Рейтинг по центру
        ("ALIGN", (6, 1), (6, -1), "CENTER"),  # Схожесть по центру
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
        ("TOPPADDING", (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.black),
        ("FONTNAME", (0, 1), (-1, -1), font_name),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return table


def _register_unicode_fonts():
    """Регистрирует шрифты с поддержкой кириллицы."""
    # Пробуем найти и зарегистрировать шрифт с поддержкой Unicode
    font_paths = [
        # macOS - пробуем разные варианты (проверено, что Arial Unicode есть)
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        # Linux
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        # Windows (если запускается на Windows)
        "C:/Windows/Fonts/arialuni.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            try:
                # Регистрируем обычный и жирный шрифты
                pdfmetrics.registerFont(TTFont("UnicodeFont", font_path))
                # Пробуем зарегистрировать жирный вариант
                try:
                    bold_path = font_path.replace("Regular", "Bold").replace(".ttf", "Bold.ttf")
                    if os.path.exists(bold_path):
                        pdfmetrics.registerFont(TTFont("UnicodeFont-Bold", bold_path))
                except Exception:
                    pass
                print(f"[Отчёт] Используется шрифт с поддержкой Unicode: {font_path}", file=sys.stderr)
                return "UnicodeFont"
            except Exception as e:
                print(f"[Отчёт] Ошибка при загрузке шрифта {font_path}: {e}", file=sys.stderr)
                continue
    
    # Если не нашли внешний шрифт, предупреждаем
    print(f"[Отчёт] ВНИМАНИЕ: Не найден шрифт с поддержкой Unicode. Кириллица может отображаться некорректно.", file=sys.stderr)
    print(f"[Отчёт] Используется стандартный шрифт Helvetica (без поддержки кириллицы)", file=sys.stderr)
    return "Helvetica"


def generate_pdf_report(analysis: AggregatedAnalysis, niche_description: str, business_recommendations: str, output_path: str) -> None:
    """Генерирует PDF отчет с анализом заведений."""
    # Регистрируем шрифт с поддержкой кириллицы
    base_font_name = _register_unicode_fonts()
    
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    story = []
    styles = getSampleStyleSheet()
    
    # Обновляем стандартные стили для поддержки кириллицы ДО их использования
    for style_name in ["Normal", "Heading1", "Heading2", "Heading3"]:
        if style_name in styles:
            styles[style_name].fontName = base_font_name
    
    # Заголовок
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontName=base_font_name,
        fontSize=20,
        textColor=colors.HexColor("#1a1a1a"),
        spaceAfter=30,
        alignment=1,  # Center
    )
    story.append(Paragraph("Отчет по анализу рынка", title_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Информация о запросе
    info_style = ParagraphStyle(
        "InfoStyle",
        parent=styles["Normal"],
        fontName=base_font_name,
        fontSize=11,
    )
    story.append(Paragraph(f"<b>Запрос:</b> {analysis.query}", info_style))
    story.append(Paragraph(f"<b>Дата анализа:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}", info_style))
    story.append(Paragraph(f"<b>Количество заведений:</b> {len(analysis.items)}", info_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Описание ниши
    story.append(Paragraph("<b>Описание ниши и общего запроса</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.3*cm))
    
    niche_style = ParagraphStyle(
        "NicheDescription",
        parent=styles["Normal"],
        fontName=base_font_name,
        fontSize=10,
        leading=14,
        spaceAfter=8,
    )
    
    # Проверяем, что описание ниши не пустое
    # Проверяем, что описание ниши не пустое и не является сообщением об ошибке
    is_valid_niche = (
        niche_description 
        and niche_description.strip() 
        and niche_description != "Не удалось сгенерировать описание ниши." 
        and niche_description != "Не удалось сгенерировать описание ниши (ошибка LLM)."
        and len(niche_description.strip()) > 50  # Минимальная длина для реального описания
    )
    if is_valid_niche:
        # Заменяем символ рубля на "руб." для корректного отображения в PDF
        niche_description = niche_description.replace("₽", "руб.").replace("₽ ", "руб. ")
        # Разбиваем на абзацы для лучшей читаемости
        paragraphs = niche_description.split("\n\n")
        for para in paragraphs:
            if para.strip():
                story.append(Paragraph(para.strip().replace("\n", "<br/>"), niche_style))
                story.append(Spacer(1, 0.2*cm))
    else:
        story.append(Paragraph("Описание ниши недоступно.", niche_style))
    story.append(Spacer(1, 0.5*cm))
    
    # Таблица заведений
    story.append(Paragraph("<b>Топ заведений</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.3*cm))
    story.append(_format_establishment_table(analysis.items, base_font_name))
    story.append(PageBreak())
    
    # Детальная информация по каждому заведению
    story.append(Paragraph("<b>Детальная информация по заведениям</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.5*cm))
    
    for idx, item in enumerate(analysis.items, 1):
        est = item.establishment
        finance = item.finance
        reviews = item.reviews
        
        # Заголовок заведения
        est_title = f"{idx}. {est.name}"
        story.append(Paragraph(est_title, styles["Heading3"]))
        story.append(Spacer(1, 0.2*cm))
        
        # Основная информация (сухая, деловая)
        info_lines = []
        if est.city:
            info_lines.append(f"<b>Город:</b> {est.city}")
        if est.category:
            info_lines.append(f"<b>Категория:</b> {est.category}")
        if est.address:
            info_lines.append(f"<b>Адрес:</b> {est.address}")
        
        if info_lines:
            story.append(Paragraph(" | ".join(info_lines), styles["Normal"]))
            story.append(Spacer(1, 0.2*cm))
        
        # Финансовые показатели (ключевые метрики)
        if finance:
            finance_lines = []
            if finance.avg_check:
                finance_lines.append(f"<b>Средний чек:</b> {finance.avg_check:.0f} руб")
            if finance.avg_revenue:
                finance_lines.append(f"<b>Выручка:</b> {finance.avg_revenue:,.0f} руб/год")
            if finance.avg_expenses:
                finance_lines.append(f"<b>Расходы:</b> {finance.avg_expenses:,.0f} руб/год")
            if finance.avg_income:
                finance_lines.append(f"<b>Доход:</b> {finance.avg_income:,.0f} руб/год")
            
            if finance_lines:
                story.append(Paragraph(" | ".join(finance_lines), styles["Normal"]))
                story.append(Spacer(1, 0.2*cm))
        
        # Отзывы и аналитика
        if reviews:
            review_lines = []
            if reviews.avg_rating:
                review_lines.append(f"<b>Рейтинг:</b> {reviews.avg_rating:.1f}/5.0")
            if reviews.reviews_count and reviews.reviews_count > 0:
                review_lines.append(f"<b>Отзывов:</b> {reviews.reviews_count}")
            
            if review_lines:
                story.append(Paragraph(" | ".join(review_lines), styles["Normal"]))
            
            # Бизнес-аналитическое описание (отдельный абзац)
            if reviews.overall_opinion:
                story.append(Spacer(1, 0.25*cm))
                story.append(Paragraph("<b>Бизнес-аналитика:</b>", styles["Normal"]))
                story.append(Spacer(1, 0.1*cm))
                business_style = ParagraphStyle(
                    "BusinessStyle",
                    parent=styles["Normal"],
                    fontName=base_font_name,
                    fontSize=9,
                    leading=13,
                    spaceAfter=8,
                )
                # Разбиваем на абзацы для лучшей читаемости
                paragraphs = reviews.overall_opinion.split("\n\n")
                for para in paragraphs:
                    if para.strip():
                        story.append(Paragraph(para.strip().replace("\n", "<br/>"), business_style))
                        story.append(Spacer(1, 0.15*cm))
            
            # Преимущества (отдельный абзац)
            if reviews.pros:
                story.append(Spacer(1, 0.2*cm))
                story.append(Paragraph("<b>Преимущества:</b>", styles["Normal"]))
                story.append(Spacer(1, 0.1*cm))
                for pro in reviews.pros:
                    story.append(Paragraph(f"• {pro}", styles["Normal"]))
            
            # Риски (отдельный абзац)
            if reviews.cons:
                story.append(Spacer(1, 0.2*cm))
                story.append(Paragraph("<b>Риски:</b>", styles["Normal"]))
                story.append(Spacer(1, 0.1*cm))
                for con in reviews.cons:
                    story.append(Paragraph(f"• {con}", styles["Normal"]))
        
        story.append(Spacer(1, 0.3*cm))
        
        # Разделитель между заведениями (кроме последнего)
        if idx < len(analysis.items):
            story.append(Spacer(1, 0.2*cm))
    
    # Бизнес-рекомендации
    story.append(PageBreak())
    story.append(Paragraph("<b>Бизнес-рекомендации для ниши</b>", styles["Heading2"]))
    story.append(Spacer(1, 0.3*cm))
    
    recommendations_style = ParagraphStyle(
        "RecommendationsStyle",
        parent=styles["Normal"],
        fontName=base_font_name,
        fontSize=10,
        leading=14,
        spaceAfter=8,
    )
    
    # Проверяем, что бизнес-рекомендации не пустые и не являются сообщением об ошибке
    is_valid_recommendations = (
        business_recommendations 
        and business_recommendations.strip() 
        and business_recommendations != "Не удалось сгенерировать бизнес-рекомендации." 
        and business_recommendations != "Не удалось сгенерировать бизнес-рекомендации (ошибка LLM)."
        and len(business_recommendations.strip()) > 50  # Минимальная длина для реальных рекомендаций
    )
    if is_valid_recommendations:
        # Заменяем символ рубля на "руб." для корректного отображения в PDF
        business_recommendations = business_recommendations.replace("₽", "руб.").replace("₽ ", "руб. ")
        # Разбиваем на абзацы для лучшей читаемости
        paragraphs = business_recommendations.split("\n\n")
        for para in paragraphs:
            if para.strip():
                story.append(Paragraph(para.strip().replace("\n", "<br/>"), recommendations_style))
                story.append(Spacer(1, 0.2*cm))
    else:
        story.append(Paragraph("Бизнес-рекомендации недоступны.", recommendations_style))
    
    # Генерируем PDF
    doc.build(story)


async def create_report(analysis: AggregatedAnalysis, output_dir: str = ".") -> str:
    """Создает PDF отчет и возвращает путь к файлу."""
    import sys
    config = load_config()
    
    print(f"[Этап 3/3] Начинаю генерацию PDF отчёта...", file=sys.stderr)
    # Генерируем описание ниши
    print(f"[Отчёт] Генерирую описание ниши...", file=sys.stderr)
    niche_description = await _generate_niche_description(analysis, config)
    if niche_description and niche_description.strip():
        print(f"[Отчёт] Описание ниши сгенерировано (длина: {len(niche_description)} символов)", file=sys.stderr)
    else:
        print(f"[Отчёт] ВНИМАНИЕ: Описание ниши не сгенерировано или пустое", file=sys.stderr)
    
    # Генерируем бизнес-рекомендации
    print(f"[Отчёт] Генерирую бизнес-рекомендации...", file=sys.stderr)
    business_recommendations = await _generate_business_recommendations(analysis, config)
    if business_recommendations and business_recommendations.strip():
        print(f"[Отчёт] Бизнес-рекомендации сгенерированы (длина: {len(business_recommendations)} символов)", file=sys.stderr)
    else:
        print(f"[Отчёт] ВНИМАНИЕ: Бизнес-рекомендации не сгенерированы или пустые", file=sys.stderr)
    
    # Формируем имя файла
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_query = "".join(c if c.isalnum() or c in (" ", "-", "_") else "_" for c in analysis.query[:50])
    filename = f"marketscoup_report_{safe_query.replace(' ', '_')}_{timestamp}.pdf"
    output_path = os.path.join(output_dir, filename)
    
    # Генерируем PDF
    print(f"[Отчёт] Формирую PDF документ...", file=sys.stderr)
    generate_pdf_report(analysis, niche_description, business_recommendations, output_path)
    print(f"[Этап 3/3] PDF отчёт успешно создан", file=sys.stderr)
    
    return output_path

