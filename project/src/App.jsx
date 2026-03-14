import { Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RestaurantDetailPage from './pages/RestaurantDetailPage.jsx';
function App() {
  return (
    <div>
      <nav
        style={{
          padding: '10px 16px',
          backgroundColor: '#020617',
          borderBottom: '1px solid #1f2937',
          display: 'flex',
          gap: '12px',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <Link
          to="/"
          style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: '14px' }}
        >
          Главная
        </Link>
        <Link
          to="/dashboard"
          style={{ color: '#e5e7eb', textDecoration: 'none', fontSize: '14px' }}
        >
          Дашборд
        </Link>
      </nav>

      <Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/restaurant/:name" element={<RestaurantDetailPage />} />
</Routes>
    </div>
  );
}

export default App;
