// ===== FILE: frontend/src/components/shared/EdgeSwipeBack.js =====
import React from 'react';
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack';

/**
 * Обёртка для iOS edge-swipe-back жеста.
 * Экран едет за пальцем при свайпе от левого края.
 * При достижении порога — анимированно улетает вправо и вызывает onBack().
 *
 * @param {function} onBack    — прямой unmount-коллбэк (НЕ handleBack с isExiting)
 * @param {boolean}  disabled  — отключить жест (e.g. когда открыт PhotoViewer)
 * @param {number}   zIndex    — z-index обёртки (передаётся от экрана)
 * @param {ReactNode} children — содержимое экрана
 */
function EdgeSwipeBack({ onBack, disabled = false, zIndex, children }) {
  const { wrapperRef, isDragging } = useEdgeSwipeBack({ onBack, disabled });

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        willChange: isDragging ? 'transform' : undefined,
      }}
    >
      {children}
    </div>
  );
}

export default EdgeSwipeBack;
