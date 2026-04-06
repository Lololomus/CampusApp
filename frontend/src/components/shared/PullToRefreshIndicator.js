// ===== FILE: PullToRefreshIndicator.js =====

import React from 'react';
import theme from '../../theme';

// Инжектируем CSS-анимацию один раз
if (typeof document !== 'undefined' && !document.getElementById('ptr-animations')) {
  const s = document.createElement('style');
  s.id = 'ptr-animations';
  s.textContent = `
    @keyframes ptr-spin {
      from { transform: rotate(-90deg); }
      to   { transform: rotate(270deg); }
    }
  `;
  document.head.appendChild(s);
}

const R = 10; // радиус дуги SVG
const CIRCUMFERENCE = 2 * Math.PI * R; // ~62.83

/**
 * Индикатор pull-to-refresh.
 * Позиционирован fixed у нижней границы шапки.
 * Появляется из-под шапки по мере вытягивания.
 */
const PullToRefreshIndicator = ({ pullProgress, isRefreshing, snapping, text, DISPLAY_MAX = 44 }) => {
  const translateY = -DISPLAY_MAX + pullProgress * DISPLAY_MAX;

  // Дуга растёт от 0 до 85% окружности по мере вытягивания
  const dashOffset = isRefreshing
    ? CIRCUMFERENCE * 0.25                          // фиксированная дуга при спиннере
    : CIRCUMFERENCE * (1 - pullProgress * 0.85);    // растущая дуга при вытягивании

  const accentColor = theme.colors.premium.primary;
  const idleColor = 'rgba(255,255,255,0.55)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--screen-top-offset, 0px) + 160px)',
        left: 'var(--app-fixed-left, 0)',
        width: 'var(--app-fixed-width, 100%)',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
        opacity: pullProgress,
        transform: `translateY(${translateY}px)`,
        transition: snapping
          ? 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.38s ease'
          : 'none',
        willChange: 'transform, opacity',
      }}
    >
      {/* Пилюля */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(24, 24, 26, 0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderRadius: 24,
        padding: '7px 16px 7px 11px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 6px 24px rgba(0,0,0,0.55)',
      }}>

        {/* SVG-дуга / спиннер */}
        <svg
          width={22}
          height={22}
          viewBox="0 0 24 24"
          style={{
            flexShrink: 0,
            animation: isRefreshing ? 'ptr-spin 0.72s linear infinite' : 'none',
            // В режиме вытягивания поворачиваем дугу вместе с прогрессом
            transform: isRefreshing ? undefined : `rotate(${pullProgress * 180 - 90}deg)`,
            transformOrigin: '50% 50%',
          }}
        >
          <circle
            cx={12}
            cy={12}
            r={R}
            fill="none"
            stroke={isRefreshing ? accentColor : idleColor}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            // Базовая точка начала дуги — 12 часов
            transform="rotate(-90, 12, 12)"
            style={{ transition: isRefreshing ? 'none' : 'stroke 0.2s ease' }}
          />
        </svg>

        {/* Текст */}
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.1,
          whiteSpace: 'nowrap',
          color: isRefreshing ? accentColor : idleColor,
          transition: 'color 0.2s ease',
        }}>
          {isRefreshing ? text : 'Потяните ещё'}
        </span>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
