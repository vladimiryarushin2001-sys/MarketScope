import React from 'react';
import type { Restaurant, CompetitorData, Marketing, MarketingSocial, MarketingLoyalty } from '../../types';

interface MarketingAnalysisTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  competitors: CompetitorData[];
  marketing?: Marketing[];
  marketingSocials?: MarketingSocial[];
  marketingLoyalty?: MarketingLoyalty[];
  getRestaurantName: (id: number | 'all', list: Restaurant[]) => string;
}

const MarketingAnalysisTab: React.FC<MarketingAnalysisTabProps> = ({
  selectedRestaurant,
  restaurants,
  marketing = [],
  marketingSocials = [],
  marketingLoyalty = [],
  getRestaurantName,
}) => {
  const filteredRestaurants = selectedRestaurant === 'all' ? restaurants : restaurants.filter((r) => r.id === selectedRestaurant);
  const restaurantIds = filteredRestaurants.map((r) => r.id);
  const marketingByRestaurant = marketing.filter((m) => restaurantIds.includes(m.restaurant_id));
  const marketingIds = marketingByRestaurant.map((m) => m.id);
  const socialsRows = marketingSocials.filter((s) => marketingIds.includes(s.marketing_id));
  const loyaltyRows = marketingLoyalty.filter((l) => marketingIds.includes(l.marketing_id));
  const cleanParagraphs = (text?: string): string[] =>
    (text || '')
      .replace(/[*#`]/g, '')
      .replace(/\r/g, '\n')
      .split(/\.\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.endsWith('.') ? x : `${x}.`));

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Маркетинговый анализ {selectedRestaurant !== 'all' ? `- ${getRestaurantName(selectedRestaurant, restaurants)}` : ''}
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Маркетинг: сайты ресторанов</h3>
        <ul className="space-y-2 text-sm">
            {marketingByRestaurant.map((m) => {
            const restName = restaurants.find((r) => r.id === m.restaurant_id)?.name ?? '';
            return (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{restName}</span>
                  <a href={m.site || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{m.site || '—'}</a>
                </li>
            );
          })}
          {marketingByRestaurant.length === 0 && <li className="text-gray-500">Нет данных</li>}
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Соцсети и каналы</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ресторан</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Канал</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ссылка</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Активность</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {socialsRows.length ? socialsRows.map((s) => {
                const m = marketingByRestaurant.find((x) => x.id === s.marketing_id);
                const restName = m ? restaurants.find((r) => r.id === m.restaurant_id)?.name ?? '' : '';
                return (
                  <tr key={s.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{restName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.network}</td>
                    <td className="px-6 py-4 text-sm"><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all inline-block">{s.url}</a></td>
                    <td className="px-6 py-4 text-sm text-gray-700">{s.activity || '—'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-sm text-gray-500">Нет данных по соцсетям</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {loyaltyRows.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Программы лояльности</h3>
          <ul className="space-y-2 text-sm">
            {loyaltyRows.map((l) => (
              <li key={l.id} className="p-3 bg-gray-50 rounded">
                {(() => {
                  const restName = restaurants.find((r) => {
                    const m = marketing.find((mm) => mm.id === l.marketing_id);
                    return m && r.id === m.restaurant_id;
                  })?.name ?? '';
                  if (l.has_loyalty) {
                    return (
                      <>
                        <span className="font-medium">{restName}: {l.loyalty_name || 'Есть программа'}</span>
                        {l.loyalty_format?.length ? <span className="text-gray-600"> · {l.loyalty_format.join(', ')}</span> : null}
                        {l.loyalty_cost_per_point && <p className="text-xs text-gray-500 mt-1">Стоимость балла: {l.loyalty_cost_per_point}</p>}
                        {l.loyalty_how_to_earn && <p className="text-gray-500 mt-1 text-sm">{l.loyalty_how_to_earn}</p>}
                      </>
                    );
                  }
                  return <span className="text-gray-500">{restName || 'Ресторан'}: нет программы лояльности</span>;
                })()}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Выводы по ресторанам</h3>
        <div className="space-y-3">
          {marketingByRestaurant.map((m) => {
            const restName = restaurants.find((r) => r.id === m.restaurant_id)?.name ?? '';
            const parts = cleanParagraphs(m.conclusion);
            if (!parts.length) return null;
            return (
              <div key={m.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-sm font-semibold text-gray-900 mb-1">{restName}</p>
                {parts.map((p, i) => (
                  <p key={i} className="text-sm text-gray-700">{p}</p>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 bg-blue-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Вывод на основе анализа маркетинга</h3>
        <div className="space-y-3">
          {cleanParagraphs(marketingByRestaurant.find((m) => m.reference_conclusion)?.reference_conclusion).map((p, i) => (
            <p key={i} className="text-sm text-gray-800 leading-relaxed">{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MarketingAnalysisTab;
