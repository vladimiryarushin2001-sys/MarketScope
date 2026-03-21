import type { Restaurant } from '../types';

export const getRestaurantName = (id: number | 'all', restaurantList: Restaurant[]): string => {
  if (id === 'all') return 'Все рестораны';
  const restaurant = restaurantList.find(r => r.id === id);
  return restaurant ? restaurant.name : 'Все рестораны';
};

export const getFilteredRestaurantData = (selectedRestaurant: number | 'all', restaurantList: Restaurant[], timeRange: string) => {
  if (selectedRestaurant === 'all') {
    return {
      restaurants: restaurantList,
      showAll: true
    };
  }
  const filteredRestaurant = restaurantList.find(r => r.id === selectedRestaurant);
  return {
    restaurants: filteredRestaurant ? [filteredRestaurant] : [],
    showAll: false
  };
};

export const getMetricsForRestaurant = (timeRange: string, selectedRestaurant: number | 'all', restaurantList: Restaurant[]) => {
  // Пример: возвращаем средний чек и тип кухни
  if (selectedRestaurant === 'all') {
    return {
      avg_check: Math.round(
        restaurantList.reduce((sum, r) => sum + r.avg_check, 0) / restaurantList.length
      ),
      cuisine: 'Все кухни',
    };
  }
  const restaurant = restaurantList.find(r => r.id === selectedRestaurant);
  if (!restaurant) return { avg_check: 0, cuisine: '' };
  return {
    avg_check: restaurant.avg_check,
    cuisine: restaurant.cuisine,
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