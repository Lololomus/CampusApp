// ===== FILE: frontend/src/components/shared/DropdownMenu.js =====
import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import EdgeSwipeBack from './EdgeSwipeBack';


const SAFE_MARGIN = 8;


export const ACTION_COLORS = {
  edit: theme.colors.text,
  delete: '#FF453A',
  share: theme.colors.text,
  default: theme.colors.text,
};


function DropdownMenu({ 
  isOpen, 
  onClose, 
  items, 
  anchorRef,
  header, 
  closeOnScroll = true,
  variant = 'default'
}) {
  const menuRef = useRef(null);
  const [state, setState] = useState({ 
    mounted: false, 
    position: null,
    transformOrigin: 'top right' 
  });
  
  const [activeIndex, setActiveIndex] = useState(null);
  const activeIndexRef = useRef(null);
  const isMouseDownRef = useRef(false);
  const isTouchSelectingRef = useRef(false);
  const touchMovedRef = useRef(false);
  const touchIdentifierRef = useRef(null);
  const suppressClickUntilRef = useRef(0);


  // ===== ПОЗИЦИОНИРОВАНИЕ =====
  const calculatePosition = useCallback(() => {
    if (!menuRef.current || !anchorRef?.current) return null;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const menuHeight = menuRef.current.offsetHeight;
    const menuWidth = menuRef.current.offsetWidth;

    let finalTop;
    let finalLeft;
    let finalRight;
    let originY;
    let originX;

    const spaceBelow = viewportHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    if (spaceBelow < menuHeight + SAFE_MARGIN && spaceAbove > menuHeight + SAFE_MARGIN) {
      finalTop = anchorRect.top - menuHeight - SAFE_MARGIN;
      originY = 'bottom';
    } else {
      finalTop = anchorRect.bottom + SAFE_MARGIN;
      originY = 'top';
    }

    if (anchorRect.right - menuWidth < SAFE_MARGIN) {
      finalLeft = anchorRect.left;
      finalRight = 'auto';
      originX = 'left';
    } else {
      finalRight = viewportWidth - anchorRect.right;
      finalLeft = 'auto';
      originX = 'right';
    }

    return {
      position: {
        top: finalTop,
        left: finalLeft,
        right: finalRight,
      },
      transformOrigin: `${originY} ${originX}`
    };
  }, [anchorRef]);


  // ===== ОБЩАЯ ЛОГИКА ПОИСКА ЭЛЕМЕНТА =====
  const updateSelection = useCallback((clientX, clientY) => {
    const target = document.elementFromPoint(clientX, clientY);
    
    if (target) {
      const btn = target.closest('button[role="menuitem"]');
      if (btn) {
        const idx = Number(btn.dataset.index);
        if (!isNaN(idx) && idx !== activeIndexRef.current) {
          const item = items[idx];
          if (item && !item.divider && !item.disabled) {
            if (hapticFeedback) hapticFeedback('selection');
            activeIndexRef.current = idx;
            setActiveIndex(idx);
            return;
          }
        }
        if (!isNaN(idx) && idx === activeIndexRef.current) return;
      }
    }
    activeIndexRef.current = null;
    setActiveIndex(null);
  }, [items]);


  const commitSelection = useCallback(() => {
    const selectedIndex = activeIndexRef.current;
    if (selectedIndex !== null && items[selectedIndex]) {
      hapticFeedback('light');
      items[selectedIndex].onClick();
      activeIndexRef.current = null;
      setActiveIndex(null);
      onClose();
    }
    isMouseDownRef.current = false;
  }, [items, onClose]);


  const resetTouchSelection = useCallback(() => {
    isTouchSelectingRef.current = false;
    touchMovedRef.current = false;
    touchIdentifierRef.current = null;
  }, []);


  const getTrackedTouch = useCallback((touchList) => {
    const touchIdentifier = touchIdentifierRef.current;
    if (touchIdentifier == null) return touchList[0] || null;
    for (const touch of touchList) {
      if (touch.identifier === touchIdentifier) return touch;
    }
    return null;
  }, []);


  // ===== TOUCH EVENTS (MOBILE) =====
  const handleTouchStart = (e) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    isTouchSelectingRef.current = true;
    touchMovedRef.current = false;
    touchIdentifierRef.current = touch.identifier;
    updateSelection(touch.clientX, touch.clientY);
  };


  // ===== MOUSE EVENTS (PC DRAG) =====
  const handleMouseDown = () => {
    isMouseDownRef.current = true;
  };


  const handleMouseMove = (e) => {
    if (e.buttons === 1 || isMouseDownRef.current) {
      updateSelection(e.clientX, e.clientY);
    }
  };


  const handleMouseUp = () => {
    if (isMouseDownRef.current || activeIndex !== null) {
      commitSelection();
    }
    isMouseDownRef.current = false;
  };


  // ===== LIFECYCLE =====
  useLayoutEffect(() => {
    if (isOpen && anchorRef?.current) {
      setState(prev => ({ ...prev, mounted: false, position: null }));
      requestAnimationFrame(() => {
        const result = calculatePosition();
        if (result) setState({ mounted: true, ...result });
      });
    } else {
      setState(prev => ({ ...prev, mounted: false }));
      activeIndexRef.current = null;
      setActiveIndex(null);
      isMouseDownRef.current = false;
      resetTouchSelection();
    }
  }, [isOpen, anchorRef, calculatePosition, resetTouchSelection]);


  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => {
      if (closeOnScroll) onClose();
      else {
        const result = calculatePosition();
        if (result) setState(prev => ({ ...prev, ...result }));
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, onClose, closeOnScroll, calculatePosition]);


  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);


  useEffect(() => {
    if (isOpen) {
      // ❌ НЕ блокируем скролл (конфликт с SwipeableModal)
      // document.body.style.overflow = 'hidden';
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        // document.body.style.overflow = '';
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isOpen]);


  useEffect(() => {
    if (!isOpen) return undefined;

    const handleGlobalTouchMove = (e) => {
      if (!isTouchSelectingRef.current) return;
      const touch = getTrackedTouch(e.touches);
      if (!touch) return;
      touchMovedRef.current = true;
      if (e.cancelable) e.preventDefault();
      updateSelection(touch.clientX, touch.clientY);
    };

    const finishTouchSelection = (e, shouldCommit) => {
      const touch = getTrackedTouch(e.changedTouches);
      if (!touch) {
        activeIndexRef.current = null;
        setActiveIndex(null);
        resetTouchSelection();
        return;
      }

      if (shouldCommit) {
        suppressClickUntilRef.current = Date.now() + 400;
        if (e.cancelable) e.preventDefault();
        commitSelection();
      } else {
        activeIndexRef.current = null;
        setActiveIndex(null);
      }

      resetTouchSelection();
    };

    const handleGlobalTouchEnd = (e) => {
      if (!isTouchSelectingRef.current) return;
      finishTouchSelection(e, activeIndexRef.current !== null);
    };

    const handleGlobalTouchCancel = (e) => {
      if (!isTouchSelectingRef.current) return;
      finishTouchSelection(e, false);
    };

    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', handleGlobalTouchEnd, { passive: false, capture: true });
    document.addEventListener('touchcancel', handleGlobalTouchCancel, { passive: false, capture: true });

    return () => {
      document.removeEventListener('touchmove', handleGlobalTouchMove, true);
      document.removeEventListener('touchend', handleGlobalTouchEnd, true);
      document.removeEventListener('touchcancel', handleGlobalTouchCancel, true);
    };
  }, [isOpen, getTrackedTouch, updateSelection, commitSelection, resetTouchSelection]);


  if (!isOpen) return null;


  const pos = state.position || { top: 0, left: 'auto', right: 'auto' };
  const variantStyles = DROPDOWN_VARIANTS[variant] || DROPDOWN_VARIANTS.default;


  const dropdownContent = (
    <EdgeSwipeBack onBack={onClose} zIndex={10000}>
      <div 
        style={{
          ...styles.backdrop,
          opacity: state.mounted ? 1 : 0,
          pointerEvents: state.mounted ? 'auto' : 'none',
        }}
        onClick={(e) => {
          e.stopPropagation(); // ✅ Останавливаем всплытие
          onClose();
        }}
        onMouseDown={(e) => { 
          e.stopPropagation(); // ✅ Останавливаем всплытие
          isMouseDownRef.current = true; 
        }}
        role="presentation"
      />
      
      <div 
        ref={menuRef}
        role="menu"
        aria-label="Dropdown menu"
        onTouchStart={handleTouchStart}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{
          ...styles.dropdown,
          ...variantStyles.dropdown,
          visibility: state.position ? 'visible' : 'hidden', 
          opacity: state.mounted ? 1 : 0,
          
          top: pos.top,
          left: pos.left,
          right: pos.right,
          
          transformOrigin: state.transformOrigin,
          transform: state.mounted 
            ? 'scale(1) translateY(0)' 
            : 'scale(0.92) translateY(-10px)',
        }}
        onClick={(e) => e.stopPropagation()} // ✅ Останавливаем всплытие
      >
        {header && (
          <div style={{ marginBottom: 4 }}>
            {header}
            {items.length > 0 && <div style={{ ...styles.divider, ...variantStyles.divider }} />}
          </div>
        )}

        {items.map((item, index) => {
          if (item.divider) {
            return <div key={`divider-${index}`} style={{ ...styles.divider, ...variantStyles.divider }} role="separator" />;
          }
          
          return (
            <MenuItem 
              key={index}
              dataIndex={index}
              icon={item.icon}
              label={item.label}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              actionType={item.actionType}
              disabled={item.disabled}
              isActive={activeIndex === index}
              suppressClickUntilRef={suppressClickUntilRef}
              variantStyles={variantStyles}
            />
          );
        })}
      </div>
    </EdgeSwipeBack>
  );


  return createPortal(dropdownContent, document.body);
}


function MenuItem({ 
  icon, 
  label, 
  onClick, 
  actionType = 'default', 
  disabled, 
  dataIndex,
  isActive,
  suppressClickUntilRef,
  variantStyles
}) {
  const [isPressed, setIsPressed] = useState(false);
  const accentColor = ACTION_COLORS[actionType] || ACTION_COLORS.default;

  const isHighlighted = isPressed || isActive;

  const handleClick = (e) => {
    if (disabled) return;
    if (suppressClickUntilRef?.current > Date.now()) return;
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      role="menuitem"
      data-index={dataIndex}
      disabled={disabled}
      style={{
        ...styles.menuItem,
        ...variantStyles.menuItem,
        color: disabled ? theme.colors.textDisabled : accentColor,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: isHighlighted ? 'rgba(255,255,255,0.08)' : 'transparent',
        transform: isHighlighted ? 'scale(0.98)' : 'scale(1)',
      }}
      onClick={handleClick}
      onMouseEnter={() => !disabled && setIsPressed(true)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <span style={{ ...styles.menuIcon, ...variantStyles.menuIcon, color: accentColor }}>
        {icon}
      </span>
      <span style={styles.menuLabel}>{label}</span>
    </button>
  );
}


const styles = {
  backdrop: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 10000,
    transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  dropdown: {
    position: 'fixed', 
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.xl,
    padding: '8px',
    boxShadow: `
      0 20px 60px rgba(0, 0, 0, 0.4),
      0 0 1px rgba(255, 255, 255, 0.1) inset
    `,
    zIndex: 10001, // ✅ УВЕЛИЧЕНО: было 9999, теперь выше backdrop (10000)
    minWidth: 220,
    maxWidth: 300,
    willChange: 'transform, opacity',
    transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  
  menuItem: {
    position: 'relative',
    width: '100%',
    minHeight: 44,
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    outline: 'none',
    marginBottom: 2,
    overflow: 'hidden',
  },
  
  menuIcon: {
    fontSize: 22,
    width: 26,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  
  menuLabel: {
    flex: 1,
    whiteSpace: 'nowrap',
    letterSpacing: '-0.02em',
    lineHeight: 1.3,
  },
  
  divider: {
    height: 1,
    background: `linear-gradient(90deg, 
      transparent, 
      ${theme.colors.border} 10%, 
      ${theme.colors.border} 90%, 
      transparent
    )`,
    margin: '8px 8px',
    opacity: 0.5,
  },
};

const DROPDOWN_VARIANTS = {
  default: {
    dropdown: {},
    menuItem: {},
    menuIcon: {},
    divider: {},
  },
  premium: {
    dropdown: {
      background: '#1C1C1E',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 12,
      padding: 4,
      minWidth: 160,
      maxWidth: 220,
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
    },
    menuItem: {
      minHeight: 40,
      borderRadius: 8,
      fontSize: 14,
      gap: 8,
      padding: '10px 12px',
      marginBottom: 0,
    },
    menuIcon: {
      fontSize: 16,
      width: 18,
      height: 18,
    },
    divider: {
      margin: '4px 6px',
      opacity: 0.35,
    },
  },
};


const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes ripple {
    to {
      transform: scale(2.5);
      opacity: 0;
    }
  }
`;
document.head.appendChild(styleSheet);


export default DropdownMenu;
