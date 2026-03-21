import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useState } from 'react';
import { getAllRestaurants } from './utils/dataProcessing';
import RestaurantCard from './components/RestaurantCard/RestaurantCard';

function App() {
  const restaurants = getAllRestaurants();
  const [maxCheckFilter, setMaxCheckFilter] = useState(null);

  const filteredRestaurants = maxCheckFilter
    ? restaurants.filter((r) => (r.averageCheck || 0) <= maxCheckFilter)
    : restaurants;

  const totalRestaurants = restaurants.length;
  const averageCheckOverall = Math.round(
    restaurants.reduce((sum, r) => sum + (r.averageCheck || 0), 0) / (restaurants.length || 1)
  );
  const minCheck = Math.min(...restaurants.map((r) => r.averageCheck || 0));
  const maxCheck = Math.max(...restaurants.map((r) => r.averageCheck || 0));
  const priceBuckets = [
    { label: '< 2000 ₽', min: 0, max: 2000 },
    { label: '2000–3000 ₽', min: 2000, max: 3000 },
    { label: '3000–4000 ₽', min: 3000, max: 4000 },
    { label: '4000–5000 ₽', min: 4000, max: 5000 },
    { label: '> 5000 ₽', min: 5000, max: Infinity },
  ];

  const priceDistribution = priceBuckets.map((b) => ({
    range: b.label,
    count: restaurants.filter(
      (r) => (r.averageCheck || 0) >= b.min && (r.averageCheck || 0) < b.max
    ).length,
  }));

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundColor: '#0f172a',
        color: '#e5e7eb',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <header
          style={{
            marginBottom: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h1 style={{ fontSize: '28px', fontWeight: 700 }}>
            MarketScope — конкурентный анализ ресторанов
          </h1>
          <span
            style={{
              padding: '6px 12px',
              borderRadius: '999px',
              backgroundColor: '#1e293b',
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Demo
          </span>
        </header>

        <main style={{ display: 'grid', gap: '24px' }}>
          {/* ОБЗОР / МЕТРИКИ */}
          <section
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
            }}
          >
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Обзор конкурентов</h2>

            <div
              style={{
                display: 'grid',
                gap: '16px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}
            >
              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#020617',
                  border: '1px solid #1f2937',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    marginBottom: '4px',
                  }}
                >
                  Всего ресторанов
                </div>
                <div style={{ fontSize: '22px', fontWeight: 600 }}>{totalRestaurants}</div>
              </div>
                          <div style={{ marginTop: '24px' }}>
              <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>
                Распределение по среднему чеку
              </h4>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={priceDistribution}>
                    <XAxis dataKey="range" stroke="#9ca3af" />
                    <YAxis allowDecimals={false} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#020617',
                        border: '1px solid #1f2937',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>


              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#020617',
                  border: '1px solid #1f2937',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    marginBottom: '4px',
                  }}
                >
                  Средний чек по рынку
                </div>
                <div style={{ fontSize: '22px', fontWeight: 600 }}>
                  {averageCheckOverall} ₽
                </div>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#020617',
                  border: '1px solid #1f2937',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    color: '#9ca3af',
                    marginBottom: '4px',
                  }}
                >
                  Диапазон среднего чека
                </div>
                <div style={{ fontSize: '22px', fontWeight: 600 }}>
                  {minCheck}–{maxCheck} ₽
                </div>
              </div>
            </div>
          </section>

          {/* СЛЕДУЮЩИЕ ШАГИ */}
          <section
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
            }}
          >
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Следующие шаги</h3>
            <ol
              style={{
                fontSize: '14px',
                color: '#9ca3af',
                paddingLeft: '18px',
              }}
            >
              <li>Подключить JSON‑файлы с данными конкурентов.</li>
              <li>Сделать простую карточку ресторана.</li>
              <li>Показать список всех ресторанов на главной.</li>
              <li>Добавить базовые метрики (средний чек, рейтинг, количество отзывов).</li>
            </ol>
          </section>

          {/* РЕСТОРАНЫ ИЗ JSON */}
          <section
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
            }}
          >
           <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Рестораны из JSON</h3>

<div
  style={{
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '13px',
    color: '#9ca3af',
  }}
>
  <span>Фильтр по среднему чеку:</span>
  <select
    value={maxCheckFilter || ''}
    onChange={(e) => {
      const value = e.target.value;
      setMaxCheckFilter(value ? Number(value) : null);
    }}
    style={{
      backgroundColor: '#020617',
      color: '#e5e7eb',
      border: '1px solid #1f2937',
      borderRadius: '8px',
      padding: '6px 8px',
      fontSize: '13px',
    }}
  >
    <option value=''>Все</option>
    <option value='2000'>до 2000 ₽</option>
    <option value='3000'>до 3000 ₽</option>
    <option value='4000'>до 4000 ₽</option>
    <option value='5000'>до 5000 ₽</option>
  </select>
</div>

<div
  style={{
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  }}
>
              {filteredRestaurants.map((r) => (
  <RestaurantCard key={r.name} restaurant={r} />
))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
