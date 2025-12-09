import React from 'react';
import { 
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import type { CompetitorData } from '../../types';
import { financialData } from '../../utils/dataFilters';
import InsightsBlock from '../common/InsightsBlock';
import { generateFinancialInsights } from '../../utils/aiInsights';

interface FinancialAnalysisTabProps {
  selectedCompetitor: string;
  getCompetitorName: (id: string) => string;
  getFilteredData: () => any;
}

const FinancialAnalysisTab: React.FC<FinancialAnalysisTabProps> = ({
  selectedCompetitor,
  getCompetitorName,
  getFilteredData
}) => {
  const { competitors: filteredCompetitors } = getFilteredData();
  const { insights, strategy } = generateFinancialInsights(filteredCompetitors, selectedCompetitor);

  const getFilteredFinancialData = () => {
    if (selectedCompetitor === 'all') {
      return financialData;
    }
    
    const competitorFinancialData: Record<string, any[]> = {
      '1': [
        { metric: 'Выручка', value: 85, benchmark: 75 },
        { metric: 'Рентабельность', value: 72, benchmark: 68 },
        { metric: 'Ликвидность', value: 90, benchmark: 80 },
        { metric: 'Долговая нагрузка', value: 35, benchmark: 45 },
        { metric: 'Рост', value: 78, benchmark: 70 },
      ],
      '2': [
        { metric: 'Выручка', value: 78, benchmark: 75 },
        { metric: 'Рентабельность', value: 68, benchmark: 68 },
        { metric: 'Ликвидность', value: 85, benchmark: 80 },
        { metric: 'Долговая нагрузка', value: 42, benchmark: 45 },
        { metric: 'Рост', value: 72, benchmark: 70 },
      ],
      '3': [
        { metric: 'Выручка', value: 82, benchmark: 75 },
        { metric: 'Рентабельность', value: 75, benchmark: 68 },
        { metric: 'Ликвидность', value: 88, benchmark: 80 },
        { metric: 'Долговая нагрузка', value: 38, benchmark: 45 },
        { metric: 'Рост', value: 80, benchmark: 70 },
      ],
      '4': [
        { metric: 'Выручка', value: 90, benchmark: 75 },
        { metric: 'Рентабельность', value: 82, benchmark: 68 },
        { metric: 'Ликвидность', value: 92, benchmark: 80 },
        { metric: 'Долговая нагрузка', value: 28, benchmark: 45 },
        { metric: 'Рост', value: 85, benchmark: 70 },
      ]
    };
    
    return competitorFinancialData[selectedCompetitor] || financialData;
  };

  const filteredFinancialData = getFilteredFinancialData();

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Финансовый анализ {selectedCompetitor !== 'all' ? `- ${getCompetitorName(selectedCompetitor)}` : ''}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Финансовые показатели</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={filteredFinancialData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Текущие"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Radar
                name="Benchmark"
                dataKey="benchmark"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Прогноз выручки</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={getFilteredData().performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              {selectedCompetitor === 'all' || selectedCompetitor === '1' ? (
                <Area type="monotone" dataKey="competitor1" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Вкусно и точка" />
              ) : null}
              {selectedCompetitor === 'all' || selectedCompetitor === '2' ? (
                <Area type="monotone" dataKey="competitor2" stackId="1" stroke="#10b981" fill="#10b981" name="Теремок" />
              ) : null}
              {selectedCompetitor === 'all' || selectedCompetitor === '3' ? (
                <Area type="monotone" dataKey="competitor3" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Шоколадница" />
              ) : null}
              {selectedCompetitor === 'all' || selectedCompetitor === '4' ? (
                <Area type="monotone" dataKey="competitor4" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" name="Кофемания" />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Риск-анализ</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Риск банкротства',
              value: filteredCompetitors[0]?.financialHealth > 80 ? 'Низкий' : filteredCompetitors[0]?.financialHealth > 60 ? 'Средний' : 'Высокий',
              color: filteredCompetitors[0]?.financialHealth > 80 ? 'text-green-600' : filteredCompetitors[0]?.financialHealth > 60 ? 'text-yellow-600' : 'text-red-600',
              bgColor: filteredCompetitors[0]?.financialHealth > 80 ? 'bg-green-100' : filteredCompetitors[0]?.financialHealth > 60 ? 'bg-yellow-100' : 'bg-red-100',
            },
            {
              label: 'Кредитная нагрузка',
              value: 'Средняя',
              color: 'text-yellow-600',
              bgColor: 'bg-yellow-100',
            },
            {
              label: 'Ликвидность',
              value: filteredCompetitors[0]?.financialHealth > 85 ? 'Высокая' : 'Средняя',
              color: filteredCompetitors[0]?.financialHealth > 85 ? 'text-green-600' : 'text-yellow-600',
              bgColor: filteredCompetitors[0]?.financialHealth > 85 ? 'bg-green-100' : 'bg-yellow-100',
            },
            {
              label: 'Рентабельность',
              value: 'Средняя',
              color: 'text-yellow-600',
              bgColor: 'bg-yellow-100',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="text-center p-4 bg-gray-50 rounded-lg"
            >
              <p className="text-sm text-gray-600 mb-2">{item.label}</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${item.color} ${item.bgColor}`}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Добавляем блоки с выводами и стратегией */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightsBlock
          title="Финансовые выводы"
          type="insights"
          insights={insights}
        />
        <InsightsBlock
          title="Финансовая стратегия"
          type="strategy"
          insights={strategy}
        />
      </div>
    </div>
  );
};

export default FinancialAnalysisTab;