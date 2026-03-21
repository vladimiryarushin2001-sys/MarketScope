import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Star } from 'lucide-react';
import type { CompetitorData, Restaurant, Review } from '../../types';

interface ReviewAnalysisTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  competitors: CompetitorData[];
  reviews?: Review[];
  getRestaurantName: (id: number | 'all', list: Restaurant[]) => string;
}

const ReviewAnalysisTab: React.FC<ReviewAnalysisTabProps> = ({
  selectedRestaurant,
  restaurants,
  competitors,
  reviews = [],
  getRestaurantName,
}) => {
  const selectedId = selectedRestaurant === 'all' ? 'all' : String(selectedRestaurant);
  const filteredRestaurants = selectedRestaurant === 'all' ? restaurants : restaurants.filter(r => r.id === selectedRestaurant);
  const restaurantIds = filteredRestaurants.map((r) => r.id);
  const filteredReviews = reviews.filter((r) => restaurantIds.includes(r.restaurant_id));
  void competitors;
  void selectedId;

  const cleanParagraphs = (text?: string): string[] => {
    if (!text) return [];
    const cleaned = text.replace(/[*#`]/g, '').replace(/\r/g, '\n');
    return cleaned
      .split(/\n+/)
      .flatMap((line) => line.split(/\. +|! +|\? +/))
      .map((x) => x.trim())
      .filter(Boolean);
  };

  const chartRows = filteredReviews.map((r) => {
    const restaurantName = restaurants.find((x) => x.id === r.restaurant_id)?.name ?? '';
    const positiveCount = r.positive_reviews?.length ?? r.positive?.split('\n').filter(Boolean).length ?? 0;
    const negativeCount = r.negative_reviews?.length ?? r.negative?.split('\n').filter(Boolean).length ?? 0;
    const total = Math.max(positiveCount + negativeCount, 1);
    return {
      restaurantName,
      rating: r.rating ?? 0,
      countRating: r.count_rating ?? r.reviews_count ?? 0,
      positivePct: Math.round((positiveCount / total) * 100),
      negativePct: Math.round((negativeCount / total) * 100),
      positiveCount,
      negativeCount,
    };
  });

  const sampleReviews = filteredReviews.length > 0
    ? filteredReviews.map((r) => ({
        restaurantName: restaurants.find((x) => x.id === r.restaurant_id)?.name ?? '',
        rating: competitors.find((c) => c.id === String(r.restaurant_id))?.rating ?? 4,
        general: r.general_info,
        positive: (r.positive_reviews && r.positive_reviews.length ? r.positive_reviews : (r.positive ? r.positive.split('\n').filter(Boolean) : [])).join('\n'),
        negative: (r.negative_reviews && r.negative_reviews.length ? r.negative_reviews : (r.negative ? r.negative.split('\n').filter(Boolean) : [])).join('\n'),
        date: `${r.reviews_count} отзывов`,
        sentiment: 'positive' as const,
      }))
    : [
    { author: 'Мария К.', rating: selectedRestaurant === 'all' ? 5 : competitors.find(c => c.id === selectedId)?.rating ?? 5, text: selectedRestaurant === 'all' ? 'Отличное обслуживание и вкусная еда!' : `Отличное обслуживание в ${getRestaurantName(selectedRestaurant, restaurants)}!`, date: '2 часа назад', sentiment: 'positive' as const },
    { author: 'Иван П.', rating: 3, text: 'Долго ждали заказ, но еда была хорошая', date: '5 часов назад', sentiment: 'neutral' as const },
    { author: 'Елена С.', rating: 4, text: 'Приятная атмосфера, рекомендую', date: '1 день назад', sentiment: 'positive' as const },
    { author: 'Дмитрий Л.', rating: 2, text: 'Цены завышены для такого качества', date: '2 дня назад', sentiment: 'negative' as const },
  ];

  const renderReviewCard = (review: any, index: number) => (
    <div key={index} className="border border-gray-100 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-gray-900">{review.restaurantName}</span>
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} />
            ))}
          </div>
        </div>
        <span className="text-sm text-gray-500">{review.date}</span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-600 uppercase">Общий вывод</p>
          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{review.general || 'Нет данных'}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-emerald-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-emerald-700 uppercase">Положительные отзывы</p>
            <p className="mt-1 text-xs text-emerald-800">Количество: {review.positive ? review.positive.split('\n').filter(Boolean).length : 0}</p>
            <div className="mt-1 space-y-2">
              {review.positive
                ? review.positive.split('\n').filter(Boolean).slice(0, 8).map((item: string, i: number) => (
                    <p key={i} className="text-sm text-gray-800 border-b border-emerald-100 pb-1">{item}</p>
                  ))
                : <p className="text-sm text-gray-800">Нет данных</p>}
            </div>
          </div>
          <div className="bg-rose-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-rose-700 uppercase">Отрицательные отзывы</p>
            <p className="mt-1 text-xs text-rose-800">Количество: {review.negative ? review.negative.split('\n').filter(Boolean).length : 0}</p>
            <div className="mt-1 space-y-2">
              {review.negative
                ? review.negative.split('\n').filter(Boolean).slice(0, 8).map((item: string, i: number) => (
                    <p key={i} className="text-sm text-gray-800 border-b border-rose-100 pb-1">{item}</p>
                  ))
                : <p className="text-sm text-gray-800">Нет данных</p>}
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 uppercase">Выводы</p>
          <div className="mt-1 space-y-1">
            {cleanParagraphs(
              filteredReviews.find((r) => (restaurants.find((x) => x.id === r.restaurant_id)?.name ?? '') === review.restaurantName)?.conclusion || ''
            ).map((p, i) => (
              <p key={i} className="text-sm text-gray-800">{p}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Анализ отзывов {selectedRestaurant !== 'all' ? `- ${filteredRestaurants[0]?.name ?? ''}` : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Звездность ресторана</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="restaurantName" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Bar dataKey="rating" fill="#f59e0b" name="Рейтинг" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Объем отзывов</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="restaurantName" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="countRating" fill="#3b82f6" name="Всего отзывов" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Доля положительных и отрицательных отзывов (%)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="restaurantName" />
            <YAxis unit="%" />
            <Tooltip />
            <Legend />
            <Bar dataKey="positivePct" stackId="sentiment" fill="#22c55e" name="Положительные, %" />
            <Bar dataKey="negativePct" stackId="sentiment" fill="#ef4444" name="Отрицательные, %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Последние отзывы</h3>
        <div className="space-y-4">
          {sampleReviews.slice(0, 2).map(renderReviewCard)}
          {sampleReviews.length > 2 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-blue-600">Показать все отзывы</summary>
              <div className="space-y-4 mt-2">
                {sampleReviews.slice(2).map(renderReviewCard)}
              </div>
            </details>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 bg-blue-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Вывод на основе анализа отзывов</h3>
        <div className="space-y-3">
          {cleanParagraphs(filteredReviews.find((r) => r.reference_conclusion)?.reference_conclusion).map((p, i) => (
            <p key={i} className="text-sm text-gray-800 leading-relaxed">{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReviewAnalysisTab;
