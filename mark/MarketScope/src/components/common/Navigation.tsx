import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const mobileOverlay =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[9000] bg-black/25 backdrop-blur-[1px]"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <div
              className="fixed left-4 right-4 top-24 z-[9100] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
              role="menu"
              aria-label="Навигация"
            >
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
                    <span className="truncate notranslate" translate="no">
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <div className="bg-white border-b border-gray-200 notranslate" translate="no">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: dropdown menu to avoid horizontal scroll */}
        <div className="py-3 sm:hidden">
          <div className="relative z-[1000]">
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
              <span className="truncate notranslate" translate="no">
                {active?.label ?? 'Раздел'}
              </span>
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {mobileOverlay}
          </div>
        </div>

        {/* Desktop: tabs */}
        <nav
          className="hidden sm:flex items-center gap-8 overflow-x-auto whitespace-nowrap py-0"
          aria-label="Tabs"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onPick(tab.id)}
              className={`
                flex-shrink-0 py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="w-4 h-4" />
              <span className="notranslate" translate="no">
                {tab.label}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Navigation;