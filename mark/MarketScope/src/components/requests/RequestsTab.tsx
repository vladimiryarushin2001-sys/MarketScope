import React from 'react';
import type { AnalysisRun, ClientRequest } from '../../types';

interface RequestsTabProps {
  requests: ClientRequest[];
  runsByRequestId: Map<number, AnalysisRun[]>;
  selectedRunId: number | null;
  onSelectRun: (runId: number) => void;
}

function formatDate(dt: string) {
  try {
    return new Date(dt).toLocaleString('ru-RU');
  } catch {
    return dt;
  }
}

const RequestsTab: React.FC<RequestsTabProps> = ({ requests, runsByRequestId, selectedRunId, onSelectRun }) => {
  const typeLabel = (t: string) =>
    t === 'market_overview' ? 'Обзор рынка' : t === 'competitive_analysis' ? 'Конкурентный анализ' : t || '—';

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Запросы</h2>
        <p className="text-sm text-gray-500 mt-1">История запросов клиента и запусков анализа</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {requests.length === 0 ? (
          <div className="text-gray-500">Пока нет запросов. Импортируйте новый отчёт — он появится здесь.</div>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => {
              const runs = runsByRequestId.get(r.id) ?? [];
              return (
                <div key={r.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="text-sm text-gray-500">{formatDate(r.created_at)}</div>
                      <div className="font-medium text-gray-900">{r.query_text || 'Запрос без текста'}</div>
                      <div className="text-xs text-gray-500 mt-1">Тип: {typeLabel(r.request_type)}</div>
                    </div>
                    <div className="text-sm text-gray-600">Запусков: {runs.length}</div>
                  </div>

                  {runs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {runs.map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => onSelectRun(run.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            selectedRunId === run.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Run #{run.id} · {run.report_type || '—'} · {formatDate(run.created_at)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestsTab;

