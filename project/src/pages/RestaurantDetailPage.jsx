import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  getAllRestaurants,
  getMenuForRestaurant,
  getReviewsForRestaurant,
  getMarketingForRestaurant,
  getTechForRestaurant,
} from '../utils/dataProcessing';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function RestaurantDetailPage() {
  const { name } = useParams();
  const decodedName = decodeURIComponent(name);
  const restaurants = getAllRestaurants();
  const restaurant = restaurants.find((r) => r.name === decodedName);

  const [activeTab, setActiveTab] = useState('overview');

  const menu = restaurant ? getMenuForRestaurant(restaurant.name) : null;
  const reviewsData = restaurant
    ? getReviewsForRestaurant(restaurant.name)
    : null;
  const marketingData = restaurant
    ? getMarketingForRestaurant(restaurant.name)
    : null;
  const techData = restaurant ? getTechForRestaurant(restaurant.name) : null;

  let menuStats = null;
  let menuCategories = [];
  let avgByGroups = [];

  if (menu && menu.items && menu.items.length > 0) {
    const prices = menu.items
      .map((i) => i.price)
      .filter((p) => typeof p === 'number' && !Number.isNaN(p));

    const totalItems = menu.items.length;
    const pricedItems = prices.length;
    const avgPrice =
      pricedItems > 0
        ? Math.round(prices.reduce((sum, p) => sum + p, 0) / pricedItems)
        : null;
    const minPrice = pricedItems > 0 ? Math.min(...prices) : null;
    const maxPrice = pricedItems > 0 ? Math.max(...prices) : null;

    menuStats = {
      totalItems,
      pricedItems,
      avgPrice,
      minPrice,
      maxPrice,
    };

    const catMap = new Map();
    menu.items.forEach((item) => {
      const cat = item.category || 'Без категории';
      if (!catMap.has(cat)) {
        catMap.set(cat, { category: cat, count: 0 });
      }
      catMap.get(cat).count += 1;
    });

    menuCategories = Array.from(catMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const categoryGroupsConfig = [
      {
        id: 'starters',
        label: 'Закуски',
        match: (cat) =>
          [
            'seasonal menu',
            'northern fish',
            'начало',
            'аквариум aquarium',
            'закус snacks',
            'закуски',
            'салаты',
            'starters',
            'salads',
          ].includes(cat),
      },
      {
        id: 'mains',
        label: 'Горячие блюда',
        match: (cat) =>
          [
            'hot snacks',
            'first courses',
            'горячие блюда из рыбы и морепродуктов',
            'горячие блюда из мяса и птицы',
            'гриль',
            'grill',
            'side dishes',
            'soups',
            'main dishes',
          ].includes(cat),
      },
      {
        id: 'desserts',
        label: 'Десерты',
        match: (cat) =>
          ['десерты', 'desserts', 'выпечка'].includes(cat),
      },
      {
        id: 'alcohol',
        label: 'Алкоголь',
        match: (cat) =>
          [
            'аперитив aperitive',
            'ягодные настойки онегин gourmet berry tinctures onegin gourmet',
            'наливки liqueur',
            'маринованные водки pickled vodka',
            'послеобеденные напитки afternoon drinks',
            'дистиллят',
            'водка',
            'органик - водка\norganic - vodka',
            'джин\ngin',
            'ром rum',
            'текила tequila',
            'российский купажированный виски',
            'российский односолодовый виски',
            'купажированный',
            'шотландия | односолодовый',
            'америка',
            'китай',
            'ирландия',
            'япония',
            'крымский коньяк\ncrimean cognac',
            'коньяк и бренди\ncognac and brandy',
            'порто и херес\nporto and jerez',
            'raw bar',
            'bar',
          ].includes(cat),
      },
      {
        id: 'non_alcohol',
        label: 'Безалкогольные напитки',
        match: (cat) =>
          [
            'свежевыжатый сок fresh juice',
            'juice il primo',
            'kvass and mors',
            'mineral water',
            'газированная вода',
            'молочные коктейли',
            'кофе и горячие напитки',
            'кофе на альтернативном молоке: миндальное / кокосовое',
            'фруктовые чаи hungry games',
            'колониальный чай importer tea',
            'травяной сбор',
            'к чаю',
            'water and drinks',
            'lemonades',
            'freshly squeezed juices',
            'smoothie',
            'milkshakes',
            'coffee',
            'tea',
            'signature tea',
          ].includes(cat),
      },
    ];

    const normalize = (s) => (s ? s.toLowerCase().trim() : '');
    const groupAcc = new Map();

    categoryGroupsConfig.forEach((g) => {
      groupAcc.set(g.id, { id: g.id, label: g.label, sum: 0, count: 0 });
    });

    menu.items.forEach((item) => {
      if (typeof item.price !== 'number' || Number.isNaN(item.price)) return;
      const catNorm = normalize(item.category);
      const group = categoryGroupsConfig.find((g) => g.match(catNorm));
      if (!group) return;
      const acc = groupAcc.get(group.id);
      acc.sum += item.price;
      acc.count += 1;
    });

    avgByGroups = Array.from(groupAcc.values())
      .filter((g) => g.count > 0)
      .map((g) => ({
        id: g.id,
        label: g.label,
        avgPrice: Math.round(g.sum / g.count),
        count: g.count,
      }));
  }

  if (!restaurant) {
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
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p style={{ marginBottom: '16px' }}>Ресторан не найден.</p>
          <Link to="/dashboard" style={{ color: '#60a5fa' }}>
            ← Назад к дашборду
          </Link>
        </div>
      </div>
    );
  }

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
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <Link to="/dashboard" style={{ color: '#60a5fa', fontSize: '14px' }}>
          ← Назад к дашборду
        </Link>

        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '16px 0 8px' }}>
          {restaurant.name}
        </h1>
        <div style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
          {restaurant.type} • {restaurant.cuisine}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            borderBottom: '1px solid #1f2937',
          }}
        >
          {[
            { id: 'overview', label: 'Обзор' },
            { id: 'menu', label: 'Меню' },
            { id: 'reviews', label: 'Отзывы' },
            { id: 'marketing', label: 'Маркетинг' },
            { id: 'tech', label: 'Техника' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: isActive ? '#e5e7eb' : '#9ca3af',
                  borderBottom: isActive
                    ? '2px solid #3b82f6'
                    : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <>
            <div
              style={{
                display: 'grid',
                gap: '16px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                marginBottom: '24px',
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
                  Средний чек
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600 }}>
                  {restaurant.averageCheck} ₽
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
                  Адрес
                </div>
                <div style={{ fontSize: '14px' }}>{restaurant.address}</div>
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
                  Часы работы
                </div>
                <div style={{ fontSize: '14px' }}>{restaurant.workingHours}</div>
              </div>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '16px',
                backgroundColor: '#020617',
                border: '1px solid #1f2937',
              }}
            >
              <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>Описание</h2>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                {restaurant.description}
              </p>
            </div>
          </>
        )}

        {activeTab === 'menu' && (
          <div
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Меню</h2>

            {!menu && (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                Для этого ресторана пока нет данных по меню.
              </p>
            )}

            {menu && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gap: '16px',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    marginBottom: '20px',
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
                      Всего позиций
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>
                      {menu.items_count ?? menu.items.length}
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
                      Позиции с ценой
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>
                      {menuStats ? menuStats.pricedItems : '—'}
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
                      Средняя цена
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>
                      {menuStats && menuStats.avgPrice
                        ? `${menuStats.avgPrice} ₽`
                        : '—'}
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
                      Диапазон цен
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: 600 }}>
                      {menuStats && menuStats.minPrice !== null
                        ? `${menuStats.minPrice}–${menuStats.maxPrice} ₽`
                        : '—'}
                    </div>
                  </div>
                </div>

                {menuCategories.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>
                      Топ категорий по количеству позиций
                    </h3>
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer>
                        <BarChart data={menuCategories} layout="vertical">
                          <XAxis type="number" stroke="#9ca3af" />
                          <YAxis
                            type="category"
                            dataKey="category"
                            width={220}
                            stroke="#9ca3af"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#020617',
                              border: '1px solid #1f2937',
                              fontSize: '12px',
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="#38bdf8"
                            radius={[0, 6, 6, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {avgByGroups.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>
                      Средняя цена по укрупнённым категориям
                    </h3>
                    <div
                      style={{
                        display: 'grid',
                        gap: '12px',
                        gridTemplateColumns:
                          'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      {avgByGroups.map((g) => (
                        <div
                          key={g.id}
                          style={{
                            padding: '12px',
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
                            {g.label}
                          </div>
                          <div style={{ fontSize: '18px', fontWeight: 600 }}>
                            {g.avgPrice} ₽
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#6b7280',
                              marginTop: '2px',
                            }}
                          >
                            Позиции: {g.count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p
                  style={{
                    fontSize: '13px',
                    color: '#9ca3af',
                    marginTop: '16px',
                  }}
                >
                  Эти цифры позволяют сравнить ценовые уровни по категориям с
                  другими ресторанами.
                </p>
              </>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Отзывы</h2>

            {!reviewsData && (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                Для этого ресторана пока нет загруженных отзывов.
              </p>
            )}

            {reviewsData && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gap: '16px',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    marginBottom: '20px',
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
                      Общая оценка
                    </div>
                    <div
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        marginBottom: '4px',
                      }}
                    >
                      {reviewsData.rating ? reviewsData.rating.toFixed(1) : '—'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#6b7280',
                      }}
                    >
                      {reviewsData.ratingCount
                        ? `${reviewsData.ratingCount} оценок`
                        : 'Нет данных по количеству оценок'}
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
                        marginBottom: '8px',
                      }}
                    >
                      Распределение оценок
                    </div>
                    <div style={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <BarChart data={reviewsData.ratingDistribution}>
                          <XAxis dataKey="label" stroke="#9ca3af" />
                          <YAxis allowDecimals={false} stroke="#9ca3af" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#020617',
                              border: '1px solid #1f2937',
                              fontSize: '12px',
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="#38bdf8"
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {reviewsData.latestReviews && (
                  <div>
                    <h3
                      style={{
                        fontSize: '14px',
                        marginBottom: '8px',
                      }}
                    >
                      Свежие отзывы
                    </h3>
                    <div
                      style={{
                        display: 'grid',
                        gap: '12px',
                      }}
                    >
                      {reviewsData.latestReviews.map((rev, index) => (
                        <div
                          key={`${rev.name}-${rev.date}-${index}`}
                          style={{
                            padding: '12px',
                            borderRadius: '10px',
                            backgroundColor: '#020617',
                            border: '1px solid #1f2937',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '4px',
                              fontSize: '13px',
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 500,
                              }}
                            >
                              {rev.name}
                            </span>
                            <span
                              style={{
                                color: '#fbbf24',
                              }}
                            >
                              {rev.stars}★
                            </span>
                          </div>
                          {typeof rev.date === 'number' && (
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#6b7280',
                                marginBottom: '6px',
                              }}
                            >
                              {new Date(rev.date * 1000).toLocaleDateString(
                                'ru-RU'
                              )}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: '13px',
                              color: '#d1d5db',
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {rev.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'marketing' && (
          <div
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>Маркетинг</h2>

            {!marketingData && (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                Для этого ресторана пока нет данных по маркетингу.
              </p>
            )}

            {marketingData && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gap: '16px',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    marginBottom: '20px',
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
                      Программа лояльности
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                      }}
                    >
                      {marketingData.loyalty.hasLoyalty ? (
                        <>
                          <span style={{ color: '#4ade80', fontWeight: 500 }}>
                            Есть программа
                          </span>
                          {marketingData.loyalty.format && (
                            <span style={{ color: '#9ca3af' }}>
                              {` • формат: ${
                                Array.isArray(marketingData.loyalty.format)
                                  ? marketingData.loyalty.format.join(', ')
                                  : marketingData.loyalty.format
                              }`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>
                          Программа лояльности не обнаружена.
                        </span>
                      )}
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
                      Сайт
                    </div>
                    {marketingData.site ? (
                      <a
                        href={marketingData.site}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '14px',
                          color: '#60a5fa',
                          textDecoration: 'none',
                        }}
                      >
                        {marketingData.site}
                      </a>
                    ) : (
                      <span style={{ fontSize: '14px', color: '#9ca3af' }}>
                        Сайт не найден.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: '14px',
                      marginBottom: '8px',
                    }}
                  >
                    Соцсети
                  </h3>
                  {marketingData.socials && marketingData.socials.length > 0 ? (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        fontSize: '13px',
                      }}
                    >
                      {marketingData.socials.map((social, index) => (
                        <a
                          key={`${social.network}-${index}`}
                          href={social.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '6px 10px',
                            borderRadius: '999px',
                            border: '1px solid #1f2937',
                            backgroundColor: '#020617',
                            color: '#e5e7eb',
                            textDecoration: 'none',
                            textTransform: 'capitalize',
                          }}
                        >
                          {social.network}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                      Активные страницы в соцсетях не найдены.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'tech' && (
          <div
            style={{
              padding: '20px',
              borderRadius: '16px',
              backgroundColor: '#020617',
              border: '1px solid #1f2937',
            }}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>
              Технические данные о сайте
            </h2>

            {!techData && (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>
                Для этого ресторана пока нет технических данных по сайту.
              </p>
            )}

            {techData && (
              <>
                <div
                  style={{
                    display: 'grid',
                    gap: '16px',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    marginBottom: '20px',
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
                      URL
                    </div>
                    {techData.url ? (
                      <a
                        href={techData.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '14px',
                          color: '#60a5fa',
                          textDecoration: 'none',
                        }}
                      >
                        {techData.url}
                      </a>
                    ) : (
                      <span style={{ fontSize: '14px', color: '#9ca3af' }}>
                        Сайт не указан.
                      </span>
                    )}
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
                      Статус и протокол
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      {typeof techData.statusCode === 'number'
                        ? `HTTP ${techData.statusCode}`
                        : 'Статус неизвестен'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: techData.https ? '#4ade80' : '#f97316',
                        marginTop: '2px',
                      }}
                    >
                      {techData.https
                        ? 'HTTPS включён'
                        : 'Сайт работает без HTTPS'}
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
                      Скорость загрузки
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '2px' }}>
                      Десктоп:{' '}
                      {typeof techData.loadTimeSec === 'number'
                        ? `${techData.loadTimeSec.toFixed(2)} c`
                        : '—'}
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      Мобайл:{' '}
                      {typeof techData.mobileLoadTimeSec === 'number'
                        ? `${techData.mobileLoadTimeSec.toFixed(2)} c`
                        : '—'}
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
                      Размер страницы и адаптив
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '2px' }}>
                      Размер HTML:{' '}
                      {typeof techData.pageSizeKb === 'number'
                        ? `${techData.pageSizeKb.toFixed(1)} КБ`
                        : '—'}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: techData.hasViewport ? '#4ade80' : '#f97316',
                      }}
                    >
                      {techData.hasViewport
                        ? 'Есть meta viewport (адаптивная верстка)'
                        : 'Meta viewport не обнаружен'}
                    </div>
                  </div>
                </div>

                {(techData.title || techData.metaDescription) && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '16px',
                      borderRadius: '12px',
                      backgroundColor: '#020617',
                      border: '1px solid #1f2937',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '14px',
                        marginBottom: '8px',
                      }}
                    >
                      SEO‑мета
                    </h3>
                    {techData.title && (
                      <div
                        style={{
                          fontSize: '13px',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            color: '#9ca3af',
                          }}
                        >
                          Title:{' '}
                        </span>
                        <span>{techData.title}</span>
                      </div>
                    )}
                    {techData.metaDescription && (
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#9ca3af',
                        }}
                      >
                        <span
                          style={{
                            color: '#9ca3af',
                          }}
                        >
                          Description:{' '}
                        </span>
                        <span>{techData.metaDescription}</span>
                      </div>
                    )}
                  </div>
                )}

                {techData.error && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: '#f97316',
                      marginTop: '12px',
                    }}
                  >
                    Техническая ошибка при обращении к сайту: {techData.error}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RestaurantDetailPage;
