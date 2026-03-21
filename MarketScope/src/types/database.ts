export interface Competitor {
  id: string;
  name: string;
  website: string;
  rating: number;
  market_share: number;
  sentiment_score: number;
  financial_health: number;
  price_index: number;
  seo_score: number;
  load_time: number;
  review_count: number;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface SeoMetric {
  id: string;
  competitor_id: string | null;
  metric: string;
  current_value: number;
  optimal_value: number;
  unit: string;
  created_at: string;
}

export interface ReviewTopic {
  id: string;
  competitor_id: string | null;
  topic: string;
  positive_percent: number;
  negative_percent: number;
  created_at: string;
}

export interface MarketingChannel {
  id: string;
  competitor_id: string | null;
  channel: string;
  reach: number;
  engagement: number;
  cost: number;
  created_at: string;
}

export interface PriceComparison {
  id: string;
  category: string;
  competitor_id: string | null;
  price: number;
  created_at: string;
}

export interface PerformanceData {
  id: string;
  competitor_id: string | null;
  period: string;
  time_range: string;
  value: number;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      competitors: {
        Row: Competitor;
        Insert: Omit<Competitor, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Competitor>;
      };
      seo_metrics: {
        Row: SeoMetric;
        Insert: Omit<SeoMetric, 'id' | 'created_at'>;
        Update: Partial<SeoMetric>;
      };
      review_topics: {
        Row: ReviewTopic;
        Insert: Omit<ReviewTopic, 'id' | 'created_at'>;
        Update: Partial<ReviewTopic>;
      };
      marketing_channels: {
        Row: MarketingChannel;
        Insert: Omit<MarketingChannel, 'id' | 'created_at'>;
        Update: Partial<MarketingChannel>;
      };
      price_comparisons: {
        Row: PriceComparison;
        Insert: Omit<PriceComparison, 'id' | 'created_at'>;
        Update: Partial<PriceComparison>;
      };
      performance_data: {
        Row: PerformanceData;
        Insert: Omit<PerformanceData, 'id' | 'created_at'>;
        Update: Partial<PerformanceData>;
      };
    };
  };
}
