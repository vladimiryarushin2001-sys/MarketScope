import React, { useEffect, useMemo, useState } from 'react';
import { User, CreditCard, Calendar, Mail, Phone, Building2, Briefcase } from 'lucide-react';
import type { UserProfile, Subscription } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

interface PersonalCabinetTabProps {
  onOpenSubscription?: () => void;
}

const PersonalCabinetTab: React.FC<PersonalCabinetTabProps> = ({ onOpenSubscription }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setProfile(null);
        setSubscription(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError('');
        const [{ data: prof, error: eProf }, { data: sub, error: eSub }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('subscriptions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (eProf) throw eProf;
        if (eSub) throw eSub;
        if (cancelled) return;
        const p = (prof as any) as UserProfile | null;
        setProfile(p);
        setEditFullName(p?.full_name ?? '');
        setEditPhone((p as any)?.phone ?? '');
        setEditCompany((p as any)?.company ?? '');
        setEditPosition((p as any)?.position ?? '');
        setSubscription((sub as any) as Subscription | null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить данные профиля');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasAnyPersonalData = useMemo(() => {
    const p: any = profile ?? {};
    return Boolean((p.full_name || '').trim() || (p.phone || '').trim() || (p.company || '').trim() || (p.position || '').trim());
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        id: user.id,
        email: user.email ?? '',
        full_name: editFullName.trim(),
        phone: editPhone.trim(),
        company: editCompany.trim(),
        position: editPosition.trim(),
      };
      const { data, error: eUp } = await supabase.from('profiles').upsert(payload).select('*').single();
      if (eUp) throw eUp;
      setProfile((data as any) as UserProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  const daysLeft = subscription?.days_left ?? (() => {
    if (!subscription?.expires_at) return null;
    const end = new Date(subscription.expires_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const isLifetime = Boolean(subscription?.is_lifetime) || user?.id === 'cf933749-6d7a-4b12-8df2-6892912a0910';
  const isActive = isLifetime || (Boolean(subscription?.is_active) && (daysLeft === null || daysLeft > 0));

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Личный кабинет</h2>
        <p className="text-sm text-gray-500 mt-1">Ваши данные и подписка на MarketScope</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Личные данные */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Личные данные</h3>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Загрузка...</div>
          ) : !user ? (
            <div className="text-sm text-gray-500">Нужно войти в аккаунт.</div>
          ) : (
            <>
              {error && <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 text-sm mb-4">{error}</div>}
              {!hasAnyPersonalData && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-sm mb-4">
                  Похоже, личные данные ещё не заполнены. Заполните поля ниже — мы сохраним их в базе.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Имя</label>
                  <input
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Телефон</label>
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+7..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Компания</label>
                  <input
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Компания"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Должность</label>
                  <input
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Должность"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>

              <dl className="space-y-4 mt-6">
            <div className="flex items-start gap-3">
              <span className="text-gray-400 mt-0.5">
                <User className="w-4 h-4" />
              </span>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Имя</dt>
                <dd className="text-gray-900 font-medium">{profile?.full_name || '—'}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-gray-400 mt-0.5">
                <Mail className="w-4 h-4" />
              </span>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</dt>
                <dd className="text-gray-900">{profile?.email || user.email || '—'}</dd>
              </div>
            </div>
            {(profile as any)?.phone && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400 mt-0.5">
                  <Phone className="w-4 h-4" />
                </span>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Телефон</dt>
                  <dd className="text-gray-900">{(profile as any).phone}</dd>
                </div>
              </div>
            )}
            {(profile as any)?.company && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </span>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Компания</dt>
                  <dd className="text-gray-900">{(profile as any).company}</dd>
                </div>
              </div>
            )}
            {(profile as any)?.position && (
              <div className="flex items-start gap-3">
                <span className="text-gray-400 mt-0.5">
                  <Briefcase className="w-4 h-4" />
                </span>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Должность</dt>
                  <dd className="text-gray-900">{(profile as any).position}</dd>
                </div>
              </div>
            )}
          </dl>
            </>
          )}
        </div>

        {/* Подписка */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Подписка</h3>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500">Загрузка...</div>
          ) : !user ? (
            <div className="text-sm text-gray-500">Нужно войти в аккаунт.</div>
          ) : !subscription ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
                Подписки нет. Оплатите подписку, чтобы пользоваться сервисом.
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                onClick={() => onOpenSubscription?.()}
              >
                Оплатить подписку
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Тариф</span>
                <span className="font-medium text-gray-900">{subscription.plan_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Статус</span>
                <span
                  className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                  `}
                >
                  {isActive ? 'Активна' : 'Неактивна'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Действует до</p>
                  <p className="font-medium text-gray-900">{isLifetime ? 'Бессрочно' : (subscription.expires_at ? formatDate(subscription.expires_at) : '—')}</p>
                </div>
              </div>
              {subscription.started_at && (
                <div className="text-sm text-gray-500">
                  Начало подписки: {formatDate(subscription.started_at)}
                </div>
              )}
              {daysLeft !== null && (
                <div
                  className={`
                    rounded-lg p-4 text-sm
                    ${isActive ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}
                  `}
                >
                  {isLifetime ? (
                    <>Подписка активна бессрочно.</>
                  ) : isActive ? (
                    daysLeft === 0 ? (
                      <>Подписка истекает сегодня. Продлите её для продолжения работы.</>
                    ) : daysLeft === 1 ? (
                      <>Остался 1 день до окончания подписки.</>
                    ) : (
                      <>До окончания подписки осталось {daysLeft} дн.</>
                    )
                  ) : (
                    <>Подписка истекла. Продлите подписку, чтобы снова пользоваться сервисом.</>
                  )}
                </div>
              )}
              {!isActive && onOpenSubscription && (
                <button
                  type="button"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                  onClick={() => onOpenSubscription()}
                >
                  Выбрать тариф и оплатить
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalCabinetTab;
