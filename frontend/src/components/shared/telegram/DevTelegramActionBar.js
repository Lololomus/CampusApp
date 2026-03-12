// ===== FILE: frontend/src/components/shared/telegram/DevTelegramActionBar.js =====

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import theme from '../../../theme';

const ROOT = document.documentElement;

function ActionButton({ config, isSingle, kind }) {
  if (!config?.visible) return null;

  const {
    text = '',
    onClick,
    enabled = true,
    loading = false,
    color,
  } = config;

  const disabled = enabled === false || loading;

  const defaultBackground = kind === 'main' ? theme.colors.primary : theme.colors.bgSecondary;
  const bg = color || defaultBackground;

  // Контрастный текст: лайм (#D4FF00) → чёрный, тёмные фоны → белый
  const getTextColor = (hex) => {
    const c = (hex || '').replace('#', '');
    if (c.length !== 6) return '#ffffff';
    const luma = (0.299 * parseInt(c.slice(0,2),16) + 0.587 * parseInt(c.slice(2,4),16) + 0.114 * parseInt(c.slice(4,6),16)) / 255;
    return luma > 0.5 ? '#000000' : '#ffffff';
  };

  const style = {
    ...styles.button,
    ...(isSingle ? styles.buttonSingle : {}),
    background: bg,
    color: kind === 'main' ? getTextColor(bg) : theme.colors.text,
    opacity: disabled ? 0.6 : 1,
    border: kind === 'secondary' ? `1px solid ${theme.colors.border}` : 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };

  return (
    <button
      type="button"
      style={style}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={text || `${kind} action`}
    >
      {loading ? '...' : text}
    </button>
  );
}

function DevTelegramActionBar({ main, secondary }) {
  const barRef = useRef(null);

  const visibleButtons = useMemo(() => {
    return [secondary, main].filter((button) => button?.visible);
  }, [main, secondary]);

  useLayoutEffect(() => {
    if (!barRef.current || visibleButtons.length === 0) {
      ROOT.style.setProperty('--dev-action-bar-height', '0px');
      return;
    }

    const height = `${barRef.current.offsetHeight}px`;
    ROOT.style.setProperty('--dev-action-bar-height', height);
  }, [visibleButtons]);

  useEffect(() => {
    return () => {
      ROOT.style.setProperty('--dev-action-bar-height', '0px');
    };
  }, []);

  if (visibleButtons.length === 0) return null;

  const isSingle = visibleButtons.length === 1;

  return (
    <div ref={barRef} style={styles.container} role="toolbar" aria-label="Dev Telegram action bar">
      <div style={{ ...styles.row, gridTemplateColumns: isSingle ? '1fr' : '1fr 1fr' }}>
        <ActionButton config={secondary} kind="secondary" isSingle={isSingle} />
        <ActionButton config={main} kind="main" isSingle={isSingle} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9800,
    padding: '10px 12px',
    paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
    background: theme.colors.bgSecondary,
    borderTop: `1px solid ${theme.colors.border}`,
    boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.25)',
  },
  row: {
    display: 'grid',
    gap: 8,
    alignItems: 'center',
    width: '100%',
    maxWidth: 640,
    margin: '0 auto',
  },
  button: {
    minHeight: 48,
    width: '100%',
    borderRadius: 12,
    padding: '0 14px',
    fontSize: 15,
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s ease',
  },
  buttonSingle: {
    gridColumn: '1 / -1',
  },
};

export default DevTelegramActionBar;
