import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
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
import { restaurantsToCompetitorData } from '../data/adapters';

export interface DashboardData {
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

function ensureNumber(id: unknown): number {
  if (typeof id === 'number' && !Number.isNaN(id)) return id;
  if (typeof id === 'string') return parseInt(id, 10) || 0;
  return 0;
}

function mapRowId<T extends Record<string, unknown>>(row: T, idKey: string = 'id'): T {
  if (row[idKey] != null) {
    return { ...row, [idKey]: ensureNumber(row[idKey]) } as T;
  }
  return row;
}

export function useDashboardData(runId?: number | null) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);

  const refetch = () => setRefreshTrigger((n) => n + 1);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        setLoading(true);
        setError(null);

        // Если runId === null — это явный сигнал "пока нет запусков для выбранного запроса"
        // (не делаем fallback на самый свежий run в проекте, чтобы не показывать чужие/старые данные).
        let rid = runId ?? undefined;
        if (runId === null) {
          setActiveRunId(null);
          setData({
            restaurants: [],
            menus: [],
            menuItems: [],
            reviews: [],
            marketing: [],
            marketingSocials: [],
            marketingLoyalty: [],
            technicalAnalysis: [],
            strategicReport: [],
          });
          return;
        }

        // если runId не передали (undefined) — возьмем самый свежий (по created_at)
        if (!rid) {
          const { data: latest, error: eLatest } = await supabase
            .from('analysis_runs')
            .select('id')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (eLatest) throw eLatest;
          rid = latest?.id ? Number(latest.id) : undefined;
        }
        setActiveRunId(rid ?? null);

        if (!rid) {
          // нет запусков — возвращаем пустые данные без ошибки
          setData({
            restaurants: [],
            menus: [],
            menuItems: [],
            reviews: [],
            marketing: [],
            marketingSocials: [],
            marketingLoyalty: [],
            technicalAnalysis: [],
            strategicReport: [],
          });
          return;
        }

        const [
          { data: restaurants, error: eRestaurants },
          { data: menus, error: eMenus },
          { data: menuItems, error: eMenuItems },
          { data: reviews, error: eReviews },
          { data: marketing, error: eMarketing },
          { data: marketingSocials, error: eMarketingSocials },
          { data: marketingLoyalty, error: eMarketingLoyalty },
          { data: technicalAnalysis, error: eTechnical },
          { data: strategicReport, error: eStrategic },
        ] = await Promise.all([
          supabase.from('restaurants').select('*').eq('run_id', rid).order('id'),
          supabase.from('menus').select('*').eq('run_id', rid).order('id'),
          supabase.from('menu_items').select('*').eq('run_id', rid).order('id'),
          supabase.from('reviews').select('*').eq('run_id', rid).order('id'),
          supabase.from('marketing').select('*').eq('run_id', rid).order('id'),
          supabase.from('marketing_socials').select('*').eq('run_id', rid).order('id'),
          supabase.from('marketing_loyalty').select('*').eq('run_id', rid).order('id'),
          supabase.from('technical_analysis').select('*').eq('run_id', rid).order('id'),
          supabase.from('strategic_report').select('*').eq('run_id', rid).order('id'),
        ]);

        const err =
          eRestaurants || eMenus || eMenuItems || eReviews || eMarketing ||
          eMarketingSocials || eMarketingLoyalty || eTechnical || eStrategic;
        if (err) throw err;

        if (cancelled) return;

        const mapRestaurant = (r: Record<string, unknown>) => mapRowId(r as Restaurant);
        const mapMenu = (m: Record<string, unknown>) => mapRowId(m as Menu);
        const mapMenuItem = (m: Record<string, unknown>) => mapRowId(m as MenuItem);
        const mapReview = (r: Record<string, unknown>) => mapRowId(r as Review);
        const mapMarketing = (m: Record<string, unknown>) => mapRowId(m as Marketing);
        const mapMarketingSocial = (s: Record<string, unknown>) => mapRowId(s as MarketingSocial);
        const mapMarketingLoyalty = (l: Record<string, unknown>) => mapRowId(l as MarketingLoyalty);
        const mapTechnical = (t: Record<string, unknown>) => mapRowId(t as TechnicalAnalysis);
        const mapStrategic = (s: Record<string, unknown>) => mapRowId(s as StrategicReport);

        setData({
          restaurants: (restaurants ?? []).map(mapRestaurant) as Restaurant[],
          menus: (menus ?? []).map(mapMenu) as Menu[],
          menuItems: (menuItems ?? []).map(mapMenuItem) as MenuItem[],
          reviews: (reviews ?? []).map(mapReview) as Review[],
          marketing: (marketing ?? []).map(mapMarketing) as Marketing[],
          marketingSocials: (marketingSocials ?? []).map(mapMarketingSocial) as MarketingSocial[],
          marketingLoyalty: (marketingLoyalty ?? []).map(mapMarketingLoyalty) as MarketingLoyalty[],
          technicalAnalysis: (technicalAnalysis ?? []).map(mapTechnical) as TechnicalAnalysis[],
          strategicReport: (strategicReport ?? []).map(mapStrategic) as StrategicReport[],
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки данных');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      fetchAll();
    } else {
      setLoading(false);
      setError(null);
      setData(null);
    }

    return () => { cancelled = true; };
  }, [refreshTrigger, runId]);

  const marketingChannelsByRestaurant = useMemo(() => {
    const map = new Map<number, Array<{ channel: string; reach?: number; engagement?: number; cost?: number }>>();
    if (!data?.marketing?.length || !data?.marketingSocials?.length) return map;
    const marketingByRestaurant = new Map<number, number[]>();
    data.marketing.forEach((m) => {
      const list = marketingByRestaurant.get(m.restaurant_id) ?? [];
      list.push(m.id);
      marketingByRestaurant.set(m.restaurant_id, list);
    });
    data.restaurants.forEach((r) => {
      const marketingIds = marketingByRestaurant.get(r.id) ?? [];
      const channels = data.marketingSocials
        .filter((s) => marketingIds.includes(s.marketing_id))
        .map((s) => ({ channel: s.network.charAt(0).toUpperCase() + s.network.slice(1) }));
      if (channels.length) map.set(r.id, channels);
    });
    return map;
  }, [data]);

  const competitorData = useMemo(() => {
    if (!data?.restaurants?.length) return [];
    const techMap = new Map(data.technicalAnalysis.map((t) => [t.restaurant_id, t]));
    const reviewMap = new Map(data.reviews.map((r) => [r.restaurant_id, r]));
    return restaurantsToCompetitorData(
      data.restaurants,
      techMap,
      reviewMap,
      marketingChannelsByRestaurant
    );
  }, [data, marketingChannelsByRestaurant]);

  return {
    data,
    restaurants: data?.restaurants ?? [],
    competitorData,
    reviews: data?.reviews ?? [],
    technicalAnalysis: data?.technicalAnalysis ?? [],
    strategicReport: data?.strategicReport ?? [],
    menus: data?.menus ?? [],
    menuItems: data?.menuItems ?? [],
    marketing: data?.marketing ?? [],
    marketingSocials: data?.marketingSocials ?? [],
    marketingLoyalty: data?.marketingLoyalty ?? [],
    activeRunId,
    loading,
    error,
    refetch,
    hasDb: Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
  };
}
