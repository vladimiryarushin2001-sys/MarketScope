import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { priceComparison } from '../../data/mockData';
import InsightsBlock from '../common/InsightsBlock';
import { generatePricingInsights } from '../../utils/aiInsights';
import type { CompetitorData } from '../../types';

interface PricingAnalysisTabProps {
  selectedCompetitor: string;
  competitors: CompetitorData[];
  getCompetitorName: (id: string) => string;
}

const PricingAnalysisTab: React.FC<PricingAnalysisTabProps> = ({
  selectedCompetitor,
  competitors,
  getCompetitorName
}) => {
  const getFilteredPriceData = () => {
    if (selectedCompetitor === 'all') {
      return priceComparison;
    }
    
    const competitorIndex = parseInt(selectedCompetitor);
    return priceComparison.map(item => ({
      category: item.category,
      price: item[`comp${competitorIndex}` as keyof typeof item]
    }));
  };

  const filteredPriceData = getFilteredPriceData();
  const { insights, strategy } = generatePricingInsights(competitors, selectedCompetitor);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Ценовой анализ {selectedCompetitor !== 'all' ? `- ${getCompetitorName(selectedCompetitor)}` : ''}
        </h2>
      </div>

      {selectedCompetitor === 'all' ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Сравнение цен по категориям
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={priceComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="comp1" fill="#3b82f6" name="Вкусно и точка" />
              <Bar dataKey="comp2" fill="#10b981" name="Теремок" />
              <Bar dataKey="comp3" fill="#f59e0b" name="Шоколадница" />
              <Bar dataKey="comp4" fill="#8b5cf6" name="Кофемания" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Цены {getCompetitorName(selectedCompetitor)} по категориям
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={filteredPriceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="price" fill="#3b82f6" name="Цена" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Ценовая эластичность</h3>
          <div className="space-y-4">
            {[
              { product: 'Бизнес-ланч', elasticity: -0.8, optimal: 380 },
              { product: 'Кофе', elasticity: -1.2, optimal: 210 },
              { product: 'Десерты', elasticity: -0.6, optimal: 290 },
              { product: 'Основные блюда', elasticity: -0.9, optimal: 520 },
            ].map((item) => (
              <div
                key={item.product}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{item.product}</p>
                  <p className="text-sm text-gray-600">
                    Эластичность: {item.elasticity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Оптимальная цена</p>
                  <p className="font-semibold text-lg">₽{item.optimal}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Акции и скидки {selectedCompetitor !== 'all' ? getCompetitorName(selectedCompetitor) : 'конкурентов'}
          </h3>
          <div className="space-y-3">
            {[
              {
                competitor: 'Вкусно и точка',
                promo: 'Скидка 20% на второй кофе',
                frequency: 'Ежедневно',
              },
              {
                competitor: 'Теремок',
                promo: 'Бизнес-ланч -15%',
                frequency: 'Пн-Пт 12:00-16:00',
              },
              {
                competitor: 'Шоколадница',
                promo: 'Третий десерт бесплатно',
                frequency: 'По выходным',
              },
              {
                competitor: 'Кофемания',
                promo: 'Карта лояльности 10%',
                frequency: 'Постоянно',
              },
            ]
            .filter(item => selectedCompetitor === 'all' || item.competitor === getCompetitorName(selectedCompetitor))
            .map((item) => (
              <div
                key={item.competitor}
                className="border-l-4 border-blue-500 pl-4 py-2"
              >
                <p className="font-medium">{item.competitor}</p>
                <p className="text-sm text-gray-700">{item.promo}</p>
                <p className="text-xs text-gray-500">{item.frequency}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Добавляем блоки с выводами и стратегией */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsBlock
          title="Ценовые выводы"
          type="insights"
          insights={insights}
        />
        <InsightsBlock
          title="Ценовая стратегия"
          type="strategy"
          insights={strategy}
        />
      </div>
    </div>
  );
};

export default PricingAnalysisTab;