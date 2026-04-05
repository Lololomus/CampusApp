// ===== [LEGACY] EdgeBlur — компонент отключён в Feed. Используется в Market/Profile/PostDetail. Не удалять. =====
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
}) {
  const isTop = position === 'top';
  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (isTop) return undefined;
    const apply = () => {
      setHidden(document.body.classList.contains(BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS));
    };
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [isTop]);

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
    ? 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease, transform 0.25s ease'
    : 'opacity 0.2s ease, transform 0.25s ease';
  const opacity = (visible && !hidden) ? 1 : 0;
  const transform = (!isTop && hidden)
    ? 'translate3d(0, 120px, 0)'
    : 'translate3d(0, 0, 0)';

  const baseStyle = {
    position: 'fixed',
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
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
