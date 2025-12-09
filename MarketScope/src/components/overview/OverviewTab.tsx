import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Star, BarChart3, MessageSquare, Globe } from 'lucide-react';
import MetricCard from '../common/MetricCard';
import InsightsBlock from '../common/InsightsBlock';
import type { CompetitorData } from '../../types';
import { generateOverviewInsights } from '../../utils/aiInsights';

interface OverviewTabProps {
  selectedCompetitor: string;
  competitors: CompetitorData[];
  timeRange: string;
  getFilteredData: () => any;
  getMetricsForTimeRange: () => any;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  selectedCompetitor,
  competitors,
  timeRange,
  getFilteredData,
  getMetricsForTimeRange
}) => {
  const { competitors: filteredCompetitors, performanceData: filteredPerformanceData } = getFilteredData();
  const metrics = getMetricsForTimeRange();
  const { insights, strategy } = generateOverviewInsights(competitors, selectedCompetitor, timeRange);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Средний рейтинг"
          value={metrics.rating}
          change={5}
          icon={Star}
          color="text-yellow-500"
        />
        <MetricCard
          title="Доля рынка"
          value={metrics.marketShare}
          change={-2}
          icon={BarChart3}
          color="text-blue-500"
        />
        <MetricCard
          title="Sentiment Score"
          value={metrics.sentimentScore}
          change={8}
          icon={MessageSquare}
          color="text-green-500"
        />
        <MetricCard
          title="SEO Score"
          value={metrics.seoScore}
          change={12}
          icon={Globe}
          color="text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Динамика производительности</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filteredPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedCompetitor === 'all' || selectedCompetitor === '1' ? (
                <Line type="monotone" dataKey="competitor1" stroke="#3b82f6" name="Вкусно и точка" strokeWidth={2} />
              ) : null}
              {selectedCompetitor === 'all' || selectedCompetitor === '2' ? (
                <Line type="monotone" dataKey="competitor2" stroke="#10b981" name="Теремок" strokeWidth={2} />
              ) : null}
              {selectedCompetitor === 'all' || selectedCompetitor === '3' ? (
                <Line type="monotone" dataKey="competitor3" stroke="#f59e0b" name="Шоколадница" strokeWidth={2} />
              ) : null}
              {selectedCompetitor === 'all' || selectedCompetitor === '4' ? (
                <Line type="monotone" dataKey="competitor4" stroke="#8b5cf6" name="Кофемания" strokeWidth={2} />
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            {selectedCompetitor === 'all' ? 'Рейтинг конкурентов' : 'Детали конкурента'}
          </h3>
          <div className="space-y-4">
            {filteredCompetitors.map((comp: CompetitorData, index: number) => (
              <div key={comp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-lg font-bold text-gray-400">
                    {selectedCompetitor === 'all' ? `#${index + 1}` : '⭐'}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{comp.name}</p>
                    <p className="text-sm text-gray-500">{comp.website}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-500 mr-1" />
                    <span className="font-medium">{comp.rating}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {comp.marketShare}% рынка
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Добавляем блоки с выводами и стратегией */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsBlock
          title="Ключевые выводы"
          type="insights"
          insights={insights}
        />
        <InsightsBlock
          title="Рекомендуемая стратегия"
          type="strategy"
          insights={strategy}
        />
      </div>
    </div>
  );
};

export default OverviewTab;