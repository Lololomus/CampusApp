// ===== FILE: shared/EdgeBlur.js =====

import React from 'react';

/**
 * EdgeBlur — «Liquid Glass» размытый градиент на верхнем или нижнем крае экрана.
 * Два слоя: blur + тёмный оверлей.
 *
 * @param {'top'|'bottom'} position — сторона экрана
 * @param {number} height        — высота зоны блюра (px)
 * @param {number} zIndex        — базовый z-index (слои: zIndex, zIndex+1)
 * @param {boolean} visible      — управляет opacity с плавным переходом
 * @param {boolean} animateHeight — анимировать изменение height (только для верхнего блюра с меняющейся шапкой)
 */
function EdgeBlur({ position = 'bottom', height = 100, zIndex = 50, visible = true, animateHeight = false }) {
  const isTop = position === 'top';

  // Маска: плавное затухание от края к прозрачному концу
  // — сверху: плотный старт для стекла (60% solid)
  // — снизу: чистый плавный fade (нет solid-участка, меньше артефактов)
  const maskImage = isTop
    ? 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
    : 'linear-gradient(to top, black 0%, transparent 100%)';

  // Тёмный оверлей:
  // — сверху: насыщенный (нужен для читаемости заголовков)
  // — снизу: лёгкий (только фейд контента, не должен светиться над пустым фоном)
  const overlayGradient = isTop
    ? 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 55%, transparent 100%)'
    : 'linear-gradient(to top, rgba(0,0,0,0.30) 0%, transparent 100%)';

  const edgeAnchor = isTop ? { top: 0 } : { bottom: 0 };

  // height-анимация только там, где height реально меняется (иначе браузер может анимировать при ремаунте)
  const transition = animateHeight
    ? 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease'
    : 'opacity 0.3s ease';
  const opacity = visible ? 1 : 0;

  const baseStyle = {
    position: 'fixed',
    left: 0,
    right: 0,
    height,
    pointerEvents: 'none',
    transition,
    opacity,
    ...edgeAnchor,
  };

  return (
    <>
      {/* Слой 1: blur + saturate + brightness */}
      <div
        style={{
          ...baseStyle,
          backdropFilter: 'blur(8px) saturate(130%)',
          WebkitBackdropFilter: 'blur(8px) saturate(130%)',
          maskImage,
          WebkitMaskImage: maskImage,
          zIndex,
        }}
      />

      {/* Слой 2: тёмный градиентный оверлей */}
      <div
        style={{
          ...baseStyle,
          background: overlayGradient,
          maskImage,
          WebkitMaskImage: maskImage,
          zIndex: zIndex + 1,
        }}
      />
    </>
  );
}

export default EdgeBlur;
