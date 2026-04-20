// ===== FILE: frontend/src/components/icons/IncognitoIcon.js =====
import React from 'react';

function IncognitoIcon({
  size = 32,
  showCircle = true,
  circleColor = '#ECEDEF',
  shapeColor = '#3A3A3C',
  style,
}) {
  const viewBox = showCircle ? '0 0 64 64' : '12 11 40 42';
  const hatLineStroke = showCircle ? 3.2 : 3.7;
  const glassesStroke = showCircle ? 3.1 : 3.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {showCircle && <circle cx="32" cy="32" r="26" fill={circleColor} />}

      <path
        d="M21.3 24.8h21.4l-3.3-10.1a2.55 2.55 0 0 0-2.9-1.62l-2.66.56a6.3 6.3 0 0 1-2.58 0l-2.66-.56a2.55 2.55 0 0 0-2.9 1.62l-3.4 10.1Z"
        fill={shapeColor}
      />

      <path
        d="M17.2 29.8h29.6"
        stroke={shapeColor}
        strokeWidth={hatLineStroke}
        strokeLinecap="round"
      />

      <circle
        cx="24"
        cy="40.7"
        r="6.05"
        stroke={shapeColor}
        strokeWidth={glassesStroke}
      />
      <circle
        cx="40"
        cy="40.7"
        r="6.05"
        stroke={shapeColor}
        strokeWidth={glassesStroke}
      />
      <path
        d="M30.7 40.7h2.6"
        stroke={shapeColor}
        strokeWidth={glassesStroke}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default React.memo(IncognitoIcon);
