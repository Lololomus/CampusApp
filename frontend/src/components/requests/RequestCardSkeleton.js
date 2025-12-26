// ===== 📄 ФАЙЛ: RequestCardSkeleton.js =====

import React from 'react';
import theme from '../../theme';

function RequestCardSkeleton() {
  return (
    <div style={styles.card}>
      {/* ХЕДЕР - как в RequestCard */}
      <div style={styles.header}>
        <div style={{ ...styles.skeleton, width: 100, height: 24, borderRadius: 16 }} />
        <div style={{ ...styles.skeleton, width: 70, height: 20, borderRadius: 10 }} />
      </div>

      {/* ЗАГОЛОВОК - fontSize.lg */}
      <div style={{ ...styles.skeleton, width: '90%', height: 22, marginBottom: theme.spacing.md }} />

      {/* ОПИСАНИЕ - fontSize.sm, 2 строки */}
      <div style={{ ...styles.skeleton, width: '100%', height: 16, marginBottom: 8 }} />
      <div style={{ ...styles.skeleton, width: '75%', height: 16, marginBottom: theme.spacing.lg }} />

      {/* ЛИНИЯ РАЗДЕЛИТЕЛЬ */}
      <div style={{ height: 1, background: theme.colors.border, marginBottom: theme.spacing.md }} />

      {/* АВТОР - высота 48px (как authorBlock) */}
      <div style={styles.authorBlock}>
        <div style={{ ...styles.skeleton, width: 48, height: 48, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...styles.skeleton, width: 140, height: 16, marginBottom: 6 }} />
          <div style={{ ...styles.skeleton, width: 100, height: 14 }} />
        </div>
      </div>

      {/* ЛИНИЯ РАЗДЕЛИТЕЛЬ */}
      <div style={{ height: 1, background: theme.colors.border, marginTop: theme.spacing.md, marginBottom: theme.spacing.md }} />

      {/* ФУТЕР */}
      <div style={styles.footer}>
        {/* ТЕГИ */}
        <div style={styles.tags}>
          <div style={{ ...styles.skeleton, width: 60, height: 20, borderRadius: 12 }} />
          <div style={{ ...styles.skeleton, width: 70, height: 20, borderRadius: 12 }} />
        </div>

        {/* СТАТИСТИКА */}
        <div style={styles.stats}>
          <div style={{ ...styles.skeleton, width: 35, height: 16 }} />
          <div style={{ ...styles.skeleton, width: 35, height: 16 }} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'not-allowed',
    opacity: 0.6,
    transition: theme.transitions.normal
  },

  skeleton: {
    background: `linear-gradient(90deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.border} 50%, ${theme.colors.bgSecondary} 100%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: theme.radius.sm
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },

  authorBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md
  },

  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  tags: {
    display: 'flex',
    gap: theme.spacing.sm
  },

  stats: {
    display: 'flex',
    gap: theme.spacing.lg
  }
};

// CSS анимация
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  if (!document.querySelector('#shimmer-keyframes')) {
    styleSheet.id = 'shimmer-keyframes';
    document.head.appendChild(styleSheet);
  }
}

export default RequestCardSkeleton;