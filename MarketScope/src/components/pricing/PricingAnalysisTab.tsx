import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { priceComparison } from '../../data/mockData';
import InsightsBlock from '../common/InsightsBlock';
import { generatePricingInsights } from '../../utils/aiInsights';
import type { Restaurant, CompetitorData } from '../../types';

interface PricingAnalysisTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  competitors: CompetitorData[];
  getRestaurantName: (id: number | 'all', list: Restaurant[]) => string;
}

const PricingAnalysisTab: React.FC<PricingAnalysisTabProps> = ({
  selectedRestaurant,
  restaurants,
  competitors,
  getRestaurantName,
}) => {
  const selectedId = selectedRestaurant === 'all' ? 'all' : String(selectedRestaurant);
  const filteredRestaurants = selectedRestaurant === 'all' ? restaurants : restaurants.filter(r => r.id === selectedRestaurant);
  const priceData = filteredRestaurants.map(r => ({ name: r.name, avg_check: r.avg_check, cuisine: r.cuisine }));

  const getFilteredPriceData = () => {
    if (selectedId === 'all') return priceComparison;
    const idx = parseInt(selectedId, 10);
    const key = `comp${idx}` as keyof (typeof priceComparison)[0];
    return priceComparison.map(item => ({ category: item.category, price: (item as Record<string, number>)[key] }));
  };
  const filteredPriceData = getFilteredPriceData();
  const { insights, strategy } = generatePricingInsights(competitors, selectedId);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Ценовой анализ {selectedRestaurant !== 'all' ? `- ${filteredRestaurants[0]?.name ?? ''}` : ''}
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Средний чек по ресторанам</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="avg_check" fill="#3b82f6" name="Средний чек" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsBlock insights={insights} strategy={strategy} />
      </div>
    </div>
  );
};

export default PricingAnalysisTab;
