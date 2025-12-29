// ===== 📄 ФАЙЛ: src/components/DropdownMenu.js =====

import React, { useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import theme from '../theme';

const SAFE_MARGIN = 8; // Отступ от края

function DropdownMenu({ isOpen, onClose, items, anchorRef }) {
  const menuRef = useRef(null);
  const [state, setState] = useState({ 
    mounted: false, 
    position: null,
    transformOrigin: 'top right' 
  });
  
  const animationFrameRef = useRef(null);

  useLayoutEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (isOpen && anchorRef?.current) {
      // 1. Сбрасываем позицию, но рендерим (opacity 0) для замеров
      setState(prev => ({ ...prev, mounted: false, position: null }));

      animationFrameRef.current = requestAnimationFrame(() => {
        if (!menuRef.current || !anchorRef.current) return;

        // 2. ИЗМЕРЕНИЯ
        const anchorRect = anchorRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        const menuHeight = menuRef.current.offsetHeight;
        const menuWidth = menuRef.current.offsetWidth;

        let finalTop = 0;
        let finalRight = 'auto';
        let finalLeft = 'auto';
        let originY = 'top';
        let originX = 'right';

        // 3. ВЕРТИКАЛЬ (Вверх или Вниз)
        const spaceBelow = viewportHeight - anchorRect.bottom;
        const spaceAbove = anchorRect.top;

        if (spaceBelow < menuHeight + SAFE_MARGIN && spaceAbove > menuHeight + SAFE_MARGIN) {
          finalTop = anchorRect.top - menuHeight - SAFE_MARGIN;
          originY = 'bottom';
        } else {
          finalTop = anchorRect.bottom + SAFE_MARGIN;
          originY = 'top';
        }

        // 4. ГОРИЗОНТАЛЬ (Влево или Вправо)
        if (anchorRect.right - menuWidth < SAFE_MARGIN) {
           finalLeft = anchorRect.left;
           finalRight = 'auto';
           originX = 'left';
        } else {
           finalRight = viewportWidth - anchorRect.right;
           finalLeft = 'auto';
           originX = 'right';
        }

        // 5. SET STATE
        setState({
          mounted: true,
          position: {
            top: finalTop,
            left: finalLeft,
            right: finalRight,
          },
          transformOrigin: `${originY} ${originX}`
        });
      });
    } else {
      setState(prev => ({ ...prev, mounted: false }));
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, anchorRef]);

  if (!isOpen) return null;

  // Безопасная позиция по дефолту
  const pos = state.position || { top: 0, left: 'auto', right: 'auto' };

  const dropdownContent = (
    <>
      {/* Backdrop */}
      <div 
        style={{
          ...styles.backdrop,
          opacity: state.mounted ? 1 : 0,
          pointerEvents: state.mounted ? 'auto' : 'none',
        }}
        onClick={(e) => {
          e.stopPropagation(); // ⛔ ОСТАНАВЛИВАЕТ ВСЛЫТИЕ СОБЫТИЯ К КАРТОЧКЕ
          onClose();
        }}
      />
      
      {/* Dropdown */}
      <div 
        ref={menuRef}
        style={{
          ...styles.dropdown,
          visibility: state.position ? 'visible' : 'hidden', 
          opacity: state.mounted ? 1 : 0,
          
          top: pos.top,
          left: pos.left,
          right: pos.right,
          
          transformOrigin: state.transformOrigin,
          transform: state.mounted ? 'scale(1)' : 'scale(0.95)',
        }}
        onClick={(e) => e.stopPropagation()} // Блокируем клики внутри самого меню
      >
        {items.map((item, index) => {
          if (item.divider) {
            return <div key={`divider-${index}`} style={styles.divider} />;
          }
          
          return (
            <MenuItem 
              key={index}
              icon={item.icon}
              label={item.label}
              onClick={() => {
                setTimeout(() => {
                  item.onClick();
                  onClose();
                }, 50);
              }}
              danger={item.danger}
              delay={index * 30}
              mounted={state.mounted}
            />
          );
        })}
      </div>
    </>
  );

  return createPortal(dropdownContent, document.body);
}

function MenuItem({ icon, label, onClick, danger, delay, mounted }) {
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      style={{
        ...styles.menuItem,
        color: danger ? theme.colors.error : theme.colors.text,
        backgroundColor: isPressed 
          ? (danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.1)')
          : 'transparent',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateX(0)' : 'translateX(-10px)',
        transitionDelay: mounted ? `${delay}ms` : '0ms',
      }}
      onClick={(e) => {
        e.stopPropagation(); // Блокируем всплытие клика по пункту
        setIsPressed(true);
        onClick();
      }}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setTimeout(() => setIsPressed(false), 200)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <span style={styles.menuIcon}>{icon}</span>
      <span style={styles.menuLabel}>{label}</span>
    </button>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 9998,
    transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  dropdown: {
    position: 'fixed', 
    background: '#1e1e1e', 
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 14,
    padding: '6px 0',
    boxShadow: `0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)`,
    zIndex: 9999,
    minWidth: 180,
    maxWidth: 240,
    willChange: 'transform, opacity',
    transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  
  menuItem: {
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    fontSize: 15,
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    outline: 'none',
  },
  
  menuIcon: {
    fontSize: 18,
    width: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0.9,
  },
  
  menuLabel: {
    flex: 1,
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  
  divider: {
    height: 1,
    background: theme.colors.border,
    margin: '4px 0',
    opacity: 0.5,
  },
};

export default DropdownMenu;