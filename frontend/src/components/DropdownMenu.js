// ===== 📄 ФАЙЛ: frontend/src/components/DropdownMenu.js =====
import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import theme from '../theme';
import { hapticFeedback } from '../utils/telegram';


const SAFE_MARGIN = 8;


export const ACTION_COLORS = {
  edit: '#10b981',
  copy: '#8b5cf6',
  delete: '#ef4444',
  report: '#f59e0b',
  share: '#3b82f6',
  default: theme.colors.text,
};


function DropdownMenu({ 
  isOpen, 
  onClose, 
  items, 
  anchorRef,
  header, 
  closeOnScroll = true
}) {
  const menuRef = useRef(null);
  const [state, setState] = useState({ 
    mounted: false, 
    position: null,
    transformOrigin: 'top right' 
  });
  
  const [activeIndex, setActiveIndex] = useState(null);
  const isMouseDownRef = useRef(false);


  // ===== ПОЗИЦИОНИРОВАНИЕ =====
  const calculatePosition = useCallback(() => {
    if (!menuRef.current || !anchorRef?.current) return null;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const menuHeight = menuRef.current.offsetHeight;
    const menuWidth = menuRef.current.offsetWidth;

    let finalTop = 0;
    let finalLeft = 'auto';
    let finalRight = 'auto';
    let originY = 'top';
    let originX = 'right';

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
  const updateSelection = (clientX, clientY) => {
    const target = document.elementFromPoint(clientX, clientY);
    
    if (target) {
      const btn = target.closest('button[role="menuitem"]');
      if (btn) {
        const idx = Number(btn.dataset.index);
        if (!isNaN(idx) && idx !== activeIndex) {
          const item = items[idx];
          if (item && !item.divider && !item.disabled) {
            if (hapticFeedback) hapticFeedback('selection');
            setActiveIndex(idx);
            return;
          }
        }
        if (!isNaN(idx) && idx === activeIndex) return;
      }
    }
    setActiveIndex(null);
  };


  const commitSelection = () => {
    if (activeIndex !== null && items[activeIndex]) {
      hapticFeedback('light');
      items[activeIndex].onClick();
      setActiveIndex(null);
      onClose();
    }
    isMouseDownRef.current = false;
  };


  // ===== TOUCH EVENTS (MOBILE) =====
  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    updateSelection(touch.clientX, touch.clientY);
  };


  const handleTouchEnd = (e) => {
    commitSelection();
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
      setActiveIndex(null);
      isMouseDownRef.current = false;
    }
  }, [isOpen, anchorRef, calculatePosition]);


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


  if (!isOpen) return null;


  const pos = state.position || { top: 0, left: 'auto', right: 'auto' };


  const dropdownContent = (
    <>
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
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        style={{
          ...styles.dropdown,
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
            <div style={styles.divider} />
          </div>
        )}

        {items.map((item, index) => {
          if (item.divider) {
            return <div key={`divider-${index}`} style={styles.divider} role="separator" />;
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
            />
          );
        })}
      </div>
    </>
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
  isActive 
}) {
  const [isPressed, setIsPressed] = useState(false);
  const accentColor = ACTION_COLORS[actionType] || ACTION_COLORS.default;

  const isHighlighted = isPressed || isActive;

  const handleClick = (e) => {
    if (disabled) return;
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
        borderLeft: `4px solid ${accentColor}`,
        paddingTop: '14px',
        paddingRight: '16px',
        paddingBottom: '14px',
        paddingLeft: '12px',
        color: disabled 
          ? theme.colors.textDisabled 
          : theme.colors.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: isHighlighted 
          ? `linear-gradient(90deg, ${accentColor}18 0%, transparent 100%)`
          : 'transparent',
        boxShadow: isHighlighted 
          ? `0 0 0 3px ${accentColor}40, 0 0 24px ${accentColor}50`
          : 'none',
        transform: isHighlighted ? 'scale(0.98)' : 'scale(1)',
      }}
      onClick={handleClick}
      onMouseEnter={() => !disabled && setIsPressed(true)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => !disabled && setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
    >
      <span 
        style={{
          ...styles.menuIcon,
          color: accentColor,
          transform: isHighlighted ? 'scale(1.15)' : 'scale(1)',
          transition: 'all 0.2s ease',
        }}
      >
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    zIndex: 10000, // ✅ УВЕЛИЧЕНО: было 9998, теперь выше SwipeableModal (9999)
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
    minHeight: 52,
    background: 'transparent',
    border: 'none',
    borderRadius: theme.radius.lg,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    outline: 'none',
    marginBottom: 4,
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