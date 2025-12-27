import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import theme from '../theme';

function DropdownMenu({ isOpen, onClose, items, anchorRef }) {
  const menuRef = useRef(null);
  const [state, setState] = useState({ mounted: false, position: null });
  const animationFrameRef = useRef(null); // ← Отслеживаем requestAnimationFrame

  // useLayoutEffect вместо useEffect - синхронно, до paint
  useLayoutEffect(() => {
    // Отменяем предыдущий requestAnimationFrame если есть
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (isOpen && anchorRef?.current) {
      // 1. Вычисляем позицию СИНХРОННО
      const rect = anchorRef.current.getBoundingClientRect();
      const newPosition = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      };

      // 2. Устанавливаем позицию БЕЗ mounted (меню невидимо)
      setState({ mounted: false, position: newPosition });

      // 3. В СЛЕДУЮЩЕМ фрейме включаем анимацию
      animationFrameRef.current = requestAnimationFrame(() => {
        setState(prev => ({ ...prev, mounted: true }));
        animationFrameRef.current = null;
      });

      const handleClickOutside = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target) && 
            anchorRef.current && !anchorRef.current.contains(e.target)) {
          onClose();
        }
      };
      
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
        
        // Отменяем requestAnimationFrame при unmount
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    } else {
      // Сбрасываем состояние при закрытии
      setState({ mounted: false, position: null });
    }
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !state.position) return null;

  const dropdownContent = (
    <>
      {/* Backdrop */}
      <div 
        style={{
          ...styles.backdrop,
          opacity: state.mounted ? 0.5 : 0,
        }}
        onClick={onClose}
      />
      
      {/* Dropdown */}
      <div 
        ref={menuRef}
        style={{
          ...styles.dropdown,
          top: state.position.top,
          right: state.position.right,
          opacity: state.mounted ? 1 : 0,
          transform: state.mounted 
            ? 'translateY(0) scale(1)' 
            : 'translateY(-20px) scale(0.85)',
        }}
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
              onClick={item.onClick}
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

  const handleClick = (e) => {
    e.stopPropagation();
    setIsPressed(true);
    setTimeout(() => onClick(), 100);
  };

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
      onClick={handleClick}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setTimeout(() => setIsPressed(false), 150)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      <span style={styles.menuIcon}>{icon}</span>
      <span style={styles.menuLabel}>{label}</span>
      
      {isPressed && (
        <span style={styles.ripple} />
      )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9998,
    transition: 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'auto',
  },
  
  dropdown: {
    position: 'fixed',
    background: `linear-gradient(135deg, ${theme.colors.card} 0%, ${theme.colors.card}dd 100%)`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 16,
    boxShadow: `
      0 10px 25px -5px rgba(0, 0, 0, 0.4),
      0 8px 10px -6px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.08),
      inset 0 1px 0 0 rgba(255, 255, 255, 0.1)
    `,
    zIndex: 9999,
    minWidth: 220,
    overflow: 'hidden',
    transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
    transformOrigin: 'top right',
    willChange: 'transform, opacity',
  },
  
  menuItem: {
    width: '100%',
    padding: '14px 18px',
    background: 'none',
    border: 'none',
    fontSize: 15,
    fontWeight: 500,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    position: 'relative',
    overflow: 'hidden',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  },
  
  menuIcon: {
    fontSize: 20,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  
  menuLabel: {
    flex: 1,
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
  },
  
  divider: {
    height: 1,
    background: `linear-gradient(90deg, transparent, ${theme.colors.border}, transparent)`,
    margin: '8px 12px',
    opacity: 0.6,
  },
  
  ripple: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.2)',
    transform: 'translate(-50%, -50%) scale(0)',
    animation: 'ripple 0.6s ease-out',
    pointerEvents: 'none',
  },
};

export default DropdownMenu;