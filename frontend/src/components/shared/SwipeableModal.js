// ===== 📄 ФАЙЛ: frontend/src/components/shared/SwipeableModal.js =====
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSwipe } from '../../hooks/useSwipe';
import theme from '../../theme';

const SwipeableModal = ({ isOpen, onClose, children, title }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef(null);

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
    onSwipeDown: onClose,
    isModal: true,
    threshold: 120
  });

  if (!isVisible) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 0.3s ease',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: '100%',
          maxWidth: '600px',
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
        {/* Drag Handle */}
        <div
          {...swipeHandlers}
          style={{
            height: 48,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            cursor: 'grab',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 64,
              height: 6,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 999,
              flexShrink: 0,
            }}
          />
        </div>
        
        {/* Header */}
        {title && (
          <div style={{
            padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
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
            padding: `${theme.spacing.md}px ${theme.spacing.xl}px calc(${theme.spacing.xl}px + var(--screen-bottom-offset))`,
          }}
          onTouchStart={(e) => e.stopPropagation()} 
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SwipeableModal;
