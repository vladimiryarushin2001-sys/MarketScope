import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Subscription } from '../types';

const LIFETIME_USER_ID = 'cf933749-6d7a-4b12-8df2-6892912a0910';

function calcDaysLeft(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function useSubscriptionStatus() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setSubscription(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const { data, error: e } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (e) throw e;
        if (cancelled) return;
        setSubscription((data as Subscription | null) ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка загрузки подписки');
          setSubscription(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const state = useMemo(() => {
    if (!user) return { isActive: false, daysLeft: null as number | null, isLifetime: false };
    if (user.id === LIFETIME_USER_ID) return { isActive: true, daysLeft: null, isLifetime: true };
    const daysLeft = calcDaysLeft(subscription?.expires_at ?? null);
    const isLifetime = Boolean(subscription?.is_lifetime);
    const isActive = Boolean(subscription?.is_active) && (isLifetime || daysLeft === null || daysLeft > 0);
    return { isActive, daysLeft, isLifetime };
  }, [subscription, user]);

  return { loading, subscription, error, ...state };
}

