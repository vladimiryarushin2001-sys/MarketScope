import rawBlock1 from '../data/block1_output_russian.json';
import menuBlock from '../data/block2_output_russian.json';
import reviewsBlock from '../data/block3_reviews_raw.json';
import marketingBlock from '../data/block4_output_russian.json';
import techBlock from '../data/block5_output_russian.json';

export function getMenuForRestaurant(name) {
  if (!menuBlock || !menuBlock.menu_by_place) return null;

  const byPlace = menuBlock.menu_by_place;
  if (byPlace[name]) {
    return byPlace[name];
  }

  const normalized = (s) => (s ? s.toLowerCase().trim() : '');
  const target = normalized(name);

  const key = Object.keys(byPlace).find((k) => normalized(k) === target);
  return key ? byPlace[key] : null;
}

export function getAllRestaurants() {
  const places = rawBlock1.selected_places || [];

  return places.map((place) => ({
    name: place['название'],
    address: place['адрес'],
    type: place['тип_заведения'],
    cuisine: place['кухня'],
    averageCheck: place['средний_чек'],
    description: place['описание'],
    site: place['сайт'],
    delivery: place['доставка'],
    workingHours: place['время_работы'],
  }));
}

export function getReviewsForRestaurant(name) {
  if (!Array.isArray(reviewsBlock)) return null;

  const normalize = (s) => (s ? s.toLowerCase().trim() : '');
  const target = normalize(name);

  const entry =
    reviewsBlock.find((r) => {
      const candidates = [
        r.place_name,
        r.company_info && r.company_info.name,
      ].filter(Boolean);
      return candidates.some((c) => normalize(c) === target);
    }) || null;

  if (!entry) return null;

  const companyInfo = entry.company_info || {};
  const reviews = Array.isArray(entry.reviews) ? entry.reviews : [];

  const rating = companyInfo.rating ?? null;
  const ratingCount = companyInfo.count_rating ?? reviews.length;

  const distributionMap = new Map(
    [1, 2, 3, 4, 5].map((s) => [s, { stars: s, label: `${s}★`, count: 0 }])
  );

  reviews.forEach((rev) => {
    const s = rev.stars;
    if (typeof s === 'number' && distributionMap.has(s)) {
      distributionMap.get(s).count += 1;
    }
  });

  const ratingDistribution = Array.from(distributionMap.values());

  const latestReviews = [...reviews]
    .filter((r) => typeof r.date === 'number')
    .sort((a, b) => b.date - a.date)
    .slice(0, 3);

  return {
    rating,
    ratingCount,
    ratingDistribution,
    latestReviews,
  };
}

export function getMarketingForRestaurant(name) {
  if (!marketingBlock || !marketingBlock.marketing_by_place) return null;

  const byPlace = marketingBlock.marketing_by_place;
  const normalize = (s) => (s ? s.toLowerCase().trim() : '');
  const target = normalize(name);

  let entry = byPlace[name];
  if (!entry) {
    const key = Object.keys(byPlace).find((k) => normalize(k) === target);
    if (key) {
      entry = byPlace[key];
    }
  }

  if (!entry) return null;

  const site = entry['сайт'] || null;
  const socials = Array.isArray(entry['соцсети']) ? entry['соцсети'] : [];
  const loyalty = entry['программа_лояльности'] || {};

  return {
    site,
    socials,
    loyalty: {
      hasLoyalty: Boolean(loyalty.has_loyalty),
      name: loyalty.loyalty_name,
      format: loyalty.loyalty_format,
      costPerPoint: loyalty.loyalty_cost_per_point,
      howToEarn: loyalty.loyalty_how_to_earn,
    },
  };
}

export function getTechForRestaurant(name) {
  if (!techBlock || !techBlock.tech_by_place) return null;

  const byPlace = techBlock.tech_by_place;
  const normalize = (s) => (s ? s.toLowerCase().trim() : '');
  const target = normalize(name);

  let entry = byPlace[name];
  if (!entry) {
    const key = Object.keys(byPlace).find((k) => normalize(k) === target);
    if (key) {
      entry = byPlace[key];
    }
  }

  if (!entry) return null;

  return {
    url: entry.url || null,
    statusCode: entry.status_code,
    loadTimeSec: entry.load_time_sec,
    mobileLoadTimeSec: entry.mobile_load_time_sec,
    pageSizeKb: entry.page_size_kb,
    title: entry.title,
    metaDescription: entry.meta_description,
    https: Boolean(entry.https),
    hasViewport: Boolean(entry.has_viewport),
    error: entry.error || null,
  };
}
