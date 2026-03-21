import React from 'react';
import { ArrowLeft, Target, TrendingUp, Calendar, CheckCircle, BarChart3 } from 'lucide-react';
import type { CompetitorData, StrategicReport } from '../../types';
import { generateFullStrategy } from '../../utils/aiInsights';

interface AIStrategyPageProps {
  competitors: CompetitorData[];
  selectedCompetitor: string;
  strategicReport?: StrategicReport[];
  getCompetitorName: (id: string) => string;
  onBack: () => void;
}

const AIStrategyPage: React.FC<AIStrategyPageProps> = ({
  competitors,
  selectedCompetitor,
  strategicReport = [],
  getCompetitorName,
  onBack,
}) => {
  const strategy = generateFullStrategy(competitors, selectedCompetitor);
  const currentCompetitor = competitors.find(c => c.id === selectedCompetitor) || competitors[0];
  const reportForSelected =
    selectedCompetitor !== 'all'
      ? strategicReport.find((r) => r.restaurant_id === Number(selectedCompetitor))
      : strategicReport[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium">
            <ArrowLeft className="w-5 h-5" />
            <span>Назад к анализу</span>
          </button>
          <div className="text-right">
            <h1 className="text-3xl font-bold text-gray-900">MarketScope</h1>
            <p className="text-gray-600">Комплексная стратегия развития</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <Target className="w-8 h-8 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Стратегия для {currentCompetitor?.name ?? getCompetitorName(selectedCompetitor)}
            </h2>
          </div>
          <p className="text-lg text-gray-700 leading-relaxed">{strategy.executiveSummary}</p>
          {reportForSelected && (
            <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
              {reportForSelected.positioning && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Позиционирование</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{reportForSelected.positioning}</p>
                </div>
              )}
              {reportForSelected.business_recommendations && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Рекомендации</h4>
                  <p className="text-gray-700 whitespace-pre-wrap">{reportForSelected.business_recommendations}</p>
                </div>
              )}
              {reportForSelected.report_md && (
                <div className="prose prose-sm max-w-none">
                  <h4 className="font-semibold text-gray-800 mb-1">Отчёт</h4>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{reportForSelected.report_md}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Key Opportunities */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                      <span>Ключевые возможности</span>
                    </h3>
                    <div className="space-y-3">
                      {strategy.keyOpportunities.map((opportunity, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-gray-700">{opportunity}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                      <BarChart3 className="w-6 h-6 text-purple-600" />
                      <span>Ключевые показатели (KPI)</span>
                    </h3>
                    <div className="space-y-3">
                      {strategy.kpis.map((kpi, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg">
                          <div className="w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-xs font-bold">{index + 1}</span>
                          </div>
                          <p className="text-gray-700">{kpi}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Strategic Initiatives */}
                <div className="bg-white rounded-xl shadow-lg p-8 mt-8">
                  <h3 className="text-2xl font-bold mb-6">Стратегические инициативы</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {strategy.strategicInitiatives.map((initiative, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-6">
                        <h4 className="text-lg font-semibold mb-4 text-blue-600">{initiative.area}</h4>
                        <div className="space-y-2">
                          {initiative.initiatives.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex items-start space-x-2">
                              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                              <p className="text-sm text-gray-700">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-xl shadow-lg p-8 mt-8">
                  <h3 className="text-2xl font-bold mb-6 flex items-center space-x-2">
                    <Calendar className="w-6 h-6 text-orange-600" />
                    <span>План реализации</span>
                  </h3>
                  <div className="space-y-6">
                    {strategy.timeline.map((phase, index) => (
                      <div key={index} className="border-l-4 border-orange-500 pl-6">
                        <h4 className="text-lg font-semibold text-orange-600 mb-3">{phase.phase}</h4>
                        <div className="space-y-2">
                          {phase.tasks.map((task, taskIndex) => (
                            <div key={taskIndex} className="flex items-center space-x-3">
                              <div className="w-3 h-3 bg-orange-500 rounded-full flex-shrink-0" />
                              <p className="text-gray-700">{task}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
      </div>
    </div>
  );
};

export default AIStrategyPage;