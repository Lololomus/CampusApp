// ===== FILE: frontend/src/components/shared/DrilldownHeader.js =====

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';

function DrilldownHeader({
  title,
  onBack,
  rightSlot = null,
  showBack = true,
  showLocalBackInTelegram = false,
  transparent = false,
}) {
  const isDev = import.meta.env.DEV;
  const shouldRenderBack = showBack && (isDev || showLocalBackInTelegram);

  const handleBackClick = () => {
    hapticFeedback('light');
    onBack?.();
  };

  const headerStyle = transparent
    ? { ...styles.header, background: 'transparent', borderBottom: 'none', backdropFilter: 'none', WebkitBackdropFilter: 'none' }
    : styles.header;

  const backButtonStyle = transparent
    ? { ...styles.backButton, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)' }
    : styles.backButton;

  return (
    <header style={headerStyle}>
      <div style={styles.inner}>
        <div style={styles.side}>
          {shouldRenderBack ? (
            <button
              type="button"
              onClick={handleBackClick}
              style={backButtonStyle}
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div style={styles.sidePlaceholder} />
          )}
        </div>

        <h1 style={styles.title}>{title}</h1>

        <div style={styles.side}>{rightSlot || <div style={styles.sidePlaceholder} />}</div>
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 105,
    minHeight: 'var(--drilldown-header-height)',
    paddingTop: 'var(--screen-top-offset)',
    background: theme.colors.bgSecondary,
    borderBottom: `1px solid ${theme.colors.border}`,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  inner: {
    height: 'var(--drilldown-header-height)',
    display: 'grid',
    gridTemplateColumns: '48px 1fr 48px',
    alignItems: 'center',
    gap: 8,
    padding: '0 12px',
  },
  side: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    minHeight: 48,
  },
  sidePlaceholder: {
    width: 40,
    height: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.bg,
    color: theme.colors.text,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    margin: 0,
    fontSize: 18,
    lineHeight: '22px',
    fontWeight: 700,
    color: theme.colors.text,
    textAlign: 'center',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
};

export default DrilldownHeader;
