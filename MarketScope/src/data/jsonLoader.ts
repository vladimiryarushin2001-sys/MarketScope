/**
 * Загрузка данных из JSON в папках tmp/competitive и tmp/market.
 * Ожидаемая структура: в каждой папке файл data.json с полным набором сущностей
 * или отдельные файлы: restaurants.json, menus.json, reviews.json и т.д.
 */

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
} from '../types';

export interface JsonDataset {
  restaurants: Restaurant[];
  menus: Menu[];
  menuItems: MenuItem[];
  reviews: Review[];
  marketing: Marketing[];
  marketingSocials: MarketingSocial[];
  marketingLoyalty: MarketingLoyalty[];
  technicalAnalysis: TechnicalAnalysis[];
  strategicReport: StrategicReport[];
}

const EMPTY_DATASET: JsonDataset = {
  restaurants: [],
  menus: [],
  menuItems: [],
  reviews: [],
  marketing: [],
  marketingSocials: [],
  marketingLoyalty: [],
  technicalAnalysis: [],
  strategicReport: [],
};

/** Базовый URL для JSON (Vite отдаёт public/ с корня, копируйте tmp в public/tmp) */
const TMP_BASE = '/tmp';

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Загружает один источник (competitive или market) из data.json или из отдельных файлов */
async function loadOneSource(prefix: string): Promise<Partial<JsonDataset>> {
  const dataUrl = `${TMP_BASE}/${prefix}/data.json`;
  const data = await fetchJson<Partial<JsonDataset>>(dataUrl);
  if (data && Array.isArray(data.restaurants)) {
    return {
      restaurants: data.restaurants ?? [],
      menus: data.menus ?? data.menuItems ? [] : [],
      menuItems: data.menuItems ?? [],
      reviews: data.reviews ?? [],
      marketing: data.marketing ?? [],
      marketingSocials: data.marketingSocials ?? [],
      marketingLoyalty: data.marketingLoyalty ?? [],
      technicalAnalysis: data.technicalAnalysis ?? [],
      strategicReport: data.strategicReport ?? [],
    };
  }
  const [restaurants, menus, menuItems, reviews, marketing, marketingSocials, marketingLoyalty, technicalAnalysis, strategicReport] =
    await Promise.all([
      fetchJson<Restaurant[]>(`${TMP_BASE}/${prefix}/restaurants.json`),
      fetchJson<Menu[]>(`${TMP_BASE}/${prefix}/menus.json`),
      fetchJson<MenuItem[]>(`${TMP_BASE}/${prefix}/menu_items.json`),
      fetchJson<Review[]>(`${TMP_BASE}/${prefix}/reviews.json`),
      fetchJson<Marketing[]>(`${TMP_BASE}/${prefix}/marketing.json`),
      fetchJson<MarketingSocial[]>(`${TMP_BASE}/${prefix}/marketing_socials.json`),
      fetchJson<MarketingLoyalty[]>(`${TMP_BASE}/${prefix}/marketing_loyalty.json`),
      fetchJson<TechnicalAnalysis[]>(`${TMP_BASE}/${prefix}/technical_analysis.json`),
      fetchJson<StrategicReport[]>(`${TMP_BASE}/${prefix}/strategic_report.json`),
    ]);
  return {
    restaurants: restaurants ?? [],
    menus: menus ?? [],
    menuItems: menuItems ?? [],
    reviews: reviews ?? [],
    marketing: marketing ?? [],
    marketingSocials: marketingSocials ?? [],
    marketingLoyalty: marketingLoyalty ?? [],
    technicalAnalysis: technicalAnalysis ?? [],
    strategicReport: strategicReport ?? [],
  };
}

function mergeDatasets(a: Partial<JsonDataset>, b: Partial<JsonDataset>): JsonDataset {
  const nextId = (arr: { id: number }[], start: number) =>
    arr.length ? Math.max(...arr.map((x) => x.id), start) : start;
  let idOffset = 0;
  const ra = a.restaurants ?? [];
  const rb = b.restaurants ?? [];
  idOffset = nextId(ra, 0) + 1;
  const restaurants: Restaurant[] = [...ra];
  rb.forEach((r, i) => {
    restaurants.push({ ...r, id: idOffset + i });
  });
  const restIdMap = new Map<number, number>();
  rb.forEach((r, i) => restIdMap.set(r.id, idOffset + i));

  const rekey = <T extends { restaurant_id?: number; marketing_id?: number; menu_id?: number }>(
    arr: T[],
    key: 'restaurant_id' | 'marketing_id' | 'menu_id',
    oldToNew: Map<number, number>
  ): T[] =>
    arr.map((x) => {
      const v = x[key];
      if (v == null) return x;
      const n = oldToNew.get(v);
      return n != null ? { ...x, [key]: n } : x;
    });

  const menusB = (b.menus ?? []).map((m) => ({
    ...m,
    id: (a.menus?.length ?? 0) + m.id,
    restaurant_id: restIdMap.get(m.restaurant_id) ?? m.restaurant_id,
  }));
  const menus = [...(a.menus ?? []), ...menusB];
  const menuIdMap = new Map<number, number>();
  (b.menus ?? []).forEach((m, i) => menuIdMap.set(m.id, menusB[i].id));

  const menuItemsB = (b.menuItems ?? []).map((mi) => ({
    ...mi,
    id: (a.menuItems?.length ?? 0) + mi.id,
    menu_id: menuIdMap.get(mi.menu_id) ?? mi.menu_id,
  }));
  const menuItems = [...(a.menuItems ?? []), ...menuItemsB];

  const reviewsB = rekey(b.reviews ?? [], 'restaurant_id', restIdMap).map((r, i) => ({
    ...r,
    id: (a.reviews?.length ?? 0) + i + 1,
    restaurant_id: restIdMap.get(r.restaurant_id) ?? r.restaurant_id,
  }));
  const reviews = [...(a.reviews ?? []), ...reviewsB];

  const marketingB = (b.marketing ?? []).map((m, i) => ({
    ...m,
    id: (a.marketing?.length ?? 0) + i + 1,
    restaurant_id: restIdMap.get(m.restaurant_id) ?? m.restaurant_id,
  }));
  const marketing = [...(a.marketing ?? []), ...marketingB];
  const marketingIdMap = new Map<number, number>();
  (b.marketing ?? []).forEach((m, i) => marketingIdMap.set(m.id, marketingB[i].id));

  const marketingSocialsB = rekey(b.marketingSocials ?? [], 'marketing_id', marketingIdMap).map(
    (s, i) => ({ ...s, id: (a.marketingSocials?.length ?? 0) + i + 1 })
  );
  const marketingSocials = [...(a.marketingSocials ?? []), ...marketingSocialsB];

  const marketingLoyaltyB = rekey(b.marketingLoyalty ?? [], 'marketing_id', marketingIdMap).map(
    (l, i) => ({ ...l, id: (a.marketingLoyalty?.length ?? 0) + i + 1 })
  );
  const marketingLoyalty = [...(a.marketingLoyalty ?? []), ...marketingLoyaltyB];

  const technicalAnalysisB = (b.technicalAnalysis ?? []).map((t, i) => ({
    ...t,
    id: (a.technicalAnalysis?.length ?? 0) + i + 1,
    restaurant_id: restIdMap.get(t.restaurant_id) ?? t.restaurant_id,
  }));
  const technicalAnalysis = [...(a.technicalAnalysis ?? []), ...technicalAnalysisB];

  const strategicReportB = (b.strategicReport ?? []).map((s, i) => ({
    ...s,
    id: (a.strategicReport?.length ?? 0) + i + 1,
    restaurant_id: restIdMap.get(s.restaurant_id) ?? s.restaurant_id,
  }));
  const strategicReport = [...(a.strategicReport ?? []), ...strategicReportB];

  return {
    restaurants,
    menus,
    menuItems,
    reviews,
    marketing,
    marketingSocials,
    marketingLoyalty,
    technicalAnalysis,
    strategicReport,
  };
}

/**
 * Загружает данные из tmp/competitive и tmp/market, объединяет и возвращает JsonDataset.
 * Если ни один JSON не доступен, возвращает null (приложение должно использовать mockData).
 */
export async function loadFromTmp(): Promise<JsonDataset | null> {
  const [competitive, market] = await Promise.all([
    loadOneSource('competitive'),
    loadOneSource('market'),
  ]);
  const hasCompetitive = (competitive.restaurants?.length ?? 0) > 0;
  const hasMarket = (market.restaurants?.length ?? 0) > 0;
  if (!hasCompetitive && !hasMarket) return null;
  if (!hasCompetitive) return market as JsonDataset;
  if (!hasMarket) return competitive as JsonDataset;
  return mergeDatasets(competitive, market);
}
