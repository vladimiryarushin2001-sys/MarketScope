import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Star } from 'lucide-react';
import type { CompetitorData, ReviewTopic } from '../../types';
import { reviewTopics } from '../../data/mockData';
import { sentimentData } from '../../utils/dataFilters';
import InsightsBlock from '../common/InsightsBlock';
import { generateReviewInsights } from '../../utils/aiInsights';

interface ReviewAnalysisTabProps {
  selectedCompetitor: string;
  competitors: CompetitorData[];
  getCompetitorName: (id: string) => string;
}

const ReviewAnalysisTab: React.FC<ReviewAnalysisTabProps> = ({
  selectedCompetitor,
  competitors,
  getCompetitorName
}) => {
  const getFilteredReviewData = (): ReviewTopic[] => {
    if (selectedCompetitor === 'all') {
      return reviewTopics;
    }
    
    const competitorReviewData: Record<string, ReviewTopic[]> = {
      '1': [
        { topic: 'Качество еды', positive: 82, negative: 18 },
        { topic: 'Обслуживание', positive: 75, negative: 25 },
        { topic: 'Цены', positive: 60, negative: 40 },
        { topic: 'Атмосфера', positive: 68, negative: 32 },
        { topic: 'Чистота', positive: 85, negative: 15 },
        { topic: 'Скорость', positive: 70, negative: 30 },
      ],
      '2': [
        { topic: 'Качество еды', positive: 88, negative: 12 },
        { topic: 'Обслуживание', positive: 90, negative: 10 },
        { topic: 'Цены', positive: 50, negative: 50 },
        { topic: 'Атмосфера', positive: 80, negative: 20 },
        { topic: 'Чистота', positive: 92, negative: 8 },
        { topic: 'Скорость', positive: 75, negative: 25 },
      ],
      '3': [
        { topic: 'Качество еды', positive: 85, negative: 15 },
        { topic: 'Обслуживание', positive: 78, negative: 22 },
        { topic: 'Цены', positive: 40, negative: 60 },
        { topic: 'Атмосфера', positive: 85, negative: 15 },
        { topic: 'Чистота', positive: 88, negative: 12 },
        { topic: 'Скорость', positive: 65, negative: 35 },
      ],
      '4': [
        { topic: 'Качество еды', positive: 92, negative: 8 },
        { topic: 'Обслуживание', positive: 88, negative: 12 },
        { topic: 'Цены', positive: 35, negative: 65 },
        { topic: 'Атмосфера', positive: 90, negative: 10 },
        { topic: 'Чистота', positive: 95, negative: 5 },
        { topic: 'Скорость', positive: 80, negative: 20 },
      ]
    };
    
    return competitorReviewData[selectedCompetitor] || reviewTopics;
  };

  const filteredReviewData = getFilteredReviewData();
  const { insights, strategy } = generateReviewInsights(competitors, selectedCompetitor);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Анализ отзывов {selectedCompetitor !== 'all' ? `- ${getCompetitorName(selectedCompetitor)}` : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Тональность отзывов</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {sentimentData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {sentimentData.map((item: any) => (
              <div
                key={item.name}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}</span>
                </div>
                <span className="text-sm font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Анализ по темам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={filteredReviewData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis 
                dataKey="topic" 
                type="category" 
                width={90}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value) => [`${value}%`, '']}
                labelFormatter={(label) => `Тема: ${label}`}
              />
              <Legend />
              <Bar 
                dataKey="positive" 
                name="Положительные отзывы" 
                fill="#10b981"
                radius={[0, 4, 4, 0]}
                stackId="a"
              />
              <Bar 
                dataKey="negative" 
                name="Отрицательные отзывы" 
                fill="#ef4444"
                radius={[0, 4, 4, 0]}
                stackId="a"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Последние отзывы</h3>
        <div className="space-y-4">
          {[
            {
              author: 'Мария К.',
              rating: selectedCompetitor === 'all' ? 5 : competitors.find(c => c.id === selectedCompetitor)?.rating || 5,
              text: selectedCompetitor === 'all' ? 'Отличное обслуживание и вкусная еда!' : `Отличное обслуживание в ${getCompetitorName(selectedCompetitor)}!`,
              date: '2 часа назад',
              sentiment: 'positive',
            },
            {
              author: 'Иван П.',
              rating: 3,
              text: 'Долго ждали заказ, но еда была хорошая',
              date: '5 часов назад',
              sentiment: 'neutral',
            },
            {
              author: 'Елена С.',
              rating: 4,
              text: 'Приятная атмосфера, рекомендую',
              date: '1 день назад',
              sentiment: 'positive',
            },
            {
              author: 'Дмитрий Л.',
              rating: 2,
              text: 'Цены завышены для такого качества',
              date: '2 дня назад',
              sentiment: 'negative',
            },
          ].map((review: any, index: number) => (
            <div key={index} className="border-l-4 border-gray-200 pl-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{review.author}</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < review.rating
                            ? 'text-yellow-500 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-sm text-gray-500">{review.date}</span>
              </div>
              <p className="text-gray-700">{review.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Добавляем блоки с выводами и стратегией */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsBlock
          title="Анализ отзывов"
          type="insights"
          insights={insights}
        />
        <InsightsBlock
          title="Стратегия работы с отзывами"
          type="strategy"
          insights={strategy}
        />
      </div>
    </div>
  );
};

export default ReviewAnalysisTab;