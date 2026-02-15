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
        ...theme.modals.backdrop,
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
        {...swipeHandlers}
        style={{
          width: '100%',
          maxWidth: '600px',
          backgroundColor: theme.colors.bg,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
          transform: isAnimating ? 'translate3d(0, 0, 0)' : 'translate3d(0, 100%, 0)', // ✅ translate3d
          transition: isAnimating 
            ? 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 0.2s ease-in',
          touchAction: 'none',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh',
          // ✅ ANTI-BLUR FIXES
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          perspective: 1000,
        }}
      >
        {/* Drag Handle */}
        <div style={{
          width: 40,
          height: 4,
          backgroundColor: theme.colors.border,
          borderRadius: 2,
          margin: '12px auto 0 auto',
          flexShrink: 0,
        }} />
        
        {/* Header */}
        {title && (
          <div style={{
            padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
            borderBottom: `1px solid ${theme.colors.border}`,
            flexShrink: 0,
          }}>
            <h3 style={{ 
              margin: 0,
              textAlign: 'center',
              color: theme.colors.text,
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
            padding: `${theme.spacing.md}px ${theme.spacing.xl}px ${theme.spacing.xl}px`,
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