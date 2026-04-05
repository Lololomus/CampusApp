// ===== [LEGACY] RequestCardSkeleton — таб запросов убран. Компонент отключён, не удалять. =====
import React from 'react';
import theme from '../../theme';
import { AVATAR_BORDER_RADIUS } from '../shared/Avatar';

function RequestCardSkeleton() {
  return (
    <div style={styles.card}>
      <div style={styles.mainRow}>
        <div style={{ ...styles.skeleton, ...styles.avatar }} />

        <div style={styles.mainContent}>
          <div style={styles.topRow}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...styles.skeleton, width: 132, height: 16, marginBottom: 6 }} />
              <div style={{ ...styles.skeleton, width: 94, height: 12 }} />
            </div>
            <div style={{ ...styles.skeleton, width: 88, height: 20, borderRadius: 10 }} />
          </div>

          <div style={{ ...styles.skeleton, width: '78%', height: 18, marginBottom: 8 }} />
          <div style={{ ...styles.skeleton, width: '100%', height: 14, marginBottom: 6 }} />
          <div style={{ ...styles.skeleton, width: '66%', height: 14 }} />

          <div style={styles.chipsRow}>
            <div style={{ ...styles.skeleton, width: 92, height: 24, borderRadius: 8 }} />
            <div style={{ ...styles.skeleton, width: 118, height: 24, borderRadius: 8 }} />
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <div style={{ ...styles.skeleton, width: 138, height: 14 }} />
        <div style={{ ...styles.skeleton, width: 90, height: 28, borderRadius: 14 }} />
      </div>
    </div>
  );
}

const styles = {
  card: {
    padding: '24px 0 16px',
    borderBottom: `1px solid ${theme.colors.premium.border}`,
    opacity: 0.75,
    cursor: 'not-allowed',
  },
  mainRow: {
    display: 'flex',
    gap: 12,
    padding: '0 16px',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: AVATAR_BORDER_RADIUS,
    flexShrink: 0,
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  chipsRow: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
  },
  footer: {
    marginTop: 16,
    padding: '0 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  skeleton: {
    borderRadius: theme.radius.sm,
    background: `linear-gradient(90deg, ${theme.colors.premium.surfaceElevated} 0%, ${theme.colors.premium.surfaceHover} 50%, ${theme.colors.premium.surfaceElevated} 100%)`,
    backgroundSize: '220% 100%',
    animation: 'requestShimmer 1.5s infinite linear',
  },
};

if (typeof document !== 'undefined' && !document.getElementById('request-skeleton-keyframes')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'request-skeleton-keyframes';
  styleSheet.textContent = `
    @keyframes requestShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default RequestCardSkeleton;
