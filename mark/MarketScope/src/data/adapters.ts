import type {
  Restaurant,
  Review,
  TechnicalAnalysis,
  CompetitorData,
  MarketingChannel,
} from '../types';

/**
 * Строит список CompetitorData из ресторанов и связанных сущностей для виджетов аналитики и AI insights.
 */
export function restaurantsToCompetitorData(
  restaurants: Restaurant[],
  technicalByRestaurant: Map<number, TechnicalAnalysis> = new Map(),
  reviewByRestaurant: Map<number, Review> = new Map(),
  marketingChannelsByRestaurant: Map<number, MarketingChannel[]> = new Map()
): CompetitorData[] {
  if (!restaurants.length) return [];
  const totalCheck = restaurants.reduce((s, r) => s + r.avg_check, 0);
  const avgCheck = totalCheck / restaurants.length;
  return restaurants.map((r) => {
    const tech = technicalByRestaurant.get(r.id);
    const review = reviewByRestaurant.get(r.id);
    const loadTime = tech?.load_time_sec ?? 0;
    const seoScore = tech ? (tech.https ? 20 : 0) + (tech.has_viewport ? 20 : 0) + (tech.title ? 20 : 0) + (tech.meta_description ? 20 : 0) + (tech.status_code === 200 ? 20 : 0) : 50;
    const reviewCount = review?.reviews_count ?? 0;
    const pos = (review?.positive?.length ?? 0) > 0 ? 70 : 50;
    const neg = (review?.negative?.length ?? 0) > 0 ? 30 : 50;
    const sentimentScore = Math.round((pos / (pos + neg)) * 100) || 50;
    const priceIndex = avgCheck > 0 ? Math.round((r.avg_check / avgCheck) * 100) : 100;
    const marketShare = restaurants.length > 0 ? Math.round(100 / restaurants.length) : 0;
    const rating = 3.5 + (r.cosine_score ?? 0) * 1.5;
    return {
      id: String(r.id),
      name: r.name,
      rating: Math.min(5, Math.round(rating * 10) / 10),
      marketShare,
      loadTime,
      seoScore: Math.min(100, seoScore),
      sentimentScore,
      reviewCount,
      financialHealth: 50 + Math.round((r.avg_check / 3000) * 30),
      priceIndex,
      monthlyTraffic: 20000 + Math.round(r.cosine_score * 30000),
      marketing_channels: marketingChannelsByRestaurant.get(r.id),
    };
  });
}
