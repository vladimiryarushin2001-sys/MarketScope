import React, { useEffect, useMemo, useState } from 'react';
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
  summary: string;
  details: string;
  featureRows: Array<{ key: string; text: string; included: boolean }>;
  accent: string;
};

const FEATURE_ORDER: Array<{ key: string; label: string }> = [
  { key: 'competitors', label: 'Кол-во конкурентов' },
  { key: 'requests', label: 'Кол-во запросов' },
  { key: 'comparison', label: 'Сравнительный анализ' },
  { key: 'report', label: 'Аналитический отчёт' },
  { key: 'insights', label: 'Рекомендации (инсайты)' },
  { key: 'export', label: 'Выгрузка результатов' },
  { key: 'ai', label: 'AI-рекомендации' },
  { key: 'api', label: 'API/интеграции' },
  { key: 'manager', label: 'Персональный менеджер' },
  { key: 'support', label: 'Поддержка / SLA' },
];

const plans: Plan[] = [
  {
    code: 'starter',
    title: 'Стартовый',
    monthPrice: '10 000 ₽/мес',
    yearPrice: 'или 100 000 ₽/год',
    accent: 'bg-blue-900/80',
    summary:
      'Для точечного анализа: до 5 аналитических запросов в месяц, отчёт и базовые инсайты. Экспорт результатов (PDF/таблицы).',
    details: [
      'Тариф «Стартовый»',
      '',
      'Стоимость:',
      '10 000 ₽ в месяц',
      '100 000 ₽ в год',
      '',
      'Описание услуги:',
      'Предоставление доступа к SaaS-платформе MarketScope для автоматического анализа на основе открытых данных (отзывы, цены, онлайн-активность).',
      '',
      'Характеристики:',
      'До 5 аналитических запросов в месяц',
      'Анализ сравнения (цены, отзывы, позиционирование)',
      'Формирование аналитического отчета',
      'Базовые рекомендации (инсайты)',
      'Доступ к веб-интерфейсу платформы',
      '',
      'Комплектация (что получает пользователь):',
      'Личный кабинет пользователя',
      'Доступ к отчетам в цифровом формате',
      'Возможность выгрузки результатов (PDF/таблицы)',
      '',
      'Условия оказания услуг:',
      'Услуга применяется в течение оплаченного периода (1 месяц / 1 год)',
      'Неиспользованные запросы не переносятся в следующий период',
      '',
      'Гарантийные условия:',
      'В случае технической невозможности предоставления услуги (сбой системы) — продление периода подписки или возврат средств за неоказанную часть услуги.',
      'Техническая поддержка в рабочее время',
    ].join('\n'),
    featureRows: [
      { key: 'competitors', text: 'До 5 конкурентов', included: true },
      { key: 'requests', text: 'До 5 аналитических запросов/мес', included: true },
      { key: 'comparison', text: 'Сравнение: цены, отзывы, позиционирование', included: true },
      { key: 'report', text: 'Формирование отчёта', included: true },
      { key: 'insights', text: 'Базовые рекомендации', included: true },
      { key: 'export', text: 'Выгрузка: PDF/таблицы', included: true },
      { key: 'ai', text: 'AI-рекомендации', included: false },
      { key: 'api', text: 'API/интеграции', included: false },
      { key: 'manager', text: 'Персональный менеджер', included: false },
      { key: 'support', text: 'Поддержка в рабочее время', included: true },
    ],
  },
  {
    code: 'business',
    title: 'Бизнес',
    monthPrice: '15 000 ₽/мес',
    yearPrice: 'или 150 000 ₽/год',
    accent: 'bg-cyan-900/80',
    summary:
      'Для регулярного мониторинга: до 10 аналитических запросов в месяц, отчёты и инсайты. Экспорт результатов (PDF/таблицы).',
    details: [
      'Тариф «Бизнес»',
      '',
      'Стоимость:',
      '15 000 ₽ в месяц',
      '150 000 ₽ в год',
      '',
      'Описание услуги:',
      'Расширенный доступ к платформе MarketScope для регулярного анализа конкурентной среды и получения более традиционных аналитических инсайтов.',
      '',
      'Характеристики:',
      'До 10 аналитических запросов в месяц',
      'Анализ сравнения (цены, отзывы, позиционирование)',
      'Формирование аналитического отчета',
      'Базовые рекомендации (инсайты)',
      'Доступ к веб-интерфейсу платформы',
      '',
      'Комплектация (что получает пользователь):',
      'Личный кабинет пользователя',
      'Доступ к отчетам в цифровом формате',
      'Возможность выгрузки результатов (PDF/таблицы)',
      '',
      'Условия оказания услуг:',
      'Услуга применяется в течение оплаченного периода (1 месяц / 1 год)',
      'Неиспользованные запросы не переносятся в следующий период',
      '',
      'Гарантийные условия:',
      'В случае технической невозможности предоставления услуги (сбой системы) — продление периода подписки или возврат средств за неоказанную часть услуги.',
      'Техническая поддержка в рабочее время',
    ].join('\n'),
    featureRows: [
      { key: 'competitors', text: 'До 15 конкурентов', included: true },
      { key: 'requests', text: 'До 10 аналитических запросов/мес', included: true },
      { key: 'comparison', text: 'Сравнение: цены, отзывы, позиционирование', included: true },
      { key: 'report', text: 'Формирование отчёта', included: true },
      { key: 'insights', text: 'Базовые рекомендации', included: true },
      { key: 'export', text: 'Выгрузка: PDF/таблицы', included: true },
      { key: 'ai', text: 'AI-рекомендации', included: true },
      { key: 'api', text: 'API/интеграции', included: true },
      { key: 'manager', text: 'Персональный менеджер', included: false },
      { key: 'support', text: 'Поддержка в рабочее время', included: true },
    ],
  },
  {
    code: 'enterprise',
    title: 'Энтерпрайз',
    monthPrice: 'По договоренности',
    yearPrice: '',
    accent: 'bg-indigo-900/80',
    summary:
      'Индивидуальное решение: неограниченные запросы, кастомизация аналитики и интеграции. Выделенная поддержка и SLA по договору.',
    details: [
      'Тариф «Энтрепрайс»',
      '',
      'Стоимость:',
      'Определяется индивидуально (по договору)',
      '',
      'Описание услуги:',
      'Индивидуальное решение для компаний с четким определением аналитических задач и потребностями в кастомизации.',
      '',
      'Характеристики:',
      'Неограниченное количество аналитических запросов',
      'Индивидуальная настройка аналитики под бизнес-задачи',
      'Расширенные исходные данные',
      'Интеграции с внешними сетями (при необходимости)',
      'Выделенная поддержка',
      '',
      'Комплектация:',
      'Персональный менеджер',
      'Индивидуальные отчеты',
      '',
      'Условия оказания услуг:',
      'Условия фиксируются в индивидуальном договоре',
      'SLA (уровень сервиса) согласовывается отдельно',
      '',
      'Гарантийные условия:',
      'Закрепляются договором',
      'Возможные соглашения об уровне обслуживания по доступности сервиса',
    ].join('\n'),
    featureRows: [
      { key: 'competitors', text: 'Неограниченное число конкурентов', included: true },
      { key: 'requests', text: 'Неограниченное число запросов', included: true },
      { key: 'comparison', text: 'Сравнительный анализ', included: true },
      { key: 'report', text: 'Индивидуальные отчёты', included: true },
      { key: 'insights', text: 'Рекомендации под бизнес-задачи', included: true },
      { key: 'export', text: 'Выгрузка результатов', included: true },
      { key: 'ai', text: 'Кастомизация аналитики', included: true },
      { key: 'api', text: 'Интеграции с внешними системами', included: true },
      { key: 'manager', text: 'Персональный менеджер', included: true },
      { key: 'support', text: 'Выделенная поддержка и SLA', included: true },
    ],
  },
];

const PLAN_AMOUNTS: Record<string, number> = { starter: 500000, business: 1500000 }; // kopecks

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ onBackToRequest }) => {
  const { user, session } = useAuth();
  const { isActive, isLifetime, daysLeft, subscription } = useSubscriptionStatus();
  const [loadingCode, setLoadingCode] = useState<string>('');
  const [error, setError] = useState('');
  const [detailsCode, setDetailsCode] = useState<Plan['code'] | null>(null);

  // Lock background scroll + allow closing details with Escape.
  useEffect(() => {
    if (!detailsCode) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetailsCode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [detailsCode]);

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
          <div
            key={plan.code}
            className={`${plan.accent} text-white rounded-2xl border border-white/10 overflow-hidden flex flex-col h-full`}
          >
            <div className="p-6 border-b border-white/10 min-h-[196px]">
              <h3 className="text-2xl font-semibold">{plan.title}</h3>
              <p className="mt-3 text-3xl font-bold">{plan.monthPrice}</p>
              {plan.yearPrice ? <p className="mt-1 text-white/70">{plan.yearPrice}</p> : null}
              <p className="mt-4 text-sm text-white/85 leading-relaxed">{plan.summary}</p>
            </div>
            <div className="p-6 space-y-3 flex-1">
              {FEATURE_ORDER.map(({ key }) => {
                const row = plan.featureRows.find((r) => r.key === key);
                const included = row?.included ?? false;
                const text = row?.text ?? '—';
                return (
                  <div key={key} className="flex items-start gap-2 min-h-[22px]">
                    {included ? <Check className="w-4 h-4 text-cyan-300 mt-0.5" /> : <X className="w-4 h-4 text-white/50 mt-0.5" />}
                    <span className={`${included ? '' : 'text-white/60'}`}>{text}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-6 pt-0 mt-auto">
              {plan.code === 'enterprise' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href="mailto:sales@marketscope.ai?subject=Enterprise%20MarketScope"
                    className="block text-center w-full py-2 rounded-lg bg-indigo-500/40 hover:bg-indigo-500/55 transition"
                  >
                    Связаться с отделом продаж
                  </a>
                  <button
                    type="button"
                    onClick={() => setDetailsCode(plan.code)}
                    className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
                  >
                    Подробнее
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => startPayment(plan.code)}
                    disabled={Boolean(loadingCode)}
                    className="w-full py-2 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 disabled:opacity-60 transition"
                  >
                    {loadingCode === plan.code ? 'Переход к оплате...' : 'Выбрать и оплатить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsCode(plan.code)}
                    className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
                  >
                    Подробнее
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {detailsCode ? (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[9000]"
            aria-hidden="true"
            onClick={() => setDetailsCode(null)}
          />
          <div className="fixed inset-0 z-[9100] flex items-center justify-center p-3 sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden max-h-[calc(100vh-24px)] sm:max-h-[calc(100vh-48px)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900">
                  {plans.find((p) => p.code === detailsCode)?.title ?? 'Тариф'}
                </h4>
                <button
                  type="button"
                  onClick={() => setDetailsCode(null)}
                  className="p-2 rounded-lg hover:bg-gray-100"
                  aria-label="Закрыть"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto min-h-0">
                <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 leading-relaxed">
                  {plans.find((p) => p.code === detailsCode)?.details ?? ''}
                </pre>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {subscription && !isLifetime && (
        <div className="text-sm text-gray-500">
          Текущий тариф: <span className="font-medium text-gray-800">{subscription.plan_name || '—'}</span>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPage;

