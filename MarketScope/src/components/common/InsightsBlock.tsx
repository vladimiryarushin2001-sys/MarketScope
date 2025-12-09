import React from 'react';
import { Lightbulb, TrendingUp, Target, AlertTriangle, CheckCircle } from 'lucide-react';

interface InsightsBlockProps {
  title: string;
  type?: 'insights' | 'strategy';
  insights: string[];
}

const InsightsBlock: React.FC<InsightsBlockProps> = ({ 
  title, 
  type = 'insights', 
  insights 
}) => {
  const getIcon = () => {
    switch (type) {
      case 'strategy':
        return <Target className="w-5 h-5 text-green-600" />;
      default:
        return <Lightbulb className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBorderColor = () => {
    return type === 'strategy' 
      ? 'border-l-green-500' 
      : 'border-l-blue-500';
  };

  const getBgColor = () => {
    return type === 'strategy'
      ? 'bg-green-50'
      : 'bg-blue-50';
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${getBgColor()}`}>
      <div className="flex items-center space-x-3 mb-4">
        {getIcon()}
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight, index) => (
          <div 
            key={index}
            className={`flex items-start space-x-3 p-3 bg-white rounded-lg border-l-4 ${getBorderColor()} shadow-xs`}
          >
            {type === 'strategy' ? (
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            ) : (
              <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            )}
            <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InsightsBlock;