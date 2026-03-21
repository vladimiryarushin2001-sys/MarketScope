
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
  loyalty_format: string[];
  loyalty_cost_per_point: string;
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

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: Restaurant;
        Insert: Omit<Restaurant, 'id'>;
        Update: Partial<Restaurant>;
      };
      menus: {
        Row: Menu;
        Insert: Omit<Menu, 'id'>;
        Update: Partial<Menu>;
      };
      menu_items: {
        Row: MenuItem;
        Insert: Omit<MenuItem, 'id'>;
        Update: Partial<MenuItem>;
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, 'id'>;
        Update: Partial<Review>;
      };
      marketing: {
        Row: Marketing;
        Insert: Omit<Marketing, 'id'>;
        Update: Partial<Marketing>;
      };
      marketing_socials: {
        Row: MarketingSocial;
        Insert: Omit<MarketingSocial, 'id'>;
        Update: Partial<MarketingSocial>;
      };
      marketing_loyalty: {
        Row: MarketingLoyalty;
        Insert: Omit<MarketingLoyalty, 'id'>;
        Update: Partial<MarketingLoyalty>;
      };
      technical_analysis: {
        Row: TechnicalAnalysis;
        Insert: Omit<TechnicalAnalysis, 'id'>;
        Update: Partial<TechnicalAnalysis>;
      };
      strategic_report: {
        Row: StrategicReport;
        Insert: Omit<StrategicReport, 'id'>;
        Update: Partial<StrategicReport>;
      };
    };
  };
}
