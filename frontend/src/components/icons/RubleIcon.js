// ===== FILE: frontend/src/components/icons/RubleIcon.js =====
import React from 'react';

function RubleIcon({ size = 16, color = 'currentColor', style }) {
  const fontSize = typeof size === 'number' ? Math.round(size * 1.2) : size;

  return (
    <span
      aria-hidden="true"
      style={{
        color,
        display: 'inline-block',
        flexShrink: 0,
        fontFamily: 'Arial, sans-serif',
        fontSize,
        fontWeight: 900,
        lineHeight: 1,
        transform: 'translateY(-0.02em)',
        verticalAlign: 'baseline',
        ...style,
      }}
    >
      ₽
    </span>
  );
}

export default React.memo(RubleIcon);
