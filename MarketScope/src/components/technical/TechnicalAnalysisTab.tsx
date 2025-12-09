import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, Zap, Clock, Globe, FileText, AlertCircle } from 'lucide-react';
import type { CompetitorData, SeoMetric } from '../../types';
import InsightsBlock from '../common/InsightsBlock';
import { generateTechnicalInsights } from '../../utils/aiInsights';

interface TechnicalAnalysisTabProps {
  selectedCompetitor: string;
  competitors: CompetitorData[];
  seoMetrics: SeoMetric[];
  getCompetitorName: (id: string) => string;
}

const TechnicalAnalysisTab: React.FC<TechnicalAnalysisTabProps> = ({
  selectedCompetitor,
  competitors,
  seoMetrics,
  getCompetitorName
}) => {
  const filteredCompetitors = selectedCompetitor === 'all' 
    ? competitors 
    : competitors.filter(comp => comp.id === selectedCompetitor);

  const { insights, strategy } = generateTechnicalInsights(competitors, selectedCompetitor);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Технический анализ {selectedCompetitor !== 'all' ? `- ${getCompetitorName(selectedCompetitor)}` : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">SEO метрики</h3>
          <div className="space-y-4">
            {seoMetrics.map((metric) => (
              <div key={metric.metric} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{metric.metric}</span>
                  <span className="font-medium">
                    {metric.current} {metric.unit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metric.metric === 'Скорость загрузки' 
                        ? (metric.current <= 1.5 ? 'bg-green-500' : metric.current <= 3 ? 'bg-yellow-500' : 'bg-red-500')
                        : 'bg-blue-600'
                    }`}
                    style={{
                      width: metric.metric === 'Скорость загрузки' 
                        ? `${Math.min((1 / metric.current) * 100, 100)}%`
                        : `${(metric.current / metric.optimal) * 100}%`,
                    }}
                  />
                </div>
                {metric.metric === 'Скорость загрузки' && (
                  <div className="text-xs text-gray-500">
                    Оптимально: {metric.optimal} {metric.unit}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Скорость загрузки сайтов
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={filteredCompetitors.map((c) => ({
                name: c.name,
                loadTime: c.loadTime,
                fill: c.loadTime < 2 ? '#10b981' : c.loadTime < 3 ? '#f59e0b' : '#ef4444'
              }))}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${value} сек`, 'Скорость загрузки']}
                labelFormatter={(label) => `Сайт: ${label}`}
              />
              <Bar 
                dataKey="loadTime" 
                name="Скорость загрузки"
                radius={[4, 4, 0, 0]}
              >
                {filteredCompetitors.map((entry, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.loadTime < 2 ? '#10b981' : entry.loadTime < 3 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Технический аудит</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'SSL сертификат', status: 'active', icon: Shield },
            { label: 'Mobile-friendly', status: 'active', icon: Zap },
            { label: 'Скорость загрузки', status: 'warning', icon: Clock },
            { label: 'Структура URL', status: 'active', icon: Globe },
            { label: 'XML Sitemap', status: 'active', icon: FileText },
            { label: 'Robots.txt', status: 'error', icon: AlertCircle },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <item.icon className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  item.status === 'active'
                    ? 'bg-green-500'
                    : item.status === 'warning'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Добавляем блоки с выводами и стратегией */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsBlock
          title="Технические выводы"
          type="insights"
          insights={insights}
        />
        <InsightsBlock
          title="Техническая стратегия"
          type="strategy"
          insights={strategy}
        />
      </div>
    </div>
  );
};

export default TechnicalAnalysisTab;