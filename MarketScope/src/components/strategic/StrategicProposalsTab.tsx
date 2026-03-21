import React from 'react';
import type { Restaurant, StrategicReport } from '../../types';

interface StrategicProposalsTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  strategicReport: StrategicReport[];
  getRestaurantName: (id: number | 'all', list: Restaurant[]) => string;
}

function cleanText(text?: string): string {
  return (text || '').replace(/[*#`]/g, '').trim();
}

function SectionCard({ title, value }: { title: string; value?: string }) {
  if (!value) return null;
  const paragraphs = cleanText(value)
    .split('**')
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
      <div className="space-y-2">
        {(paragraphs.length ? paragraphs : [cleanText(value)]).map((p, idx) => (
          <p key={idx} className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  );
}

const StrategicProposalsTab: React.FC<StrategicProposalsTabProps> = ({
  selectedRestaurant,
  restaurants,
  strategicReport,
  getRestaurantName,
}) => {
  const restaurantIds = selectedRestaurant === 'all'
    ? restaurants.map((r) => r.id)
    : [selectedRestaurant];
  const reports = strategicReport.filter((r) => restaurantIds.includes(r.restaurant_id));

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Стратегические предложения</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Нет стратегических отчётов для выбранных ресторанов.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Стратегические предложения {selectedRestaurant !== 'all' ? `- ${getRestaurantName(selectedRestaurant, restaurants)}` : ''}
        </h2>
      </div>

      {reports.map((r) => {
        const restName = restaurants.find((x) => x.id === r.restaurant_id)?.name ?? '';
        return (
          <div key={r.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{restName}</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <SectionCard title="Позиционирование" value={r.positioning} />
              <SectionCard title="Меню (анализ)" value={r.menu} />
              <SectionCard title="Отзывы (анализ)" value={r.reviews} />
              <SectionCard title="Маркетинг (анализ)" value={r.marketing} />
              <SectionCard title="Техническая часть" value={r.technical_part} />
            </div>
            <div className="mt-4">
              <SectionCard title="Бизнес-рекомендации" value={r.business_recommendations} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StrategicProposalsTab;
