import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ul className="space-y-1 text-xs sm:text-sm text-gray-600">
          <li>Полное наименование: Индивидуальный Предприниматель Лихачев Денис Дмитриевич</li>
          <li>ОГРН: 326774600255015</li>
          <li>ИНН: 183114922294</li>
          <li>Юридический адрес: г. Москва Ул. Широкая д. 25/24</li>
          <li>
            Email:{' '}
            <a className="text-blue-600 hover:underline" href="mailto:marketscope@mail.ru">
              marketscope@mail.ru
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
};

