export interface Restaurant {
  id: number;
  run_id?: number;
  name: string;
  address: string;
  type: string;
  cuisine: string;
  avg_check: number;
  description: string;
  link: string;
  cosine_score: number;
  site: string;
  delivery: boolean;
  working_hours: string;
  yandex_maps_link?: string;
  menu_url?: string;
  menu_files?: string[];
  is_reference_place?: boolean;
  conclusion?: string;
}

export interface Menu {
  id: number;
  run_id?: number;
  restaurant_id: number;
  status: string;
  menu_urls: string[];
  items_count: number;
  has_kids_menu: boolean;
  categories: string[];
  reference_conclusion?: string;
  conclusion?: string;
}

export interface MenuItem {
  id: number;
  run_id?: number;
  menu_id: number;
  category: string;
  name: string;
  price: number;
}

export interface Review {
  id: number;
  run_id?: number;
  restaurant_id: number;
  summary_mode: string;
  reviews_count: number;
  rating?: number;
  count_rating?: number;
  general_info: string;
  positive: string;
  negative: string;
  positive_reviews?: string[];
  negative_reviews?: string[];
  reference_conclusion?: string;
  conclusion?: string;
}

export interface Marketing {
  id: number;
  run_id?: number;
  restaurant_id: number;
  site: string;
  reference_conclusion?: string;
  conclusion?: string;
}

export interface MarketingSocial {
  id: number;
  run_id?: number;
  marketing_id: number;
  network: string;
  url: string;
  activity?: string;
}

export interface MarketingLoyalty {
  id: number;
  run_id?: number;
  marketing_id: number;
  has_loyalty: boolean;
  loyalty_name: string;
  loyalty_format: string[]; // v2: массив форматов
  loyalty_cost_per_point: string; // v2: иногда строка ("1 балл = 1 рубль")
  loyalty_how_to_earn: string;
}

export interface TechnicalAnalysis {
  id: number;
  run_id?: number;
  restaurant_id: number;
  url: string;
  status_code: number;
  load_time_sec: number;
  mobile_load_time_sec: number;
  page_size_kb: number;
  title: string;
  meta_description: string;
  https: boolean;
  has_viewport: boolean;
  error: string;
  reference_conclusion?: string;
  conclusion?: string;
}

export interface StrategicReport {
  id: number;
  run_id?: number;
  restaurant_id: number;
  block1: string;
  block2: string;
  block3: string;
  block4: string;
  block5: string;
  report_md: string;
  positioning: string;
  menu: string;
  reviews: string;
  marketing: string;
  technical_part: string;
  business_recommendations: string;
  reference_info: string;
}

export interface ClientRequest {
  id: number;
  user_id: string;
  query_text: string;
  request_type: 'market_overview' | 'competitive_analysis' | string;
  params?: Record<string, unknown>;
  created_at: string;
}

export interface AnalysisRun {
  id: number;
  request_id: number;
  report_type: string;
  created_at: string;
  source_csv?: string;
  top_n?: number;
  perplexity_model?: string;
}

/** Личный кабинет: профиль клиента */
export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  company?: string;
  position?: string;
  created_at?: string;
}

/** Подписка клиента */
export interface Subscription {
  id: number;
  user_id: string;
  plan_name: string;
  is_active: boolean;
  is_lifetime?: boolean;
  payment_provider?: string;
  external_payment_id?: string;
  started_at: string;
  expires_at: string | null;
  /** дней до окончания (положительное — осталось, 0 — сегодня, отрицательное — истекла) */
  days_left?: number;
}

export interface Payment {
  id: number;
  user_id: string;
  plan_code: string;
  amount_rub: number;
  period_days: number;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | string;
  provider: string;
  provider_payment_id: string;
  checkout_url: string;
  created_at: string;
  paid_at?: string | null;
}

/** Данные для виджетов аналитики (рейтинг, доля рынка, SEO и т.д.) */
export interface CompetitorData {
  id: string;
  name: string;
  rating: number;
  marketShare: number;
  loadTime: number;
  seoScore: number;
  sentimentScore: number;
  reviewCount: number;
  financialHealth: number;
  priceIndex: number;
  monthlyTraffic?: number;
  marketing_channels?: MarketingChannel[];
}

export interface MarketingChannel {
  channel: string;
  reach?: number;
  engagement?: number;
  cost?: number;
}

export interface SEOMetrics {
  metric: string;
  current: number;
  optimal: number;
  unit: string;
}

export interface SeoMetric extends SEOMetrics {}

export interface ReviewTopic {
  topic: string;
  positive: number;
  negative: number;
}

export interface TimeRange {
  id: string;
  label: string;
}
