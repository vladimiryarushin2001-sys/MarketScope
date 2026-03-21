import React from 'react';
import type { CompetitorData, MarketingChannel, SEOMetrics } from '../../types';
import { marketingChannels, competitors } from '../../data/mockData';
import InsightsBlock from '../common/InsightsBlock';
import { generateMarketingInsights } from '../../utils/aiInsights';

interface MarketingAnalysisTabProps {
  selectedCompetitor: string;
  competitors: CompetitorData[];
  seoMetrics: SEOMetrics[];
  timeRange: string;
  getCompetitorName: (id: string) => string;
  getFilteredData: () => CompetitorData[];
  getMetricsForTimeRange: () => SEOMetrics[];
}

const MarketingAnalysisTab: React.FC<MarketingAnalysisTabProps> = ({
  selectedCompetitor,
  getCompetitorName,
  competitors // добавляем competitors в пропсы
}) => {
  const getFilteredMarketingData = (): MarketingChannel[] => {
    if (selectedCompetitor === 'all') {
      return marketingChannels;
    }
    
    const competitorMarketingData: Record<string, MarketingChannel[]> = {
      '1': [
        { channel: 'Instagram', reach: 45000, engagement: 4.2, cost: 85000 },
        { channel: 'VK', reach: 38000, engagement: 3.8, cost: 62000 },
        { channel: 'Яндекс.Директ', reach: 52000, engagement: 2.1, cost: 120000 },
        { channel: 'Google Ads', reach: 28000, engagement: 2.5, cost: 95000 },
        { channel: 'Telegram', reach: 15000, engagement: 5.1, cost: 35000 },
      ],
      '2': [
        { channel: 'Instagram', reach: 32000, engagement: 3.8, cost: 65000 },
        { channel: 'VK', reach: 28000, engagement: 4.1, cost: 45000 },
        { channel: 'Яндекс.Директ', reach: 38000, engagement: 2.3, cost: 85000 },
        { channel: 'Google Ads', reach: 22000, engagement: 2.8, cost: 72000 },
        { channel: 'Telegram', reach: 12000, engagement: 4.8, cost: 28000 },
      ],
      '3': [
        { channel: 'Instagram', reach: 52000, engagement: 4.5, cost: 98000 },
        { channel: 'VK', reach: 42000, engagement: 3.5, cost: 75000 },
        { channel: 'Яндекс.Директ', reach: 58000, engagement: 1.9, cost: 135000 },
        { channel: 'Google Ads', reach: 32000, engagement: 2.2, cost: 110000 },
        { channel: 'Telegram', reach: 18000, engagement: 5.3, cost: 42000 },
      ],
      '4': [
        { channel: 'Instagram', reach: 38000, engagement: 4.8, cost: 72000 },
        { channel: 'VK', reach: 25000, engagement: 4.2, cost: 38000 },
        { channel: 'Яндекс.Директ', reach: 32000, engagement: 2.4, cost: 68000 },
        { channel: 'Google Ads', reach: 18000, engagement: 3.1, cost: 52000 },
        { channel: 'Telegram', reach: 8000, engagement: 6.2, cost: 18000 },
      ]
    };    
    return competitorMarketingData[selectedCompetitor] || marketingChannels;
  };

  const filteredMarketingData = getFilteredMarketingData();
  const { insights, strategy } = generateMarketingInsights(competitors, selectedCompetitor);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Маркетинговый анализ {selectedCompetitor !== 'all' ? `- ${getCompetitorName(selectedCompetitor)}` : ''}
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Маркетинговые каналы</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Канал
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Охват
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Engagement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Стоимость
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ROI
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMarketingData.map((channel) => (
                <tr key={channel.channel}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {channel.channel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {channel.reach.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {channel.engagement}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ₽{channel.cost.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {(
                        ((channel.reach * channel.engagement) /
                          100 /
                          channel.cost) *
                        1000
                      ).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Целевая аудитория</h3>
          <div className="space-y-4">
            {[
              { age: '18-24 года', percent: 15 },
              { age: '25-34 года', percent: 35 },
              { age: '35-44 года', percent: 30 },
              { age: '45+ лет', percent: 20 },
            ].map((item) => (
              <div key={item.age}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">{item.age}</span>
                  <span className="text-sm text-gray-600">{item.percent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Интересы аудитории</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'Еда и рестораны',
              'Путешествия',
              'Здоровый образ жизни',
              'Семья',
              'Технологии',
              'Мода',
              'Спорт',
              'Музыка',
              'Кино',
            ].map((interest) => (
              <span
                key={interest}
                className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Добавляем блоки с выводами и стратегией */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsBlock
          title="Маркетинговые выводы"
          type="insights"
          insights={insights}
        />
        <InsightsBlock
          title="Маркетинговая стратегия"
          type="strategy"
          insights={strategy}
        />
      </div>
    </div>
  );
};

export default MarketingAnalysisTab;