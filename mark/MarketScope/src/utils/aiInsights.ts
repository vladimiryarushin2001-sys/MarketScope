import type { CompetitorData } from '../types';

export const generateOverviewInsights = (competitors: CompetitorData[], selectedCompetitor: string, timeRange: string) => {
  const mainCompetitor = competitors.find(c => c.id === selectedCompetitor) || competitors[0];
  const avgRating = competitors.reduce((sum, c) => sum + c.rating, 0) / competitors.length;
  
  return {
    insights: [
      `Средний рейтинг по рынку: ${avgRating.toFixed(1)}/5. ${mainCompetitor.rating > avgRating ? 'Ваша позиция выше среднего' : 'Есть потенциал для улучшения рейтинга'}`,
      `Доля рынка распределена неравномерно. ${competitors[0].name} лидирует с ${competitors[0].marketShare}%`,
      `За период ${timeRange} наблюдается рост вовлеченности пользователей на 8%`,
      'Основной рост происходит за счет цифровых каналов привлечения'
    ],
    strategy: [
      `Увеличить инвестиции в ${mainCompetitor.seoScore > 90 ? 'контент-маркетинг' : 'SEO-оптимизацию'} для улучшения видимости`,
      'Внедрить программу лояльности для увеличения повторных покупок',
      'Оптимизировать ценообразование на основе анализа конкурентов',
      'Улучшить мобильный пользовательский опыт для увеличения конверсии'
    ]
  };
};

export const generateTechnicalInsights = (competitors: CompetitorData[], selectedCompetitor: string) => {
  const current = competitors.find(c => c.id === selectedCompetitor) || competitors[0];
  const fastest = competitors.reduce((fastest, current) => 
    current.loadTime < fastest.loadTime ? current : fastest
  );
  
  return {
    insights: [
      `Скорость загрузки сайта: ${current.loadTime}сек. ${current.loadTime <= 2 ? 'Отличный показатель' : 'Требует оптимизации'}`,
      `Лучший показатель скорости у ${fastest.name}: ${fastest.loadTime}сек`,
      `SEO-оценка: ${current.seoScore}/100. ${current.seoScore > 85 ? 'Высокий уровень' : 'Есть возможности для улучшения'}`,
      'Мобильная адаптивность у всех конкурентов на высоком уровне'
    ],
    strategy: [
      `${current.loadTime > 2 ? 'Оптимизировать скорость загрузки до 2 секунд' : 'Поддерживать текущую скорость загрузки'}`,
      'Улучшить Core Web Vitals для лучшего ранжирования в поиске',
      'Внедрить Progressive Web App для мобильных пользователей',
      'Оптимизировать мета-теги и структуру данных для SEO'
    ]
  };
};

export const generateReviewInsights = (competitors: CompetitorData[], selectedCompetitor: string) => {
  const current = competitors.find(c => c.id === selectedCompetitor) || competitors[0];
  
  return {
    insights: [
      `Тональность отзывов: ${current.sentimentScore}% положительных`,
      `Количество отзывов: ${current.reviewCount.toLocaleString()}`,
      'Основные темы обсуждения: качество обслуживания и атмосфера',
      'Наибольшая критика касается ценовой политики'
    ],
    strategy: [
      'Внедрить систему управления отзывами в реальном времени',
      'Разработать программу ответов на негативные отзывы',
      'Стимулировать клиентов оставлять отзывы после посещения',
      'Провести анализ причин негативных отзывов и разработать план улучшений'
    ]
  };
};

export const generateFinancialInsights = (competitors: CompetitorData[], selectedCompetitor: string) => {
  const current = competitors.find(c => c.id === selectedCompetitor) || competitors[0];
  
  return {
    insights: [
      `Финансовая устойчивость: ${current.financialHealth}/100`,
      'Рентабельность бизнеса на уровне рынка',
      'Стабильный рост выручки в последнем периоде',
      'Низкая долговая нагрузка обеспечивает финансовую гибкость'
    ],
    strategy: [
      'Диверсифицировать источники доходов',
      'Оптимизировать операционные расходы без потери качества',
      'Рассмотреть возможность расширения в смежные сегменты',
      'Инвестировать в цифровую трансформацию бизнес-процессов'
    ]
  };
};

// Обновим функции, которые не принимали competitors
export const generateMarketingInsights = (competitors: CompetitorData[], selectedCompetitor: string) => {
  // Добавляем проверку на существование competitors
  if (!competitors || competitors.length === 0) {
    return {
      insights: [
        "Недостаточно данных для анализа маркетинговой стратегии",
        "Рекомендуется собрать больше информации о конкурентах"
      ],
      strategy: [
        "Соберите данные о маркетинговых каналах конкурентов",
        "Проанализируйте целевую аудиторию",
        "Изучите бюджетные распределения"
      ]
    };
  }

  // Находим данные выбранного конкурента с проверкой
  const competitorData = selectedCompetitor !== 'all' 
    ? competitors.find(c => c.id === selectedCompetitor)
    : null;

  // Безопасное получение данных
  const seoScore = competitorData?.seoScore || 0;
  const traffic = competitorData?.monthlyTraffic || 0;
  const name = competitorData?.name || 'выбранного конкурента';

  const insights = [];
  const strategy = [];

  // Анализ SEO (с проверкой на наличие данных)
  if (seoScore > 80) {
    insights.push(`${name} демонстрирует сильные SEO-показатели (${seoScore}/100), что указывает на эффективную стратегию органического роста`);
    strategy.push("Усилить инвестиции в контент-маркетинг и техническую SEO-оптимизацию");
  } else if (seoScore > 60) {
    insights.push(`${name} имеет средние SEO-показатели (${seoScore}/100), есть потенциал для улучшения`);
    strategy.push("Оптимизировать мета-теги и улучшить внутреннюю перелинковку");
  } else {
    insights.push(`${name} имеет слабые SEO-показатели (${seoScore}/100), что открывает возможности для обгона`);
    strategy.push("Разработать агрессивную SEO-стратегию с фокусом на низкочастотные запросы");
  }

  // Анализ трафика
  if (traffic > 50000) {
    insights.push(`Высокий месячный трафик (${traffic.toLocaleString()} посетителей) свидетельствует о сильном бренде`);
    strategy.push("Использовать ретаргетинг для увеличения конверсии существующего трафика");
  } else if (traffic > 20000) {
    insights.push(`Средний уровень трафика (${traffic.toLocaleString()} посетителей) позволяет масштабировать маркетинговые активности`);
    strategy.push("Диверсифицировать источники трафика через партнерский маркетинг");
  } else {
    insights.push(`Низкий уровень трафика (${traffic.toLocaleString()} посетителей) требует усиления маркетинговых активностей`);
    strategy.push("Запустить агрессивную кампанию по привлечению трафика через социальные сети");
  }

  // Общие рекомендации
  insights.push("Рекомендуется регулярный мониторинг эффективности маркетинговых каналов");
  strategy.push("Внедрить систему сквозной аналитики для точного измерения ROI");

  return { insights, strategy };
};

export const generatePricingInsights = (competitors: CompetitorData[], selectedCompetitor: string) => {
  const current = competitors.find(c => c.id === selectedCompetitor) || competitors[0];
  
  return {
    insights: [
      `Ценовой индекс: ${current.priceIndex} (средний по рынку: 100)`,
      'Наибольшая ценовая конкуренция в сегменте бизнес-ланчей',
      'Премиум-сегмент демонстрирует устойчивый рост',
      'Клиенты готовы платить за уникальный опыт и качество',
      `Текущая ценовая позиция: ${current.priceIndex < 100 ? 'ниже рынка' : current.priceIndex > 100 ? 'выше рынка' : 'на уровне рынка'}`
    ],
    strategy: [
      'Внедрить динамическое ценообразование для повышения маржи',
      'Разработать пакетные предложения для увеличения среднего чека',
      'Создать премиальную линейку с добавленной стоимостью',
      'Оптимизировать себестоимость без снижения качества',
      'Использовать психологию ценообразования (например, 299 вместо 300)'
    ]
  };
};

// Удалим неиспользуемую переменную allInsights и обновим generateFullStrategy
export const generateFullStrategy = (competitors: CompetitorData[], selectedCompetitor: string) => {
  const current = competitors.find(c => c.id === selectedCompetitor) || competitors[0];
  
  // Используем отдельные вызовы функций вместо allInsights
  const overview = generateOverviewInsights(competitors, selectedCompetitor, '90d');
  const technical = generateTechnicalInsights(competitors, selectedCompetitor);
  const review = generateReviewInsights(competitors, selectedCompetitor);
  const financial = generateFinancialInsights(competitors, selectedCompetitor);
  const marketing = generateMarketingInsights(competitors, selectedCompetitor);
  const pricing = generatePricingInsights(competitors, selectedCompetitor);

  return {
    executiveSummary: `Комплексная стратегия развития для ${current.name} на основе анализа ${competitors.length} ключевых конкурентов. Фокус на ${current.rating > 4.5 ? 'поддержании лидерства' : 'улучшении конкурентных позиций'}.`,
    keyOpportunities: [
      'Рост цифрового присутствия и онлайн-продаж',
      'Оптимизация операционной эффективности',
      'Улучшение клиентского опыта',
      'Расширение продуктовой линейки',
      'Повышение лояльности существующих клиентов'
    ],
    strategicInitiatives: [
      {
        area: 'Технологии и Digital',
        initiatives: [
          'Полная мобильная оптимизация платформы',
          'Внедрение AI-ассистента для клиентов',
          'Разработка собственного мобильного приложения',
          'Автоматизация процессов бронирования и заказов'
        ]
      },
      {
        area: 'Маркетинг и Продажи',
        initiatives: [
          'Запуск программы лояльности с геймификацией',
          'Развитие контент-маркетинга и блога',
          'Партнерства с локальными инфлюенсерами',
          'Внедрение CRM-системы для управления клиентами'
        ]
      },
      {
        area: 'Операции и Качество',
        initiatives: [
          'Стандартизация процессов обслуживания',
          'Внедрение системы управления качеством',
          'Оптимизация цепочки поставок',
          'Обучение персонала стандартам сервиса'
        ]
      }
    ],
    kpis: [
      'Увеличение NPS на 15 пунктов за 6 месяцев',
      'Рост онлайн-продаж на 25% в течение года',
      'Улучшение рейтинга до 4.7/5',
      'Снижение стоимости привлечения клиента на 20%',
      'Увеличение среднего чека на 15%'
    ],
    timeline: [
      { 
        phase: '1-3 месяца', 
        tasks: [
          'Аудит текущих процессов', 
          'Разработка MVP улучшений', 
          'Запуск пилотных проектов',
          'Обучение ключевого персонала'
        ] 
      },
      { 
        phase: '4-6 месяцев', 
        tasks: [
          'Масштабирование успешных инициатив', 
          'Обучение всего персонала', 
          'Оптимизация на основе данных',
          'Запуск программы лояльности'
        ] 
      },
      { 
        phase: '7-12 месяцев', 
        tasks: [
          'Полное внедрение стратегии', 
          'Мониторинг KPI', 
          'Корректировка плана',
          'Подготовка отчета об эффективности'
        ] 
      }
    ]
  };
};