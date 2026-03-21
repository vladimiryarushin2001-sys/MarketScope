// import type { CompetitorData, SeoMetric, ReviewTopic, MarketingChannel, PriceComparison } from '../types';
import type { CompetitorData, SeoMetric, ReviewTopic, MarketingChannel, PriceComparison, PerformanceData, TimeRange } from '../types';

export const competitors: CompetitorData[] = [
  {
    id: '1',
    name: 'Вкусно и точка',
    website: 'vkusnoitochka.ru',
    rating: 4.2,
    marketShare: 18,
    sentimentScore: 72,
    financialHealth: 85,
    priceIndex: 95,
    seoScore: 88,
    loadTime: 2.3,
    reviewCount: 15420,
  },
  {
    id: '2',
    name: 'Теремок',
    website: 'teremok.ru',
    rating: 4.5,
    marketShare: 12,
    sentimentScore: 81,
    financialHealth: 78,
    priceIndex: 102,
    seoScore: 92,
    loadTime: 1.8,
    reviewCount: 12350,
  },
  {
    id: '3',
    name: 'Шоколадница',
    website: 'shoko.ru',
    rating: 4.3,
    marketShare: 15,
    sentimentScore: 76,
    financialHealth: 82,
    priceIndex: 110,
    seoScore: 85,
    loadTime: 2.1,
    reviewCount: 18900,
  },
  {
    id: '4',
    name: 'Кофемания',
    website: 'coffeemania.ru',
    rating: 4.6,
    marketShare: 8,
    sentimentScore: 88,
    financialHealth: 90,
    priceIndex: 125,
    seoScore: 90,
    loadTime: 1.5,
    reviewCount: 8750,
  },
];

// Добавим разные наборы данных для разных периодов
export const timeRanges: TimeRange[] = [
  { id: '7d', label: '7 дней', days: 7 },
  { id: '30d', label: '30 дней', days: 30 },
  { id: '90d', label: '90 дней', days: 90 },
  { id: '1y', label: '1 год', days: 365 },
];

export const performanceData: Record<string, PerformanceData[]> = {
  '7d': [
    { month: 'Пн', competitor1: 85, competitor2: 78, competitor3: 82, competitor4: 90 },
    { month: 'Вт', competitor1: 87, competitor2: 80, competitor3: 84, competitor4: 88 },
    { month: 'Ср', competitor1: 86, competitor2: 82, competitor3: 85, competitor4: 91 },
    { month: 'Чт', competitor1: 88, competitor2: 85, competitor3: 83, competitor4: 92 },
    { month: 'Пт', competitor1: 90, competitor2: 87, competitor3: 86, competitor4: 93 },
    { month: 'Сб', competitor1: 92, competitor2: 88, competitor3: 88, competitor4: 94 },
    { month: 'Вс', competitor1: 91, competitor2: 89, competitor3: 87, competitor4: 95 },
  ],
  '30d': [
    { month: 'Неделя 1', competitor1: 85, competitor2: 78, competitor3: 82, competitor4: 90 },
    { month: 'Неделя 2', competitor1: 87, competitor2: 80, competitor3: 84, competitor4: 88 },
    { month: 'Неделя 3', competitor1: 86, competitor2: 82, competitor3: 85, competitor4: 91 },
    { month: 'Неделя 4', competitor1: 88, competitor2: 85, competitor3: 83, competitor4: 92 },
  ],
  '90d': [
    { month: 'Янв', competitor1: 85, competitor2: 78, competitor3: 82, competitor4: 90 },
    { month: 'Фев', competitor1: 87, competitor2: 80, competitor3: 84, competitor4: 88 },
    { month: 'Мар', competitor1: 86, competitor2: 82, competitor3: 85, competitor4: 91 },
  ],
  '1y': [
    { month: 'Янв', competitor1: 85, competitor2: 78, competitor3: 82, competitor4: 90 },
    { month: 'Фев', competitor1: 87, competitor2: 80, competitor3: 84, competitor4: 88 },
    { month: 'Мар', competitor1: 86, competitor2: 82, competitor3: 85, competitor4: 91 },
    { month: 'Апр', competitor1: 88, competitor2: 85, competitor3: 83, competitor4: 92 },
    { month: 'Май', competitor1: 90, competitor2: 87, competitor3: 86, competitor4: 93 },
    { month: 'Июн', competitor1: 92, competitor2: 88, competitor3: 88, competitor4: 94 },
    { month: 'Июл', competitor1: 91, competitor2: 89, competitor3: 87, competitor4: 95 },
    { month: 'Авг', competitor1: 93, competitor2: 90, competitor3: 89, competitor4: 96 },
    { month: 'Сен', competitor1: 94, competitor2: 91, competitor3: 90, competitor4: 97 },
    { month: 'Окт', competitor1: 95, competitor2: 92, competitor3: 91, competitor4: 98 },
    { month: 'Ноя', competitor1: 96, competitor2: 93, competitor3: 92, competitor4: 99 },
    { month: 'Дек', competitor1: 97, competitor2: 94, competitor3: 93, competitor4: 100 },
  ],
};

// Добавим данные, которые зависят от времени
export const getTimeDependentData = (timeRange: string) => {
  const baseMetrics = {
    rating: 4.4,
    marketShare: 53,
    sentimentScore: 79,
    seoScore: 88,
  };

  const multipliers = {
    '7d': 1,
    '30d': 1.02,
    '90d': 1.05,
    '1y': 1.1,
  };

  const multiplier = multipliers[timeRange as keyof typeof multipliers] || 1;

  return {
    rating: (baseMetrics.rating * multiplier).toFixed(1),
    marketShare: Math.round(baseMetrics.marketShare * multiplier),
    sentimentScore: Math.round(baseMetrics.sentimentScore * multiplier),
    seoScore: Math.round(baseMetrics.seoScore * multiplier),
  };
};

export const seoMetrics: SeoMetric[] = [
  { metric: 'Скорость загрузки', current: 2.1, optimal: 1.5, unit: 'сек' },
  { metric: 'Mobile-friendly', current: 92, optimal: 100, unit: '%' },
  { metric: 'Индексация', current: 85, optimal: 95, unit: '%' },
  { metric: 'Обратные ссылки', current: 1250, optimal: 2000, unit: 'шт' },
  {
    metric: 'Органический трафик',
    current: 45000,
    optimal: 60000,
    unit: 'визитов',
  },
];

export const reviewTopics: ReviewTopic[] = [
  { topic: 'Качество еды', positive: 78, negative: 22 },
  { topic: 'Обслуживание', positive: 82, negative: 18 },
  { topic: 'Цены', positive: 45, negative: 55 },
  { topic: 'Атмосфера', positive: 71, negative: 29 },
  { topic: 'Чистота', positive: 88, negative: 12 },
  { topic: 'Скорость', positive: 66, negative: 34 },
];

export const marketingChannels: MarketingChannel[] = [
  { channel: 'Instagram', reach: 45000, engagement: 4.2, cost: 85000 },
  { channel: 'VK', reach: 38000, engagement: 3.8, cost: 62000 },
  { channel: 'Яндекс.Директ', reach: 52000, engagement: 2.1, cost: 120000 },
  { channel: 'Google Ads', reach: 28000, engagement: 2.5, cost: 95000 },
  { channel: 'Telegram', reach: 15000, engagement: 5.1, cost: 35000 },
];

export const priceComparison: PriceComparison[] = [
  { category: 'Бизнес-ланч', comp1: 350, comp2: 420, comp3: 480, comp4: 550 },
  { category: 'Кофе', comp1: 180, comp2: 200, comp3: 220, comp4: 280 },
  { category: 'Десерты', comp1: 250, comp2: 280, comp3: 320, comp4: 380 },
  { category: 'Салаты', comp1: 320, comp2: 380, comp3: 420, comp4: 480 },
  {
    category: 'Основные блюда',
    comp1: 450,
    comp2: 520,
    comp3: 580,
    comp4: 650,
  },
];

