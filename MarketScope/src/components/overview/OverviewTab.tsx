import React from 'react';
import type { Restaurant, CompetitorData } from '../../types';

interface OverviewTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  competitorData: CompetitorData[];
  timeRange: string;
  getFilteredData: () => any;
  getMetricsForTimeRange: () => any;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  selectedRestaurant,
  restaurants,
  timeRange,
  getFilteredData,
  getMetricsForTimeRange,
}) => {
  const { restaurants: filteredRestaurants } = getFilteredData();
  void restaurants;
  void timeRange;
  void getMetricsForTimeRange;

  const restaurantFieldRows = filteredRestaurants.map((r: Restaurant) => {
    const rows: Array<{ label: string; value: React.ReactNode }> = [
      { label: 'Название', value: r.name || '—' },
      { label: 'Адрес', value: r.address || '—' },
      { label: 'Тип заведения', value: r.type || '—' },
      { label: 'Кухня', value: r.cuisine || '—' },
      { label: 'Средний чек', value: `${r.avg_check ?? 0} ₽` },
      { label: 'Описание', value: r.description || '—' },
      { label: 'Ссылка', value: r.link ? <a className="text-blue-600 hover:underline" href={r.link} target="_blank" rel="noopener noreferrer">{r.link}</a> : '—' },
      { label: 'Степень схожести ресторанов', value: r.cosine_score ?? '—' },
      { label: 'Сайт', value: r.site ? <a className="text-blue-600 hover:underline" href={r.site} target="_blank" rel="noopener noreferrer">{r.site}</a> : '—' },
      { label: 'Доставка', value: r.delivery ? 'да' : 'нет' },
      { label: 'Время работы', value: r.working_hours || '—' },
      { label: 'Ссылка на Яндекс.Карты', value: r.yandex_maps_link ? <a className="text-blue-600 hover:underline" href={r.yandex_maps_link} target="_blank" rel="noopener noreferrer">{r.yandex_maps_link}</a> : '—' },
      { label: 'Ссылка на меню', value: r.menu_url ? <a className="text-blue-600 hover:underline" href={r.menu_url} target="_blank" rel="noopener noreferrer">{r.menu_url}</a> : '—' },
    ];
    return { restaurantId: r.id, restaurantName: r.name, rows };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Список ресторанов</h3>
          <div className="space-y-4">
            {filteredRestaurants.map((r: Restaurant, index: number) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-gray-400">
                    {selectedRestaurant === 'all' ? `#${index + 1}` : '⭐'}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{r.name}</p>
                    <p className="text-sm text-gray-500">{r.cuisine}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">{r.type}</p>
                  <p className="font-semibold text-lg">{r.avg_check} ₽</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Данные ресторанов (restaurants)</h3>
        <div className="space-y-6">
          {restaurantFieldRows.map((block) => (
            <div key={block.restaurantId} className="border border-gray-100 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">{block.restaurantName}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {block.rows.map((row) => (
                  <div key={row.label} className="text-sm">
                    <div className="text-xs text-gray-500">{row.label}</div>
                    <div className="text-gray-800 break-words">{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {restaurantFieldRows.length === 0 && <div className="text-gray-500">Нет данных</div>}
        </div>
      </div>

    </div>
  );
};

export default OverviewTab;