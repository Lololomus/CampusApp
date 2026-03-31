// ===== FILE: shared/EdgeBlur.js =====

import React, { useEffect, useState } from 'react';
import { BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS } from '../../constants/layoutConstants';

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
// height — число (px) или CSS-строка (напр. 'var(--header-padding)')
function EdgeBlur({
  position = 'bottom',
  height = 100,
  zIndex = 50,
  visible = true,
  animateHeight = false,
  compensateKeyboard = false,
  suppressCompensationBodyClass = '',
}) {
  const isTop = position === 'top';
  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    if (isTop || !compensateKeyboard) return undefined;

    const vv = window.visualViewport;
    if (!vv) return undefined;

    const updateOffset = () => {
      const suppressClass = suppressCompensationBodyClass || BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS;
      if (suppressClass && document.body.classList.contains(suppressClass)) {
        setKeyboardOffset(0);
        return;
      }
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(keyboardHeight > 50 ? Math.ceil(keyboardHeight) : 0);
    };

    updateOffset();
    vv.addEventListener('resize', updateOffset);
    vv.addEventListener('scroll', updateOffset);

    return () => {
      vv.removeEventListener('resize', updateOffset);
      vv.removeEventListener('scroll', updateOffset);
    };
  }, [compensateKeyboard, isTop, suppressCompensationBodyClass]);

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

  // Растягиваем блюр за safe-area край (Dynamic Island сверху, home indicator снизу).
  // Используем те же переменные, что и AppHeader (--screen-top-offset), чтобы EdgeBlur
  // всегда совпадал с хедером даже если Telegram SDK сообщает safe-area больше, чем env().
  // Снизу --screen-bottom-offset не берём — там есть --dev-action-bar-height, нам не нужен.
  const safeAreaTop = 'var(--screen-top-offset, env(safe-area-inset-top, 0px))';
  const safeAreaBottom = 'max(env(safe-area-inset-bottom, 0px), var(--tg-safe-area-bottom, 0px), var(--tg-content-safe-area-bottom, 0px))';
  const safeAreaCompensation = isTop ? safeAreaTop : safeAreaBottom;
  const edgeAnchor = isTop
    ? { top: `calc(-1 * ${safeAreaTop})` }
    : { bottom: `calc(-1 * ${safeAreaBottom})` };

  // height-анимация только там, где height реально меняется (иначе браузер может анимировать при ремаунте)
  const transition = animateHeight
    ? 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease, transform 0.25s ease'
    : 'opacity 0.3s ease, transform 0.25s ease';
  const opacity = visible ? 1 : 0;
  const transform = !isTop && compensateKeyboard
    ? `translate3d(0, ${keyboardOffset}px, 0)`
    : 'translate3d(0, 0, 0)';

  const baseStyle = {
    position: 'fixed',
    left: 0,
    right: 0,
    height: `calc(${heightValue} + ${safeAreaCompensation})`,
    pointerEvents: 'none',
    transition,
    opacity,
    transform,
    willChange: 'transform, opacity',
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
