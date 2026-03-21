import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import type { Restaurant, CompetitorData, TechnicalAnalysis } from '../../types';

interface TechnicalAnalysisTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  competitors: CompetitorData[];
  technicalAnalysis?: TechnicalAnalysis[];
}

const TechnicalAnalysisTab: React.FC<TechnicalAnalysisTabProps> = ({
  selectedRestaurant,
  restaurants,
  competitors,
  technicalAnalysis = [],
}) => {
  void competitors;
  const filteredRestaurants = selectedRestaurant === 'all' ? restaurants : restaurants.filter((r) => r.id === selectedRestaurant);
  const restaurantIds = filteredRestaurants.map((r) => r.id);
  const filteredTech = technicalAnalysis.filter((t) => restaurantIds.includes(t.restaurant_id));
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  const seoMetrics = filteredTech.map((t) => ({
    metric: restaurants.find((r) => r.id === t.restaurant_id)?.name ?? '',
    current: Math.max(0, Math.round(100 - num(t.load_time_sec) * 10 - ((t.error ? 1 : 0) * 15))),
    optimal: 100,
    unit: 'баллов',
  })).filter((m) => m.metric);

  const loadTimeData = filteredTech.map((t) => ({
    name: restaurants.find((r) => r.id === t.restaurant_id)?.name ?? '',
    loadTime: num(t.load_time_sec),
    fill: num(t.load_time_sec) < 2 ? '#10b981' : num(t.load_time_sec) < 3 ? '#f59e0b' : '#ef4444',
  })).filter((m) => m.name);

  const auditItems =
    filteredTech.length > 0
      ? filteredTech.flatMap((t) => [
          { label: 'SSL сертификат', status: (t.https ? 'active' : 'danger') as const },
          { label: 'Mobile-friendly', status: (t.has_viewport ? 'active' : 'warning') as const },
          { label: 'Скорость загрузки', status: (t.load_time_sec > 2 ? 'warning' : 'active') as const },
          { label: 'Ошибки', status: (t.error ? 'danger' : 'active') as const },
        ]).slice(0, 6)
      : [
          { label: 'SSL сертификат', status: 'active' as const },
          { label: 'Mobile-friendly', status: 'active' as const },
          { label: 'Скорость загрузки', status: 'active' as const },
          { label: 'Структура URL', status: 'active' as const },
          { label: 'XML Sitemap', status: 'active' as const },
          { label: 'Ошибки', status: 'danger' as const },
        ];

  const cleanParagraphs = (text?: string): string[] =>
    (text || '')
      .replace(/[*#`]/g, '')
      .replace(/\r/g, '\n')
      .split(/\.\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.endsWith('.') ? x : `${x}.`));

  const techCompareData = filteredTech.map((t) => ({
    name: restaurants.find((r) => r.id === t.restaurant_id)?.name ?? '',
    load: num(t.load_time_sec),
    mobile: num(t.mobile_load_time_sec),
    size: num(t.page_size_kb),
  }));

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Технический анализ {selectedRestaurant !== 'all' ? `- ${filteredRestaurants[0]?.name ?? ''}` : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">SEO метрики</h3>
          {seoMetrics.length === 0 ? (
            <p className="text-sm text-gray-500">Нет данных для отображения.</p>
          ) : (
          <div className="space-y-4">
            {seoMetrics.map((metric) => (
              <div key={metric.metric} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{metric.metric}</span>
                  <span className="font-medium">{metric.current} {metric.unit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, (metric.current / metric.optimal) * 100))}%` }} />
                </div>
                <div className="text-xs text-gray-500">Оптимально: {metric.optimal} {metric.unit}</div>
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Скорость загрузки сайтов</h3>
          {loadTimeData.length === 0 ? (
            <p className="text-sm text-gray-500">Нет данных для отображения.</p>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={loadTimeData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip formatter={(value: number) => [`${value} сек`, 'Скорость загрузки']} labelFormatter={(label) => `Сайт: ${label}`} />
              <Bar dataKey="loadTime" name="Скорость загрузки" radius={[4, 4, 0, 0]}>
                {loadTimeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Технический аудит</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {auditItems.map((item, idx) => (
            <div key={`${item.label}-${idx}`} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">{item.label}</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${item.status === 'active' ? 'bg-green-100 text-green-600' : item.status === 'warning' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                {item.status === 'active' ? 'OK' : item.status === 'warning' ? 'Внимание' : 'Ошибка'}
              </span>
            </div>
          ))}
        </div>
        {filteredTech.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Детали по сайтам</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={techCompareData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="load" fill="#3b82f6" name="Desktop, c" />
                    <Bar dataKey="mobile" fill="#f59e0b" name="Mobile, c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Ресторан</th>
                      <th className="px-3 py-2 text-left">Код</th>
                      <th className="px-3 py-2 text-left">Размер, КБ</th>
                      <th className="px-3 py-2 text-left">HTTPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTech.map((t) => {
                      const restName = restaurants.find((r) => r.id === t.restaurant_id)?.name ?? '';
                      return (
                        <tr key={t.id} className="border-t">
                          <td className="px-3 py-2">{restName}</td>
                          <td className="px-3 py-2">{t.status_code ?? '—'}</td>
                          <td className="px-3 py-2">{t.page_size_kb ?? '—'}</td>
                          <td className="px-3 py-2">{t.https ? 'да' : 'нет'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Выводы по ресторанам</h3>
        <div className="space-y-3">
          {filteredTech.map((t) => {
            const restName = restaurants.find((r) => r.id === t.restaurant_id)?.name ?? '';
            const paragraphs = cleanParagraphs(t.conclusion);
            if (!paragraphs.length) return null;
            return (
              <div key={t.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">{restName}</p>
                {paragraphs.map((p, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">{p}</p>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 bg-blue-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Вывод на основе технического анализа сайтов</h3>
        <div className="space-y-3">
          {cleanParagraphs(filteredTech.find((t) => t.reference_conclusion)?.reference_conclusion).map((p, i) => (
            <p key={i} className="text-sm text-gray-800 leading-relaxed">{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TechnicalAnalysisTab;
