export interface CompetitorData {
  id: string;
  name: string;
  website: string;
  rating: number;
  marketShare: number;
  sentimentScore: number;
  financialHealth: number;
  priceIndex: number;
  seoScore: number;
  loadTime: number;
  reviewCount: number;
}

export interface SeoMetric {
  metric: string;
  current: number;
  optimal: number;
  unit: string;
}

export interface ReviewTopic {
  topic: string;
  positive: number;
  negative: number;
}

export interface MarketingChannel {
  channel: string;
  reach: number;
  engagement: number;
  cost: number;
}

export interface PriceComparison {
  category: string;
  comp1: number;
  comp2: number;
  comp3: number;
  comp4: number;
}

export interface TimeRange {
  id: string;
  label: string;
  days: number;
}

export interface PerformanceData {
  month: string;
  competitor1: number;
  competitor2: number;
  competitor3: number;
  competitor4: number;
}