import React from 'react';
import { BarChart3, Globe, MessageSquare, Target, ShoppingCart, FileText, User, PlusCircle, CreditCard } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'new_request', label: 'Новый запрос', icon: PlusCircle },
    { id: 'subscription', label: 'Подписка', icon: CreditCard },
    { id: 'overview', label: 'Обзор', icon: BarChart3 },
    { id: 'technical', label: 'Технический анализ', icon: Globe },
    { id: 'reviews', label: 'Анализ отзывов', icon: MessageSquare },
    { id: 'marketing', label: 'Маркетинг', icon: Target },
    { id: 'pricing', label: 'Меню', icon: ShoppingCart },
    { id: 'strategic', label: 'Стратегические предложения', icon: FileText },
    { id: 'cabinet', label: 'Личный кабинет', icon: User },
  ];

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Navigation;