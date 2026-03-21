import { Link } from 'react-router-dom';

function HomePage() {
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
          maxWidth: '600px',
          margin: '0 auto',
        }}
      >
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px' }}>
          MarketScope
        </h1>

        <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px' }}>
          Страница ввода запроса. Здесь пользователь выбирает формат и параметры,
          а потом переходит к дашборду с анализом конкурентов.
        </p>

        <div
          style={{
            padding: '20px',
            borderRadius: '16px',
            backgroundColor: '#020617',
            border: '1px solid #1f2937',
            marginBottom: '24px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              marginBottom: '8px',
              color: '#9ca3af',
            }}
          >
            Запрос (пока заглушка)
          </label>
          <input
            type="text"
            placeholder="Например: премиальные русские рестораны в Москве"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #1f2937',
              backgroundColor: '#020617',
              color: '#e5e7eb',
              fontSize: '13px',
            }}
          />
        </div>

        <Link
          to="/dashboard"
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            borderRadius: '999px',
            backgroundColor: '#2563eb',
            color: '#e5e7eb',
            textDecoration: 'none',
            fontSize: '14px',
          }}
        >
          Перейти к дашборду (демо)
        </Link>
      </div>
    </div>
  );
}

export default HomePage;
