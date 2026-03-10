import React, { forwardRef } from 'react';
import { MoreVertical } from 'lucide-react';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';

const OverflowMenuButton = forwardRef(function OverflowMenuButton(
  {
    isOpen = false,
    onToggle,
    icon = null,
    iconSize = 20,
    ariaLabel = 'Меню',
    className = '',
    style = null,
    activeStyle = null,
    activeBorderColor = theme.colors.premium.border,
    onPressStart = null,
    onPressEnd = null,
    stopPropagation = true,
    disabled = false,
  },
  ref
) {
  const handleToggle = (e) => {
    if (stopPropagation) e.stopPropagation();
    if (disabled) return;
    hapticFeedback('light');
    onToggle?.(e);
  };

  const handlePressStart = (e) => {
    if (stopPropagation) e.stopPropagation();
    onPressStart?.(e);
  };

  const handlePressEnd = (e) => {
    if (stopPropagation) e.stopPropagation();
    onPressEnd?.(e);
  };

  const mergedStyle = {
    ...styles.button,
    ...(isOpen ? styles.buttonActive(activeBorderColor) : null),
    ...(style || null),
    ...(isOpen && activeStyle ? activeStyle : null),
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className={className}
      style={mergedStyle}
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerCancel={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      onClick={handleToggle}
      disabled={disabled}
    >
      {icon || <MoreVertical size={iconSize} />}
    </button>
  );
});

const styles = {
  button: {
    padding: 6,
    borderRadius: theme.radius.full,
    border: '1px solid transparent',
    background: 'transparent',
    color: theme.colors.textTertiary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  buttonActive: (borderColor) => ({
    background: 'rgba(255,255,255,0.08)',
    border: `1px solid ${borderColor}`,
    color: '#FFFFFF',
  }),
};

export default OverflowMenuButton;
