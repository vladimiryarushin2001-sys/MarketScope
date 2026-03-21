import React from 'react';
import { Link } from 'react-router-dom';

function RestaurantCard({ restaurant }) {
  const { name, type, cuisine, averageCheck, address, description } = restaurant;

  return (
    <Link
      to={`/restaurant/${encodeURIComponent(name)}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="restaurant-card">
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            marginBottom: '4px',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            marginBottom: '6px',
          }}
        >
          {type}
        </div>
        <div
          style={{
            fontSize: '13px',
            marginBottom: '4px',
          }}
        >
          Кухня: {cuisine}
        </div>
        <div
          style={{
            fontSize: '13px',
            marginBottom: '4px',
          }}
        >
          Средний чек: {averageCheck} ₽
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            marginBottom: '4px',
          }}
        >
          {address}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          {description}
        </div>
      </div>
    </Link>
  );
}

export default RestaurantCard;
