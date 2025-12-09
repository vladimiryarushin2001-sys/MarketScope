import React from 'react';
import { Download, RefreshCw, Target } from 'lucide-react';
import type { TimeRange } from '../../types';

interface HeaderProps {
  timeRange: string;
  setTimeRange: (range: string) => void;
  isLoading: boolean;
  handleRefresh: () => void;
  timeRanges: TimeRange[];
}

const Header: React.FC<HeaderProps> = ({ 
  timeRange, 
  setTimeRange, 
  isLoading, 
  handleRefresh,
  timeRanges 
}) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Target className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                MarketScope
              </h1>
            </div>
            <span className="text-sm text-gray-500">
              Анализ конкурентов HoReCa
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              {timeRanges.map((range) => (
                <option key={range.id} value={range.id}>
                  {range.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleRefresh}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw
                className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;