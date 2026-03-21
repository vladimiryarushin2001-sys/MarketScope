import React, { useState } from 'react';
import { Target, BarChart3, MessageSquare, Globe, CreditCard, ArrowRight, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type FormMode = 'register' | 'login';

const PreviewPage: React.FC = () => {
  const { signUpOrSignIn, signIn } = useAuth();
  const [mode, setMode] = useState<FormMode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Введите email');
      return;
    }
    if (!password || password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        const { error: err } = await signUpOrSignIn(email.trim(), password, name.trim() || undefined);
        if (err) {
          setError(err.message);
          return;
        }
        setSuccess('Регистрация прошла успешно. Если в настройках включено подтверждение email — проверьте почту. Иначе вы уже авторизованы.');
      } else {
        const { error: err } = await signIn(email.trim(), password);
        if (err) {
          setError(err.message);
          return;
        }
        // Успешный вход — onAuthStateChange обновит сессию, редирект в дашборд произойдёт автоматически
      }
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: BarChart3,
      title: 'Обзор и метрики',
      text: 'Сводка по конкурентам, рейтинги, доля рынка и ключевые показатели в одном месте.',
    },
    {
      icon: Globe,
      title: 'Технический анализ',
      text: 'SEO, скорость сайтов, мобильная версия и рекомендации по улучшению.',
    },
    {
      icon: MessageSquare,
      title: 'Анализ отзывов',
      text: 'Темы отзывов, тональность и выводы по сильным и слабым сторонам.',
    },
    {
      icon: CreditCard,
      title: 'Меню и цены',
      text: 'Сравнение меню, средний чек и ценовая политика конкурентов.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-slate-900">MarketScope</span>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            Анализ конкурентов HoReCa —{' '}
            <span className="text-blue-600">в одном сервисе</span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            Собираем данные по ресторанам и конкурентам: отзывы, меню, маркетинг и технические метрики.
            Принимайте решения на основе цифр, а не догадок.
          </p>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-2xl font-semibold text-slate-900 text-center mb-10">
            Что вы получите в MarketScope
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="flex gap-4 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-slate-600 text-sm">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA + Auth form */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="px-8 pt-8 pb-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white text-center">
              <h2 className="text-2xl font-bold">
                {mode === 'register' ? 'Начните бесплатно' : 'Вход в аккаунт'}
              </h2>
              <p className="mt-2 text-blue-100 text-sm">
                {mode === 'register'
                  ? 'Зарегистрируйтесь и получите доступ к дашборду аналитики'
                  : 'Введите email и пароль для входа'}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  {success}
                </div>
              )}
              {mode === 'register' && (
                <div>
                  <label htmlFor="preview-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Имя (необязательно)
                  </label>
                  <input
                    id="preview-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Иван Петров"
                  />
                </div>
              )}
              <div>
                <label htmlFor="preview-email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  id="preview-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label htmlFor="preview-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Пароль (не менее 6 символов) *
                </label>
                <input
                  id="preview-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? 'Загрузка...' : mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
                {!loading && (mode === 'register' ? <ArrowRight className="w-4 h-4" /> : <LogIn className="w-4 h-4" />)}
              </button>
              <p className="text-center text-sm text-slate-500 pt-2">
                {mode === 'register' ? (
                  <>
                    Уже есть аккаунт?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Войти
                    </button>
                  </>
                ) : (
                  <>
                    Нет аккаунта?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Зарегистрироваться
                    </button>
                  </>
                )}
              </p>
            </form>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 text-center">
          <p className="text-slate-500 text-sm">
            В Supabase Dashboard можно отключить подтверждение email (Authentication → Providers → Email: Confirm email), чтобы входить сразу после регистрации.
          </p>
        </section>
      </main>
    </div>
  );
};

export default PreviewPage;
