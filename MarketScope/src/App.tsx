import React, { useState } from 'react';
import { Download, RefreshCw, Filter, Zap } from 'lucide-react';

// Компоненты
import Header from './components/common/Header';
import Navigation from './components/common/Navigation';
import OverviewTab from './components/overview/OverviewTab';
import TechnicalAnalysisTab from './components/technical/TechnicalAnalysisTab';
import ReviewAnalysisTab from './components/reviews/ReviewAnalysisTab';
import FinancialAnalysisTab from './components/financial/FinancialAnalysisTab';
import MarketingAnalysisTab from './components/marketing/MarketingAnalysisTab';
import PricingAnalysisTab from './components/pricing/PricingAnalysisTab';
import AIStrategyPage from './components/ai/AIStrategyPage';

// Данные и утилиты
import { competitors, seoMetrics, timeRanges } from './data/mockData';
import { getCompetitorName, getFilteredData, getMetricsForTimeRange } from './utils/dataFilters';

const CompetitorAnalysisDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCompetitor, setSelectedCompetitor] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('30d');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showAIStrategy, setShowAIStrategy] = useState(false); // Новое состояние

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLastUpdate(new Date());
    }, 1500);
  };

  const getCurrentFilteredData = () => {
    return getFilteredData(selectedCompetitor, competitors, timeRange);
  };

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    
    const element = document.getElementById('export-content') || document.body;
    
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');
    
    const pdf = new jsPDF();
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`competitor-analysis-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const renderTabContent = () => {
    const commonProps = {
      selectedCompetitor,
      competitors, // Добавляем competitors во все компоненты
      seoMetrics,
      timeRange,
      getCompetitorName: (id: string) => getCompetitorName(id, competitors),
      getFilteredData: getCurrentFilteredData,
      getMetricsForTimeRange: () => getMetricsForTimeRange(timeRange, selectedCompetitor, competitors),
    };

    switch (activeTab) {
      case 'overview':
        return <OverviewTab {...commonProps} />;
      case 'technical':
        return <TechnicalAnalysisTab {...commonProps} />;
      case 'reviews':
        return <ReviewAnalysisTab {...commonProps} />;
      case 'financial':
        return <FinancialAnalysisTab {...commonProps} />;
      case 'marketing':
        return <MarketingAnalysisTab {...commonProps} />;
      case 'pricing':
        return <PricingAnalysisTab {...commonProps} />;
      default:
        return <OverviewTab {...commonProps} />;
    }
  };

  if (showAIStrategy) {
    return (
      <AIStrategyPage
        competitors={competitors}
        selectedCompetitor={selectedCompetitor}
        getCompetitorName={(id: string) => getCompetitorName(id, competitors)}
        onBack={() => setShowAIStrategy(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        isLoading={isLoading}
        handleRefresh={handleRefresh}
        timeRanges={timeRanges}
      />
      
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCompetitor}
              onChange={(e) => setSelectedCompetitor(e.target.value)}
            >
              <option value="all">Все конкуренты</option>
              {competitors.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </select>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Фильтры</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleExportPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Экспорт</span>
            </button>
            <div className="text-sm text-gray-500">
              {selectedCompetitor !== 'all' && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full mr-4">
                  Просмотр: {getCompetitorName(selectedCompetitor, competitors)}
                </span>
              )}
              Последнее обновление: {lastUpdate.toLocaleTimeString('ru-RU')}
            </div>
          </div>
        </div>

        <div id="export-content">
          {renderTabContent()}
        </div>
      </main>

      <div className="fixed bottom-6 right-6">
        <button 
          onClick={() => setShowAIStrategy(true)}
          className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Zap className="w-5 h-5" />
          <span className="pr-2">AI Insights</span>
        </button>
      </div>
    </div>
  );
};

export default CompetitorAnalysisDashboard;