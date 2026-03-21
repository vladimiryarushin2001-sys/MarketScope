from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Establishment(BaseModel):
    id: str = Field(..., description="Provider-specific identifier or stable slug")
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    similarity_score: Optional[float] = Field(
        None, description="Рейтинг схожести с запросом (0.0-1.0, где 1.0 - максимальное соответствие)"
    )


class SegmentResult(BaseModel):
    query: str
    establishments: List[Establishment] = Field(default_factory=list)


class FinanceSnapshot(BaseModel):
    establishment_id: str
    # Estimated revenue (рубли)
    min_revenue: Optional[float] = None
    max_revenue: Optional[float] = None
    avg_revenue: Optional[float] = None
    # Estimated average check (рубли)
    avg_check: Optional[float] = None
    # Estimated expenses (рубли)
    min_expenses: Optional[float] = None
    max_expenses: Optional[float] = None
    avg_expenses: Optional[float] = None
    # Estimated income/profit (рубли)
    min_income: Optional[float] = None
    max_income: Optional[float] = None
    avg_income: Optional[float] = None
    # Optional metadata
    margin: Optional[float] = None
    employees: Optional[int] = None
    source: Optional[str] = None


class ReviewItem(BaseModel):
    establishment_id: str
    source: str
    rating: Optional[float] = None
    text: Optional[str] = None


class ReviewSummary(BaseModel):
    establishment_id: str
    avg_rating: Optional[float] = None
    reviews_count: int = 0
    sentiment_score: Optional[float] = None
    overall_opinion: Optional[str] = None
    pros: List[str] = Field(default_factory=list, description="Top 3 positive points")
    cons: List[str] = Field(default_factory=list, description="Top 3 negative points")


class AggregatedEstablishment(BaseModel):
    establishment: Establishment
    finance: Optional[FinanceSnapshot] = None
    reviews: Optional[ReviewSummary] = None


class AggregatedAnalysis(BaseModel):
    query: str
    items: List[AggregatedEstablishment] = Field(default_factory=list)
    notes: Optional[str] = None


