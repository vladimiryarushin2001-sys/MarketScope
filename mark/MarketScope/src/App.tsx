import React, { useState, useMemo } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PreviewPage from './pages/PreviewPage';
import Header from './components/common/Header';
import Navigation from './components/common/Navigation';
import { Footer } from './components/common/Footer';
import OverviewTab from './components/overview/OverviewTab';
import TechnicalAnalysisTab from './components/technical/TechnicalAnalysisTab';
import ReviewAnalysisTab from './components/reviews/ReviewAnalysisTab';
import MarketingAnalysisTab from './components/marketing/MarketingAnalysisTab';
import MenuTab from './components/menu/MenuTab';
import StrategicProposalsTab from './components/strategic/StrategicProposalsTab';
import PersonalCabinetTab from './components/cabinet/PersonalCabinetTab';
import AIStrategyPage from './components/ai/AIStrategyPage';
import NewRequestTab from './components/requests/NewRequestTab';
import SubscriptionPage from './components/subscription/SubscriptionPage';

import type { Restaurant, CompetitorData } from './types';
import { supabase } from './lib/supabase';
import {
  restaurants as mockRestaurants,
  competitors as mockCompetitors,
  reviews as mockReviews,
  technicalAnalysis as mockTechnicalAnalysis,
  strategicReport as mockStrategicReport,
  menus as mockMenus,
  menuItems as mockMenuItems,
  marketingLoyalty as mockMarketingLoyalty,
  marketing as mockMarketing,
  marketingSocials as mockMarketingSocials,
} from './data/mockData';
import { useDashboardData } from './hooks/useDashboardData';
import { useClientRequests } from './hooks/useClientRequests';
import { getRestaurantName, getFilteredRestaurantData, getMetricsForRestaurant } from './utils/dataFilters';
import { useSubscriptionStatus } from './hooks/useSubscriptionStatus';
import { invokeEdgeFunction } from './lib/edgeFunctions';

function AppContent() {
  const { isAuthenticated, authLoading } = useAuth();
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    );
  }
  if (!isAuthenticated) return <PreviewPage />;
  return <CompetitorAnalysisDashboard />;
}

const CompetitorAnalysisDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('new_request');
  const [selectedRestaurant, setSelectedRestaurant] = useState<number | 'all'>('all');
  const [showAIStrategy, setShowAIStrategy] = useState(false);
  const timeRange = '30d';

  const { requests, runs, runsByRequestId, latestRequestId, loading: reqLoading, error: reqError, reload: reloadRequests } = useClientRequests();
  const { isActive: subscriptionActive, loading: subscriptionLoading } = useSubscriptionStatus();
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  const activeRequestId = selectedRequestId ?? latestRequestId ?? null;
  const activeRequest = useMemo(() => (activeRequestId ? requests.find((r) => r.id === activeRequestId) ?? null : null), [activeRequestId, requests]);
  const latestRunForRequestId = useMemo(() => {
    if (!activeRequestId) return null;
    const list = runsByRequestId.get(activeRequestId) ?? [];
    const sorted = [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return sorted[0]?.id ?? null;
  }, [activeRequestId, runsByRequestId]);

  const {
    restaurants: dbRestaurants,
    competitorData: dbCompetitorData,
    reviews: dbReviews,
    technicalAnalysis: dbTechnicalAnalysis,
    strategicReport: dbStrategicReport,
    menus: dbMenus,
    menuItems: dbMenuItems,
    marketingLoyalty: dbMarketingLoyalty,
    marketing: dbMarketing,
    marketingSocials: dbMarketingSocials,
    loading: dbLoading,
    error: dbError,
    refetch,
    hasDb,
    activeRunId,
  } = useDashboardData(activeRequestId ? latestRunForRequestId : undefined);

  const restaurants: Restaurant[] = useMemo(() => {
    if (hasDb && !dbError) return dbRestaurants;
    return mockRestaurants;
  }, [hasDb, dbError, dbRestaurants]);

  const competitorData: CompetitorData[] = useMemo(() => {
    if (hasDb && !dbError) return dbCompetitorData;
    return mockCompetitors;
  }, [hasDb, dbError, dbCompetitorData]);

  const useDbData = hasDb && !dbError;
  const reviews = useDbData ? dbReviews : mockReviews;
  const technicalAnalysis = useDbData ? dbTechnicalAnalysis : mockTechnicalAnalysis;
  const strategicReport = useDbData ? dbStrategicReport : mockStrategicReport;
  const menus = useDbData ? dbMenus : mockMenus;
  const menuItems = useDbData ? dbMenuItems : mockMenuItems;
  const marketingLoyalty = useDbData ? dbMarketingLoyalty : mockMarketingLoyalty;
  const marketing = useDbData ? dbMarketing : mockMarketing;
  const marketingSocials = useDbData ? dbMarketingSocials : mockMarketingSocials;

  const dataLoaded = !dbLoading && !reqLoading && !subscriptionLoading;
  const tabsAllowedWithoutSubscription = new Set(['new_request', 'subscription', 'cabinet']);
  const isBlockedBySubscription = !subscriptionActive && !tabsAllowedWithoutSubscription.has(activeTab);

  const getCurrentFilteredData = () => getFilteredRestaurantData(selectedRestaurant, restaurants, timeRange);
  const getMetricsForTimeRange = () => getMetricsForRestaurant(timeRange, selectedRestaurant, restaurants);

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

  const selectedId = selectedRestaurant === 'all' ? 'all' : String(selectedRestaurant);
  const getCompetitorNameForAI = (id: string) =>
    getRestaurantName(id === 'all' ? 'all' : Number(id), restaurants);

  const renderTabContent = () => {
    const commonRestaurantProps = {
      selectedRestaurant,
      restaurants,
      competitorData,
      getRestaurantName: (id: number | 'all', list: Restaurant[]) => getRestaurantName(id, list),
    };
    switch (activeTab) {
      case 'new_request':
        return (
          <NewRequestTab
            onCreated={(req) => {
              setSelectedRequestId(req.id);
              setActiveTab('overview');
              reloadRequests();
            }}
            onOpenSubscription={() => setActiveTab('subscription')}
            subscriptionActive={subscriptionActive}
          />
        );
      case 'subscription':
        return <SubscriptionPage onBackToRequest={() => setActiveTab('new_request')} />;
      case 'overview':
        return (
          <OverviewTab
            {...commonRestaurantProps}
            timeRange={timeRange}
            getFilteredData={getCurrentFilteredData}
            getMetricsForTimeRange={getMetricsForTimeRange}
          />
        );
      case 'technical':
        return (
          <TechnicalAnalysisTab
            {...commonRestaurantProps}
            competitors={competitorData}
            technicalAnalysis={technicalAnalysis}
          />
        );
      case 'reviews':
        return (
          <ReviewAnalysisTab
            {...commonRestaurantProps}
            competitors={competitorData}
            reviews={reviews}
            getRestaurantName={(id, list) => getRestaurantName(id, list)}
          />
        );
      case 'marketing':
        return (
          <MarketingAnalysisTab
            {...commonRestaurantProps}
            competitors={competitorData}
            marketing={marketing}
            marketingLoyalty={marketingLoyalty}
            marketingSocials={marketingSocials}
            getRestaurantName={(id, list) => getRestaurantName(id, list)}
          />
        );
      case 'pricing':
        return (
          <MenuTab
            {...commonRestaurantProps}
            competitors={competitorData}
            menus={menus}
            menuItems={menuItems}
            getRestaurantName={(id, list) => getRestaurantName(id, list)}
          />
        );
      case 'strategic':
        return (
          <StrategicProposalsTab
            selectedRestaurant={selectedRestaurant}
            restaurants={restaurants}
            strategicReport={strategicReport}
            getRestaurantName={(id, list) => getRestaurantName(id, list)}
          />
        );
      case 'cabinet':
        return (
          <PersonalCabinetTab onOpenSubscription={() => setActiveTab('subscription')} />
        );
      default:
        return (
          <OverviewTab
            {...commonRestaurantProps}
            timeRange={timeRange}
            getFilteredData={getCurrentFilteredData}
            getMetricsForTimeRange={getMetricsForTimeRange}
          />
        );
    }
  };

  const activeRun = React.useMemo(() => {
    if (!activeRequestId) return null;
    const list = runs.filter((r) => r.request_id === activeRequestId);
    return list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
  }, [runs, activeRequestId]);

  const isRunInProgress = Boolean(activeRun && (activeRun.status === 'pending' || activeRun.status === 'running'));
  const isRunErrored = Boolean(activeRun && activeRun.status === 'error');
  const shouldBlurTabsWhileRunning = Boolean(isRunInProgress && dataLoaded && restaurants.length === 0);

  /** Все незавершённые прогоны по аккаунту — иначе при выборе «старого» запроса в шапке новый run не опрашивается и ingest не вызывается. */
  const runIdsNeedingPollKey = useMemo(() => {
    const ids = runs
      .filter((r) => r.status === 'pending' || r.status === 'running')
      .map((r) => r.id)
      .sort((a, b) => a - b);
    return ids.join(',');
  }, [runs]);

  // Poll ms-v2 for every pending/running run (client-driven ingest on completion)
  React.useEffect(() => {
    if (!runIdsNeedingPollKey) return;
    const runIds = runIdsNeedingPollKey.split(',').map((s) => Number(s)).filter((n) => Number.isFinite(n) && n > 0);
    if (runIds.length === 0) return;

    let cancelled = false;
    const tick = async () => {
      try {
        for (const runId of runIds) {
          if (cancelled) return;
          await invokeEdgeFunction('ms-v2-poll', { run_id: runId });
        }
        if (!cancelled) reloadRequests({ silent: true });
      } catch {
        // ignore transient errors; we'll try again
      }
    };
    tick();
    const t = window.setInterval(tick, 6000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [runIdsNeedingPollKey, reloadRequests]);

  if (showAIStrategy) {
    return (
      <AIStrategyPage
        competitors={competitorData}
        selectedCompetitor={selectedId}
        strategicReport={strategicReport}
        getCompetitorName={getCompetitorNameForAI}
        onBack={() => setShowAIStrategy(false)}
      />
    );
  }

  return (
    <div id="export-content" className="min-h-screen bg-gray-50">
      <Header
        requests={requests}
        runs={runs}
        selectedRequestId={activeRequestId}
        onSelectRequest={(rid) => setSelectedRequestId(rid)}
        onOpenCabinet={() => setActiveTab('cabinet')}
      />
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!dataLoaded ? (
          <div className="flex items-center justify-center py-12 text-gray-500">Загрузка данных...</div>
        ) : (reqError || dbError) && hasDb ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
            <p className="font-medium">Не удалось загрузить данные из БД</p>
            <p className="text-sm mt-1">{reqError || dbError}</p>
            <p className="text-sm mt-2">Показаны демо-данные.</p>
          </div>
        ) : null}
        {dataLoaded && isBlockedBySubscription ? (
          <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900">Доступ ограничен</h3>
            <p className="text-sm text-gray-600 mt-2">
              Для просмотра аналитики нужна активная подписка. Вы можете создать новый запрос и перейти на страницу оплаты.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Перейти к тарифам
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('new_request')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Новый запрос
              </button>
            </div>
          </div>
        ) : dataLoaded ? (
          <div className="relative">
            {shouldBlurTabsWhileRunning && (
              <div className="absolute inset-0 z-20 flex items-center justify-center">
                <div className="rounded-xl bg-white/70 backdrop-blur-md border border-gray-200 shadow-sm px-6 py-4 text-center max-w-md">
                  <div className="text-sm font-semibold text-gray-900">Идёт обработка запроса</div>
                  <div className="mt-1 text-xs text-gray-600">
                    Как только микросервис закончит анализ, данные появятся на всех вкладках автоматически.
                  </div>
                  {activeRun?.progress && (
                    <div className="mt-2 text-xs text-gray-700">
                      Прогресс: <span className="font-medium">{activeRun.progress}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className={shouldBlurTabsWhileRunning ? 'filter blur-sm pointer-events-none select-none opacity-60' : ''}>
              {renderTabContent()}
            </div>
            {isRunErrored && (
              <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-4 text-rose-800">
                <div className="font-medium">Анализ завершился с ошибкой</div>
                <div className="text-sm mt-1">{activeRun?.error || 'Неизвестная ошибка'}</div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <AppContent />
      </div>
      <Footer />
    </div>
  </AuthProvider>
);

export default App;
