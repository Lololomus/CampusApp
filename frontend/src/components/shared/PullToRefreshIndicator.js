// ===== FILE: PullToRefreshIndicator.js =====

import React from 'react';
import theme from '../../theme';

if (typeof document !== 'undefined' && !document.getElementById('ptr-animations')) {
  const s = document.createElement('style');
  s.id = 'ptr-animations';
  s.textContent = `
    @keyframes ptr-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(s);
}

const R = 11;
const CIRCUMFERENCE = 2 * Math.PI * R; // ~69.12

/**
 * Индикатор pull-to-refresh.
 * Занимает пространство между шапкой и контентом по мере вытягивания.
 * Контент (Feed/Market) синхронно сдвигается вниз на pullY.
 */
const PullToRefreshIndicator = ({ pullY, pullProgress, isRefreshing, snapping, text }) => {
  const TRANSITION = 'height 0.42s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.42s ease';

  // Дуга: растёт от 0 до 80% при вытягивании, фиксируется при спиннере
  const dashOffset = isRefreshing
    ? CIRCUMFERENCE * 0.22
    : CIRCUMFERENCE * (1 - pullProgress * 0.8);

  const isActive = isRefreshing || pullY > 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--screen-top-offset, 0px) + 160px)',
        left: 'var(--app-fixed-left, 0)',
        width: 'var(--app-fixed-width, 100%)',
        // Высота равна смещению контента — точно заполняет открывающееся пространство
        height: `${pullY}px`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 98,
        pointerEvents: 'none',
        transition: snapping ? TRANSITION : 'none',
      }}
    >
      {/* Контент индикатора: видим только когда пространство достаточно */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: isActive ? Math.min(pullProgress * 2, 1) : 0,
          transition: snapping ? 'opacity 0.3s ease' : 'none',
        }}
      >
        {/* SVG-спиннер / дуга */}
        <svg
          width={28}
          height={28}
          viewBox="0 0 26 26"
          style={{
            flexShrink: 0,
            animation: isRefreshing ? 'ptr-spin 0.72s linear infinite' : 'none',
          }}
        >
          <circle
            cx={13}
            cy={13}
            r={R}
            fill="none"
            stroke={isRefreshing ? theme.colors.premium.primary : 'rgba(255,255,255,0.5)'}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90, 13, 13)"
            style={{ transition: isRefreshing ? 'none' : 'stroke-dashoffset 0.08s linear, stroke 0.2s ease' }}
          />
        </svg>

        {/* Текст */}
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: 0.1,
            whiteSpace: 'nowrap',
            color: isRefreshing ? theme.colors.premium.primary : 'rgba(255,255,255,0.65)',
            transition: 'color 0.2s ease',
          }}
        >
          {isRefreshing ? text : 'Потяните ещё'}
        </span>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
