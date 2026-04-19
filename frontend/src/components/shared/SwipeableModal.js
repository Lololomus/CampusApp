// ===== 📄 ФАЙЛ: frontend/src/components/shared/SwipeableModal.js =====
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSwipe } from '../../hooks/useSwipe';
import { useEdgeSwipeBack } from '../../hooks/useEdgeSwipeBack';
import theme from '../../theme';
import { modalBoundaryProps, modalTouchBoundaryHandlers } from '../../utils/modalEventBoundary';

// Счётчик открытых модалок — чтобы не снимать лок раньше времени
let openModalCount = 0;
// Сохраняем исходное значение overflow до блокировки (фикс edge case #3)
let savedBodyOverflow = '';

// Фикс edge case #4: при HMR сбрасываем состояние модуля
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (openModalCount > 0) {
      document.body.style.overflow = savedBodyOverflow;
    }
    openModalCount = 0;
  });
}

// Единая ручка свайпа — iOS/Telegram стиль. Переиспользуется во всех bottom-sheet модалках.
// gap — отступ от ручки до первого элемента контента (единственное место управления отступом сверху).
const DRAG_HANDLE_VISUAL_HEIGHT = 4;
const DRAG_HANDLE_PADDING_TOP = 8;

export const DragHandle = ({ handlers = {}, gap = 12, handleRef = null }) => (
  <div
    {...(!handleRef ? handlers : {})}
    style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      paddingTop: DRAG_HANDLE_PADDING_TOP,
      paddingBottom: gap,
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      cursor: 'grab',
      flexShrink: 0,
    }}
  >
    <div
      ref={handleRef}
      {...(handleRef ? handlers : {})}
      style={{
        width: 36,
        height: DRAG_HANDLE_VISUAL_HEIGHT,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 999,
        flexShrink: 0,
      }}
    />
  </div>
);

const SwipeableModal = ({
  isOpen,
  onClose,
  children,
  title,
  footer,
  zIndex = 9999,
  showHeaderDivider = true,
  edgeSwipeBack = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef(null);
  const dragHandleRef = useRef(null);
  const { wrapperRef: edgeSwipeWrapperRef, isDragging: isEdgeDragging } = useEdgeSwipeBack({
    onBack: onClose,
    disabled: !edgeSwipeBack || !isOpen,
    allowModalBoundary: true,
  });

  // Блокировка скролла фона
  useEffect(() => {
    if (isOpen) {
      openModalCount++;
      if (openModalCount === 1) {
        savedBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
    }
    return () => {
      if (isOpen) {
        openModalCount--;
        if (openModalCount === 0) {
          document.body.style.overflow = savedBodyOverflow;
        }
      }
    };
  }, [isOpen]);

  useEffect(() => {
    let timer;
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      timer = setTimeout(() => setIsVisible(false), 300);
    }
    return () => clearTimeout(timer);
  }, [isOpen]);

  const swipeHandlers = useSwipe({
    elementRef: contentRef,
    activationRef: dragHandleRef,
    onSwipeDown: onClose,
    isModal: true,
    threshold: 120
  });

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={edgeSwipeWrapperRef}
      {...modalBoundaryProps}
      {...(edgeSwipeBack ? { 'data-edge-swipe-wrapper': '' } : {})}
      {...modalTouchBoundaryHandlers}
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 'var(--app-fixed-left)',
        width: 'var(--app-fixed-width)',
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.3s ease',
        zIndex,
        willChange: isEdgeDragging ? 'transform' : undefined,
        touchAction: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: '100%',
          maxWidth: 'none',
          boxSizing: 'border-box',
          backgroundColor: '#151516',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          boxShadow: '0 -20px 60px rgba(0,0,0,0.65)',
          transform: isAnimating ? 'translate3d(0, 0, 0)' : 'translate3d(0, 100%, 0)',
          transition: isAnimating
            ? 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)'
            : 'transform 0.25s ease-in',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          perspective: 1000,
        }}
      >
        <DragHandle handlers={swipeHandlers} handleRef={dragHandleRef} gap={title ? 0 : 12} />

        {/* Header */}
        {title && (
          <div style={{
            padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
            borderBottom: showHeaderDivider ? '1px solid rgba(255,255,255,0.08)' : 'none',
            flexShrink: 0,
          }}>
            <h3 style={{
              margin: 0,
              textAlign: 'center',
              color: '#FFFFFF',
              fontSize: theme.fontSize.lg,
              fontWeight: theme.fontWeight.semibold,
            }}>
              {title}
            </h3>
          </div>
        )}

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: footer
              ? `0 ${theme.spacing.xl}px ${theme.spacing.xl}px`
              : `0 ${theme.spacing.xl}px calc(${theme.spacing.xl}px + var(--screen-bottom-offset))`,
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>

        {/* Footer — вне скролла, всегда приклеен к низу */}
        {footer && (
          <div style={{
            flexShrink: 0,
            padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
            paddingBottom: `calc(${theme.spacing.lg}px + var(--screen-bottom-offset))`,
            backgroundColor: '#151516',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SwipeableModal;
