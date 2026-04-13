import React from 'react';
import { Target, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { AnalysisRun, ClientRequest } from '../../types';

interface HeaderProps {
  requests: ClientRequest[];
  runs: AnalysisRun[];
  selectedRequestId: number | null;
  onSelectRequest: (requestId: number) => void;
}

const Header: React.FC<HeaderProps> = ({ requests, selectedRequestId, onSelectRequest }) => {
  const { signOut } = useAuth();

  const typeLabel = (t: string) =>
    t === 'market_overview' ? 'Обзор рынка' : t === 'competitive_analysis' ? 'Конкурентный анализ' : t || '—';

  const formatDate = (dt: string) => {
    try {
      return new Date(dt).toLocaleString('ru-RU');
    } catch {
      return dt;
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center space-x-2">
              <Target className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                MarketScope
              </h1>
            </div>
            <span className="text-sm text-gray-500 truncate">
              Анализ конкурентов HoReCa
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-gray-500">Запрос</span>
              <select
                className="min-w-0 flex-1 sm:flex-none sm:min-w-[280px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedRequestId ?? ''}
                onChange={(e) => onSelectRequest(Number(e.target.value))}
                disabled={!requests.length}
              >
                {!requests.length && <option value="">Нет запросов</option>}
                {requests.map((req, idx) => {
                  const displayNumber = idx + 1;
                  const label = `${formatDate(req.created_at)} · #${displayNumber} · ${typeLabel(req.request_type ?? '')}`;
                  return (
                    <option key={req.id} value={req.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
