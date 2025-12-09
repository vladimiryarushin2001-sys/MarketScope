import type { CompetitorData } from '../types';
import { performanceData, getTimeDependentData } from '../data/mockData';

export const getCompetitorName = (id: string, competitorsList: CompetitorData[]): string => {
  const competitor = competitorsList.find(comp => comp.id === id);
  return competitor ? competitor.name : 'Все конкуренты';
};

export const getFilteredData = (selectedCompetitor: string, competitorsList: CompetitorData[], timeRange: string) => {
  const currentPerformanceData = performanceData[timeRange] || performanceData['30d'];
  
  if (selectedCompetitor === 'all') {
    return {
      competitors: competitorsList,
      performanceData: currentPerformanceData,
      showAll: true
    };
  }
  
  const filteredCompetitor = competitorsList.find(comp => comp.id === selectedCompetitor);
  return {
    competitors: filteredCompetitor ? [filteredCompetitor] : [],
    performanceData: currentPerformanceData.map((item: any) => {
      const competitorKey = `competitor${selectedCompetitor}` as keyof typeof item;
      return {
        month: item.month,
        [competitorKey]: item[competitorKey]
      };
    }),
    showAll: false
  };
};

export const getMetricsForTimeRange = (timeRange: string, selectedCompetitor: string, competitors: CompetitorData[]) => {
  const timeData = getTimeDependentData(timeRange);
  
  if (selectedCompetitor === 'all') {
    return {
      rating: timeData.rating,
      marketShare: `${timeData.marketShare}%`,
      sentimentScore: `${timeData.sentimentScore}%`,
      seoScore: timeData.seoScore.toString(),
    };
  }

  const competitor = competitors.find(c => c.id === selectedCompetitor);
  if (!competitor) return timeData;

  return {
    rating: (competitor.rating * (parseFloat(timeData.rating) / 4.4)).toFixed(1),
    marketShare: Math.round(competitor.marketShare * (timeData.marketShare / 53)),
    sentimentScore: Math.round(competitor.sentimentScore * (timeData.sentimentScore / 79)),
    seoScore: Math.round(competitor.seoScore * (timeData.seoScore / 88)),
  };
};

export const financialData = [
  { metric: 'Выручка', value: 85, benchmark: 75 },
  { metric: 'Рентабельность', value: 72, benchmark: 68 },
  { metric: 'Ликвидность', value: 90, benchmark: 80 },
  { metric: 'Долговая нагрузка', value: 35, benchmark: 45 },
  { metric: 'Рост', value: 78, benchmark: 70 },
];

export const sentimentData = [
  { name: 'Положительные', value: 65, color: '#10b981' },
  { name: 'Нейтральные', value: 25, color: '#6b7280' },
  { name: 'Отрицательные', value: 10, color: '#ef4444' },
];