import React, { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import theme from '../theme';

const SAFE_MARGIN = 8;

const ACTION_COLORS = {
  edit: '#10b981',
  copy: '#8b5cf6',
  delete: '#ef4444',
  report: '#f59e0b',
  share: '#3b82f6',
  default: theme.colors.primary,
};

function DropdownMenu({ 
  isOpen, 
  onClose, 
  items, 
  anchorRef,
  closeOnScroll = true
}) {
  const menuRef = useRef(null);
  const [state, setState] = useState({ 
    mounted: false, 
    position: null,
    transformOrigin: 'top right' 
  });

  const calculatePosition = useCallback(() => {
    if (!menuRef.current || !anchorRef?.current) return null;

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

  useLayoutEffect(() => {
    if (isOpen && anchorRef?.current) {
      setState(prev => ({ ...prev, mounted: false, position: null }));

      requestAnimationFrame(() => {
        const result = calculatePosition();
        if (result) {
          setState({
            mounted: true,
            ...result
          });
        }
      });
    } else {
      setState(prev => ({ ...prev, mounted: false }));
    }
  }, [isOpen, anchorRef, calculatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      if (closeOnScroll) {
        onClose();
      } else {
        const result = calculatePosition();
        if (result) {
          setState(prev => ({ ...prev, ...result }));
        }
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
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
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
          e.stopPropagation();
          onClose();
        }}
        role="presentation"
      />
      
      <div 
        ref={menuRef}
        role="menu"
        aria-label="Dropdown menu"
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
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item, index) => {
          if (item.divider) {
            return <div key={`divider-${index}`} style={styles.divider} role="separator" />;
          }
          
          return (
            <MenuItem 
              key={index}
              icon={item.icon}
              label={item.label}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              actionType={item.actionType}
              disabled={item.disabled}
            />
          );
        })}
      </div>
    </>
  );

  return createPortal(dropdownContent, document.body);
}


function MenuItem({ icon, label, onClick, actionType = 'default', disabled }) {
  const [isPressed, setIsPressed] = useState(false);
  const [ripple, setRipple] = useState(null);

  const accentColor = ACTION_COLORS[actionType] || ACTION_COLORS.default;

  const handleClick = (e) => {
    if (disabled) return;
    
    e.stopPropagation();
    
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    setRipple({ x, y, size });
    
    setTimeout(() => {
      onClick();
      setRipple(null);
    }, 200);
  };

  return (
    <button
      role="menuitem"
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
        boxShadow: isPressed 
          ? `0 0 0 3px ${accentColor}40, 0 0 24px ${accentColor}50`
          : 'none',
        background: isPressed 
          ? `linear-gradient(90deg, ${accentColor}18 0%, transparent 100%)`
          : 'transparent',
      }}
      onClick={handleClick}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setTimeout(() => setIsPressed(false), 150)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {ripple && (
        <span
          style={{
            position: 'absolute',
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            borderRadius: '50%',
            backgroundColor: `${accentColor}40`,
            transform: 'scale(0)',
            animation: 'ripple 0.6s ease-out',
            pointerEvents: 'none',
          }}
        />
      )}
      
      <span 
        style={{
          ...styles.menuIcon,
          color: accentColor,
          transform: isPressed ? 'scale(1.15)' : 'scale(1)',
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    zIndex: 9998,
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
    zIndex: 9999,
    minWidth: 220,
    maxWidth: 300,
    willChange: 'transform, opacity',
    transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
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

  button[role="menuitem"]:not(:disabled):hover {
    background: ${theme.colors.surface} !important;
    transform: translateX(2px);
  }

  button[role="menuitem"]:not(:disabled):active {
    transform: scale(0.98);
  }
`;
document.head.appendChild(styleSheet);

export default DropdownMenu;