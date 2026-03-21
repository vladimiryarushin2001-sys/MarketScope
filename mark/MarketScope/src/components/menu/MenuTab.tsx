import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { Restaurant, CompetitorData, Menu, MenuItem } from '../../types';

interface MenuTabProps {
  selectedRestaurant: number | 'all';
  restaurants: Restaurant[];
  competitors: CompetitorData[];
  menus: Menu[];
  menuItems: MenuItem[];
  getRestaurantName: (id: number | 'all', list: Restaurant[]) => string;
}

const MenuTab: React.FC<MenuTabProps> = ({
  selectedRestaurant,
  restaurants,
  competitors,
  menus,
  menuItems,
  getRestaurantName,
}) => {
  const selectedId = selectedRestaurant === 'all' ? 'all' : String(selectedRestaurant);
  const filteredRestaurants = selectedRestaurant === 'all' ? restaurants : restaurants.filter(r => r.id === selectedRestaurant);
  const restaurantIds = filteredRestaurants.map((r) => r.id);
  const filteredMenus = menus.filter((m) => restaurantIds.includes(m.restaurant_id));
  const menuIds = filteredMenus.map((m) => m.id);
  const itemsForMenus = menuItems.filter((mi) => menuIds.includes(mi.menu_id));

  const priceData = filteredRestaurants.map(r => ({ name: r.name, avg_check: r.avg_check, cuisine: r.cuisine }));
  const barColors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#64748b'];
  const cleanParagraphs = (text?: string): string[] =>
    (text || '')
      .replace(/[*#`]/g, '')
      .replace(/\r/g, '\n')
      .split(/\.\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.endsWith('.') ? x : `${x}.`));

  const categoryComparison = (() => {
    const map = new Map<string, Record<string, number>>();
    filteredMenus.forEach((menu) => {
      const restName = restaurants.find((r) => r.id === menu.restaurant_id)?.name ?? '';
      const items = itemsForMenus.filter((i) => i.menu_id === menu.id);
      const byCat = new Map<string, number[]>();
      items.forEach((i) => {
        const list = byCat.get(i.category) ?? [];
        list.push(i.price);
        byCat.set(i.category, list);
      });
      byCat.forEach((prices, category) => {
        const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
        const row = map.get(category) ?? {};
        row[restName] = avg;
        map.set(category, row);
      });
    });
    return Array.from(map.entries()).slice(0, 7).map(([category, values]) => ({ category, ...values }));
  })();

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Анализ меню {selectedRestaurant !== 'all' ? `- ${filteredRestaurants[0]?.name ?? ''}` : ''}
        </h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Средний чек по ресторанам</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={priceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="avg_check" name="Средний чек (₽)">
              {priceData.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={barColors[idx % barColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {categoryComparison.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Сравнение средней стоимости категорий</h3>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={categoryComparison}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              {filteredRestaurants.map((r, idx) => (
                <Bar key={r.id} dataKey={r.name} fill={barColors[idx % barColors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {filteredMenus.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Меню ресторанов</h3>
          <div className="space-y-6">
            {filteredMenus.map((menu) => {
              const items = itemsForMenus.filter((i) => i.menu_id === menu.id);
              const restName = restaurants.find((r) => r.id === menu.restaurant_id)?.name ?? '';
              return (
                <div key={menu.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <p className="font-semibold text-gray-900">{restName}</p>
                    {menu.status && <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{menu.status}</span>}
                    {menu.items_count > 0 && <span className="text-xs text-gray-500">Позиций: {menu.items_count}</span>}
                    {menu.has_kids_menu && <span className="text-xs px-2 py-0.5 bg-amber-100 rounded">Детское меню</span>}
                  </div>
                  {menu.menu_urls?.length > 0 && (
                    <p className="text-xs text-gray-500 mb-2">
                      Ссылки: {menu.menu_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">{url}</a>
                      ))}
                    </p>
                  )}
                  {menu.categories?.length > 0 && (
                    <p className="text-sm text-gray-600 mb-2">Категории: {menu.categories.join(', ')}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    {Array.from(
                      items.reduce((acc, it) => {
                        const list = acc.get(it.category) ?? [];
                        list.push(it.price);
                        acc.set(it.category, list);
                        return acc;
                      }, new Map<string, number[]>()).entries()
                    )
                      .slice(0, 7)
                      .map(([cat, prices]) => {
                        const avg = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
                        const categoryItems = items.filter((it) => it.category === cat);
                        return (
                          <details key={cat} className="border border-gray-100 rounded p-2">
                            <summary className="cursor-pointer font-medium text-gray-800">
                              {cat} - средняя цена {avg} ₽
                            </summary>
                            <p className="text-xs text-gray-500 mt-1">Позиций в категории: {prices.length}</p>
                            <ul className="mt-2 space-y-1">
                              {categoryItems.slice(0, 12).map((it) => (
                                <li key={it.id} className="flex justify-between text-sm text-gray-700 border-b border-gray-100 pb-1">
                                  <span className="pr-2">{it.name}</span>
                                  <span className="font-medium whitespace-nowrap">{it.price} ₽</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    {items.length === 0 && <p className="text-gray-500">Нет позиций</p>}
                  </div>
                  {menu.conclusion && (
                    <div className="mt-3 bg-blue-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Вывод</p>
                      {cleanParagraphs(menu.conclusion).map((p, i) => (
                        <p key={i} className="text-sm text-gray-800">{p}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-gray-500">
          Нет данных о меню для выбранных ресторанов.
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 bg-blue-50">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Вывод на основе анализа меню</h3>
        <div className="space-y-3">
          {cleanParagraphs(filteredMenus.find((m) => m.reference_conclusion)?.reference_conclusion).map((p, i) => (
            <p key={i} className="text-sm text-gray-800 leading-relaxed">{p}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MenuTab;
