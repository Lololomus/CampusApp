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
  sticky = true,
  showTitle = true,
  showDivider = true,
  background = null,
  titleVariant = 'default',
}) {
  const isDev = import.meta.env.DEV;
  const isDesktop = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: fine)').matches;
  const shouldRenderBack = showBack && (isDev || isDesktop || showLocalBackInTelegram);

  const handleBackClick = () => {
    hapticFeedback('light');
    onBack?.();
  };

  const resolvedBackground = background ?? theme.colors.bgSecondary;
  const headerStyle = transparent
    ? {
        ...styles.header,
        ...(sticky ? null : styles.headerStatic),
        background: 'transparent',
        borderBottom: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      }
    : {
        ...styles.header,
        ...(sticky ? null : styles.headerStatic),
        background: resolvedBackground,
        borderBottom: showDivider ? `1px solid ${theme.colors.border}` : 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      };

  const backButtonStyle = transparent
    ? { ...styles.backButton, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)' }
    : { ...styles.backButton, background: '#000000', border: '1px solid rgba(255,255,255,0.1)' };

  const titleStyle = titleVariant === 'app'
    ? styles.titleApp
    : styles.title;

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

        <h1 style={showTitle ? titleStyle : styles.titleHidden}>{showTitle ? title : ''}</h1>

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
  headerStatic: {
    position: 'relative',
    top: 'auto',
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
    width: 44,
    height: 44,
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
  titleApp: {
    margin: 0,
    fontSize: 24,
    lineHeight: '28px',
    fontWeight: 800,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: '-0.5px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  titleHidden: {
    margin: 0,
    width: '100%',
    height: 0,
    overflow: 'hidden',
  },
};

export default DrilldownHeader;
