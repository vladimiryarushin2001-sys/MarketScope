import React, { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, CreditCard, FileText, Globe, Menu, MessageSquare, PlusCircle, ShoppingCart, Target, User } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab }) => {
  const tabs = useMemo(
    () => [
    { id: 'new_request', label: 'Новый запрос', icon: PlusCircle },
    { id: 'subscription', label: 'Подписка', icon: CreditCard },
    { id: 'overview', label: 'Обзор', icon: BarChart3 },
    { id: 'technical', label: 'Технический анализ', icon: Globe },
    { id: 'reviews', label: 'Анализ отзывов', icon: MessageSquare },
    { id: 'marketing', label: 'Маркетинг', icon: Target },
    { id: 'pricing', label: 'Меню', icon: ShoppingCart },
    { id: 'strategic', label: 'Стратегические предложения', icon: FileText },
    { id: 'cabinet', label: 'Личный кабинет', icon: User },
    ],
    []
  );

  const [open, setOpen] = useState(false);
  const active = useMemo(() => tabs.find((t) => t.id === activeTab) ?? tabs[0], [activeTab, tabs]);

  const onPick = (id: string) => {
    setActiveTab(id);
    setOpen(false);
  };

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: dropdown menu to avoid horizontal scroll */}
        <div className="py-3 sm:hidden">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Menu className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="flex items-center gap-2 min-w-0">
                  {active?.icon ? <active.icon className="w-4 h-4 text-blue-600 flex-shrink-0" /> : null}
                  <span className="truncate">{active?.label ?? 'Раздел'}</span>
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="max-h-[70vh] overflow-auto py-1">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => onPick(tab.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                          activeTab === tab.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        role="menuitem"
                      >
                        <tab.icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Desktop: tabs */}
        <nav className="hidden sm:flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onPick(tab.id)}
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