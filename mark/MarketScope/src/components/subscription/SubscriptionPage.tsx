import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useSubscriptionStatus } from '../../hooks/useSubscriptionStatus';

interface SubscriptionPageProps {
  onBackToRequest?: () => void;
}

type Plan = {
  code: 'starter' | 'business' | 'enterprise';
  title: string;
  monthPrice: string;
  yearPrice: string;
  features: Array<{ text: string; included: boolean }>;
  accent: string;
};

const plans: Plan[] = [
  {
    code: 'starter',
    title: 'Стартовый',
    monthPrice: '5 000 ₽/мес',
    yearPrice: 'или 50 000 ₽/год',
    accent: 'bg-blue-900/80',
    features: [
      { text: 'До 5 конкурентов', included: true },
      { text: 'Базовая аналитика', included: true },
      { text: 'Еженедельные отчеты', included: true },
      { text: 'Email-уведомления', included: true },
      { text: 'AI-рекомендации', included: false },
      { text: 'Расширенные отчеты', included: false },
    ],
  },
  {
    code: 'business',
    title: 'Бизнес',
    monthPrice: '15 000 ₽/мес',
    yearPrice: 'или 150 000 ₽/год',
    accent: 'bg-cyan-900/80',
    features: [
      { text: 'До 15 конкурентов', included: true },
      { text: 'Расширенная аналитика', included: true },
      { text: 'AI-рекомендации', included: true },
      { text: 'Настраиваемые отчеты', included: true },
      { text: 'API-интеграция', included: true },
      { text: 'Персональный менеджер', included: false },
    ],
  },
  {
    code: 'enterprise',
    title: 'Энтерпрайз',
    monthPrice: 'По договоренности',
    yearPrice: '',
    accent: 'bg-indigo-900/80',
    features: [
      { text: 'Неограниченное число конкурентов', included: true },
      { text: 'Полный доступ к платформе', included: true },
      { text: 'Приоритетные обновления', included: true },
      { text: 'Персональный менеджер', included: true },
      { text: 'Индивидуальная настройка', included: true },
    ],
  },
];

const PLAN_AMOUNTS: Record<string, number> = { starter: 500000, business: 1500000 }; // kopecks

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ onBackToRequest }) => {
  const { user, session } = useAuth();
  const { isActive, isLifetime, daysLeft, subscription } = useSubscriptionStatus();
  const [loadingCode, setLoadingCode] = useState<string>('');
  const [error, setError] = useState('');

  const statusText = useMemo(() => {
    if (isLifetime) return 'Бессрочная активная подписка';
    if (isActive) return `Подписка активна${daysLeft != null ? `, осталось ${daysLeft} дн.` : ''}`;
    return 'Подписка не активна';
  }, [isActive, isLifetime, daysLeft]);

  const startPayment = async (code: 'starter' | 'business') => {
    if (!user) return;
    setLoadingCode(code);
    setError('');
    try {
      const amount = PLAN_AMOUNTS[code];
      let activeSession = session;
      if (!activeSession?.access_token) {
        const s = await supabase.auth.getSession();
        activeSession = s.data.session ?? null;
      }
      if (!activeSession?.access_token) {
        const refreshed = await supabase.auth.refreshSession();
        activeSession = refreshed.data.session ?? null;
      }
      if (!activeSession?.access_token) throw new Error('Сессия истекла. Выйдите и войдите снова.');

      const requestPayload = { plan_code: code, amount_kopecks: amount, period_days: 30 };
      let invokeRes = await supabase.functions.invoke('create-payment-session', {
        body: { ...requestPayload, user_id: user.id },
        headers: {
          Authorization: `Bearer ${activeSession.access_token}`,
        },
      });
      if (invokeRes.error && String(invokeRes.error.message || '').includes('401')) {
        const refreshed = await supabase.auth.refreshSession();
        const retryToken = refreshed.data.session?.access_token;
        if (!retryToken) throw new Error('Сессия истекла. Выйдите и войдите снова.');
        invokeRes = await supabase.functions.invoke('create-payment-session', {
          body: { ...requestPayload, user_id: user.id },
          headers: {
            Authorization: `Bearer ${retryToken}`,
          },
        });
      }
      if (invokeRes.error) {
        const maybeContext = (invokeRes.error as any)?.context;
        if (maybeContext && typeof maybeContext.text === 'function') {
          const details = await maybeContext.text();
          throw new Error(details || invokeRes.error.message || 'Не удалось создать оплату');
        }
        throw new Error(invokeRes.error.message || 'Не удалось создать оплату');
      }
      const parsed = (invokeRes.data ?? {}) as { checkout_url?: string };
      if (!parsed.checkout_url) throw new Error('Провайдер не вернул ссылку оплаты');
      window.location.href = parsed.checkout_url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка оплаты');
    } finally {
      setLoadingCode('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Подписка</h2>
          <p className="text-sm text-gray-500 mt-1">{statusText}</p>
        </div>
        {onBackToRequest && (
          <button
            type="button"
            onClick={onBackToRequest}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            К новому запросу
          </button>
        )}
      </div>

      {error && <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {plans.map((plan) => (
          <div key={plan.code} className={`${plan.accent} text-white rounded-2xl border border-white/10 overflow-hidden`}>
            <div className="p-6 border-b border-white/10">
              <h3 className="text-2xl font-semibold">{plan.title}</h3>
              <p className="mt-3 text-3xl font-bold">{plan.monthPrice}</p>
              {plan.yearPrice ? <p className="mt-1 text-white/70">{plan.yearPrice}</p> : null}
            </div>
            <div className="p-6 space-y-3">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  {f.included ? <Check className="w-4 h-4 text-cyan-300 mt-0.5" /> : <X className="w-4 h-4 text-white/50 mt-0.5" />}
                  <span className={`${f.included ? '' : 'text-white/60'}`}>{f.text}</span>
                </div>
              ))}
            </div>
            <div className="p-6 pt-0">
              {plan.code === 'enterprise' ? (
                <a
                  href="mailto:sales@marketscope.ai?subject=Enterprise%20MarketScope"
                  className="block text-center w-full py-2 rounded-lg bg-indigo-500/40 hover:bg-indigo-500/55 transition"
                >
                  Связаться с отделом продаж
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => startPayment(plan.code)}
                  disabled={Boolean(loadingCode)}
                  className="w-full py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-60 transition"
                >
                  {loadingCode === plan.code ? 'Переход к оплате...' : 'Выбрать тариф и оплатить'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {subscription && !isLifetime && (
        <div className="text-sm text-gray-500">
          Текущий тариф: <span className="font-medium text-gray-800">{subscription.plan_name || '—'}</span>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;

