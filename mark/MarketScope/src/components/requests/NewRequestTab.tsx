import React, { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { invokeEdgeFunction } from '../../lib/edgeFunctions';
import type { ClientRequest } from '../../types';

type RequestMode = 'market_overview' | 'competitive_analysis';

interface NewRequestTabProps {
  onCreated?: (request: ClientRequest) => void;
  onOpenSubscription?: () => void;
}

const NewRequestTab: React.FC<NewRequestTabProps> = ({ onCreated, onOpenSubscription }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<RequestMode>('market_overview');
  const [queryText, setQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Market overview fields
  const [placeType, setPlaceType] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [avgCheckMin, setAvgCheckMin] = useState<number | ''>('');
  const [avgCheckMax, setAvgCheckMax] = useState<number | ''>('');

  // Competitive analysis fields
  const [myName, setMyName] = useState('');
  const [myAddress, setMyAddress] = useState('');
  const [mySite, setMySite] = useState('');
  const [myMenuUrl, setMyMenuUrl] = useState('');

  const params = useMemo(() => {
    if (mode === 'market_overview') {
      return {
        type: placeType || null,
        cuisine: cuisine || null,
        avg_check_min: avgCheckMin === '' ? null : avgCheckMin,
        avg_check_max: avgCheckMax === '' ? null : avgCheckMax,
      };
    }
    return {
      my_restaurant: {
        name: myName || null,
        address: myAddress || null,
        site: mySite || null,
        menu_url: myMenuUrl || null,
      },
    };
  }, [mode, placeType, cuisine, avgCheckMin, avgCheckMax, myName, myAddress, mySite, myMenuUrl]);

  const canSubmit = useMemo(() => {
    if (!user) return false;
    if (!queryText.trim()) return false;
    if (mode === 'market_overview') return true;
    return Boolean(myName.trim() || myAddress.trim() || mySite.trim() || myMenuUrl.trim());
  }, [user, queryText, mode, myName, myAddress, mySite, myMenuUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Нужно войти в аккаунт');
      return;
    }
    if (!canSubmit) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        user_id: user.id,
        request_type: mode,
        query_text: queryText.trim(),
        params,
      };
      const { data, error: eIns } = await supabase.from('client_requests').insert(payload).select('*').single();
      if (eIns) throw eIns;
      // Start async ms-v2 pipeline right after request creation
      const startData = await invokeEdgeFunction<{ ok?: boolean; runId?: number }>('ms-v2-start', {
        request_id: (data as ClientRequest).id,
      });

      setSuccess(
        startData?.runId
          ? `Запрос создан. Запущен анализ (run #${startData.runId}). Результаты появятся на вкладках после завершения.`
          : 'Запрос создан. Анализ запущен. Результаты появятся на вкладках после завершения.'
      );
      if (data) onCreated?.(data as ClientRequest);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать запрос');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Новый запрос</h2>
        {onOpenSubscription && (
          <button
            type="button"
            onClick={onOpenSubscription}
            className="mt-3 px-3 py-2 border border-blue-300 text-blue-700 rounded-lg text-sm hover:bg-blue-50"
          >
            Перейти к тарифам и оплате
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-800 text-sm">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 text-sm">{success}</div>}

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <span className="text-sm text-gray-600">Тип отчёта</span>
            <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                type="button"
                className={`px-4 py-2 text-sm ${mode === 'market_overview' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setMode('market_overview')}
              >
                Обзор рынка
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm ${mode === 'competitive_analysis' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                onClick={() => setMode('competitive_analysis')}
              >
                Конкурентный анализ
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Текст запроса</label>
            <input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={mode === 'market_overview' ? 'Например: Русские рестораны 2000–5000 ₽' : 'Например: Сравнить мой ресторан с конкурентами'}
            />
          </div>

          {mode === 'market_overview' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Тип заведения</label>
                <input
                  value={placeType}
                  onChange={(e) => setPlaceType(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: ресторан"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Кухня</label>
                <input
                  value={cuisine}
                  onChange={(e) => setCuisine(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: русская"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Средний чек от (₽)</label>
                <input
                  type="number"
                  value={avgCheckMin}
                  onChange={(e) => setAvgCheckMin(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Средний чек до (₽)</label>
                <input
                  type="number"
                  value={avgCheckMax}
                  onChange={(e) => setAvgCheckMax(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="5000"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Название заведения</label>
                  <input
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Название"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Адрес</label>
                  <input
                    value={myAddress}
                    onChange={(e) => setMyAddress(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Адрес"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Сайт</label>
                  <input
                    value={mySite}
                    onChange={(e) => setMySite(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Меню (ссылка)</label>
                  <input
                    value={myMenuUrl}
                    onChange={(e) => setMyMenuUrl(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Создание...' : 'Создать запрос'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewRequestTab;

