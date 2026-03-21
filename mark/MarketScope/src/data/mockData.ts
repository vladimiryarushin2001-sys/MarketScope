
import type {
  Restaurant,
  Menu,
  MenuItem,
  Review,
  Marketing,
  MarketingSocial,
  MarketingLoyalty,
  TechnicalAnalysis,
  StrategicReport,
  UserProfile,
  Subscription,
  CompetitorData,
  ReviewTopic,
  MarketingChannel,
} from '../types';
import { restaurantsToCompetitorData } from './adapters';

export const restaurants: Restaurant[] = [
  {
    id: 1,
    name: 'Ruski',
    address: 'Москва-Сити, Пресненская наб., 12',
    type: 'Панорамный ресторан',
    cuisine: 'Русская',
    avg_check: 2500,
    description: 'Панорамный ресторан русской кухни в Москва-Сити.',
    link: 'https://ruski.com',
    cosine_score: 0.95,
    site: 'https://ruski.com',
    delivery: true,
    working_hours: '10:00-23:00',
  },
  {
    id: 2,
    name: 'Birds',
    address: 'Москва-Сити, Пресненская наб., 12',
    type: 'Бар-ресторан',
    cuisine: 'Европейская',
    avg_check: 1800,
    description: 'Бар с шоу-программой и коктейлями.',
    link: 'https://birds.moscow',
    cosine_score: 0.89,
    site: 'https://birds.moscow',
    delivery: false,
    working_hours: '12:00-02:00',
  },
];

export const menus: Menu[] = [
  {
    id: 1,
    restaurant_id: 1,
    status: 'parsed',
    menu_urls: ['https://ruski.com/menu.pdf'],
    items_count: 3,
    has_kids_menu: true,
    categories: ['Основные блюда', 'Десерты', 'Напитки'],
  },
  {
    id: 2,
    restaurant_id: 2,
    status: 'parsed',
    menu_urls: ['https://birds.moscow/menu.pdf'],
    items_count: 2,
    has_kids_menu: false,
    categories: ['Бар', 'Основные блюда'],
  },
];

export const menuItems: MenuItem[] = [
  { id: 1, menu_id: 1, category: 'Основные блюда', name: 'Борщ', price: 450 },
  { id: 2, menu_id: 1, category: 'Десерты', name: 'Медовик', price: 350 },
  { id: 3, menu_id: 1, category: 'Напитки', name: 'Морс', price: 200 },
  { id: 4, menu_id: 2, category: 'Бар', name: 'Коктейль Birds', price: 700 },
  { id: 5, menu_id: 2, category: 'Основные блюда', name: 'Стейк', price: 1200 },
];

export const reviews: Review[] = [
  {
    id: 1,
    restaurant_id: 1,
    summary_mode: 'perplexity',
    reviews_count: 132,
    general_info: 'Гости отмечают панорамный вид и сильную кухню, жалобы на ожидание в пиковые часы.',
    positive: 'Панорамный вид; Сильные десерты; Запоминающаяся атмосфера',
    negative: 'Ожидание горячих блюд; Высокий шум при полной посадке',
  },
  {
    id: 2,
    restaurant_id: 2,
    summary_mode: 'perplexity',
    reviews_count: 88,
    general_info: 'Конкурент выигрывает по вечерней атмосфере и барной составляющей, уступает по кухне.',
    positive: 'Коктейли; Шоу-атмосфера',
    negative: 'Неровное качество блюд',
  },
];

export const marketing: Marketing[] = [
  { id: 1, restaurant_id: 1, site: 'https://ruski.com' },
  { id: 2, restaurant_id: 2, site: 'https://birds.moscow' },
];

export const marketingSocials: MarketingSocial[] = [
  { id: 1, marketing_id: 1, network: 'telegram', url: 'https://t.me/ruski_rest' },
  { id: 2, marketing_id: 1, network: 'instagram', url: 'https://instagram.com/ruski_rest' },
  { id: 3, marketing_id: 2, network: 'instagram', url: 'https://instagram.com/birds.moscow' },
];

export const marketingLoyalty: MarketingLoyalty[] = [
  {
    id: 1,
    marketing_id: 1,
    has_loyalty: true,
    loyalty_name: 'Ruski Club',
    loyalty_format: ['кэшбэк', 'спецпредложения'],
    loyalty_cost_per_point: '1',
    loyalty_how_to_earn: 'Бонусы начисляются после регистрации и оплаты счета',
  },
  {
    id: 2,
    marketing_id: 2,
    has_loyalty: false,
    loyalty_name: '',
    loyalty_format: [],
    loyalty_cost_per_point: '',
    loyalty_how_to_earn: '',
  },
];

export const technicalAnalysis: TechnicalAnalysis[] = [
  {
    id: 1,
    restaurant_id: 1,
    url: 'https://ruski.com',
    status_code: 200,
    load_time_sec: 1.52,
    mobile_load_time_sec: 2.41,
    page_size_kb: 1040.2,
    title: 'Ruski Restaurant',
    meta_description: 'Панорамный ресторан русской кухни в Москва-Сити.',
    https: true,
    has_viewport: true,
    error: '',
  },
  {
    id: 2,
    restaurant_id: 2,
    url: 'https://birds.moscow',
    status_code: 0,
    load_time_sec: 0,
    mobile_load_time_sec: 0,
    page_size_kb: 0,
    title: '',
    meta_description: '',
    https: false,
    has_viewport: false,
    error: 'ssl handshake error',
  },
];

export const strategicReport: StrategicReport[] = [
  {
    id: 1,
    restaurant_id: 1,
    block1: 'block1_output.json',
    block2: 'block2_output.json',
    block3: 'block3_output.json',
    block4: 'block4_output.json',
    block5: 'block5_output.json',
    report_md: '# Конкурентный отчет\n\n## Позиционирование\nRuski удерживает сильную видовую премиальную позицию.',
    positioning: 'Ruski выигрывает за счет русской кухни и панорамы, Birds сильнее в вечернем сценарии.',
    menu: 'У Ruski меню более цельное и считывается как гастрономическое, у Birds акцент смещен в бар и event-составляющую.',
    reviews: 'У reference-заведения сильнее кухня и вид, у конкурента выше доля упоминаний атмосферы и шоу.',
    marketing: 'Оба игрока присутствуют в соцсетях, но у Ruski лучше упакована программа лояльности.',
    technical_part: 'У Ruski сайт стабильнее, у конкурента заметны технические проблемы доступа.',
    business_recommendations: 'Стоит усиливать скорость сервиса и яснее выносить фирменные блюда в коммуникацию.',
    reference_info: 'Раздел собран на основе выходов блоков 1-5.',
  },
];

const techMap = new Map(technicalAnalysis.map((t) => [t.restaurant_id, t]));
const reviewMap = new Map(reviews.map((r) => [r.restaurant_id, r]));
const marketingChannelsByRestaurant = new Map<number, MarketingChannel[]>([
  [1, [{ channel: 'Instagram', reach: 45000, engagement: 4.2, cost: 85000 }, { channel: 'VK', reach: 38000, engagement: 3.8, cost: 62000 }]],
  [2, [{ channel: 'Instagram', reach: 32000, engagement: 3.8, cost: 65000 }]],
]);

export const competitors: CompetitorData[] = restaurantsToCompetitorData(
  restaurants,
  techMap,
  reviewMap,
  marketingChannelsByRestaurant
);

export const reviewTopics: ReviewTopic[] = [
  { topic: 'Качество еды', positive: 85, negative: 15 },
  { topic: 'Обслуживание', positive: 72, negative: 28 },
  { topic: 'Атмосфера', positive: 90, negative: 10 },
  { topic: 'Цены', positive: 45, negative: 55 },
];

export const priceComparison: { category: string; comp1?: number; comp2?: number; comp3?: number; comp4?: number }[] = [
  { category: 'Бизнес-ланч', comp1: 450, comp2: 380 },
  { category: 'Ужин', comp1: 2500, comp2: 1800 },
  { category: 'Напитки', comp1: 200, comp2: 350 },
];

export const marketingChannels: MarketingChannel[] = [
  { channel: 'Instagram', reach: 45000, engagement: 4.2, cost: 85000 },
  { channel: 'VK', reach: 38000, engagement: 3.8, cost: 62000 },
  { channel: 'Яндекс.Директ', reach: 52000, engagement: 2.1, cost: 120000 },
];

function subscriptionDaysLeft(expiresAt: string): number {
  const end = new Date(expiresAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export const userProfile: UserProfile = {
  id: 1,
  email: 'client@example.com',
  full_name: 'Иван Петров',
  phone: '+7 (495) 123-45-67',
  company: 'ООО «Ресторан Групп»',
  position: 'Директор по развитию',
  created_at: '2024-01-15T10:00:00Z',
};

export const subscription: Subscription = (() => {
  const expiresAt = '2025-06-30';
  const daysLeft = subscriptionDaysLeft(expiresAt);
  return {
    id: 1,
    user_id: 1,
    plan_name: 'MarketScope Про',
    is_active: daysLeft > 0,
    started_at: '2024-07-01',
    expires_at: expiresAt,
    days_left: daysLeft,
  };
})();

