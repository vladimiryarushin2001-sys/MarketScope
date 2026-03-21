import React from 'react';
import { 
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import type { Restaurant, CompetitorData } from '../../types';
import InsightsBlock from '../common/InsightsBlock';
import { generateFinancialInsights } from '../../utils/aiInsights';

interface FinancialAnalysisTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  competitors: CompetitorData[];
  getFilteredData: () => any;
}

const FinancialAnalysisTab: React.FC<FinancialAnalysisTabProps> = ({
  selectedRestaurant,
  restaurants,
  competitors,
  getFilteredData,
}) => {
  const { restaurants: filteredRestaurants } = getFilteredData();
  const selectedId = selectedRestaurant === 'all' ? 'all' : String(selectedRestaurant);
  const { insights, strategy } = generateFinancialInsights(competitors, selectedId);

  const financialData = filteredRestaurants.map(r => ({
    metric: r.name,
    value: r.avg_check,
    benchmark: 2000 // пример бенчмарка
  }));

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Финансовый анализ {selectedRestaurant !== 'all' ? `- ${filteredRestaurants[0]?.name || ''}` : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Средний чек по ресторанам</h3>
          <ResponsiveContainer width="100%" height={300}>
            {/* Здесь можно использовать RadarChart или другой график для отображения avg_check */}
            {/* Пример: просто список */}
            <ul>
              {financialData.map((item, idx) => (
                <li key={idx} className="mb-2">
                  <span className="font-medium">{item.metric}:</span> {item.value} ₽ (Бенчмарк: {item.benchmark} ₽)
                </li>
              ))}
            </ul>
          </ResponsiveContainer>
        </div>
        <InsightsBlock insights={insights} strategy={strategy} />
      </div>
    </div>
  );
};

export default FinancialAnalysisTab;