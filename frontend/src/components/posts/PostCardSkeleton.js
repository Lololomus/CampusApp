import React from 'react';

function PostCardSkeleton() {
  return (
    <div style={styles.card}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.avatarSkeleton} />
        <div style={styles.authorInfo}>
          <div style={styles.nameSkeleton} />
          <div style={styles.universitySkeleton} />
        </div>
      </div>

      {/* CATEGORY BADGE */}
      <div style={styles.categoryBadgeSkeleton} />

      {/* BODY */}
      <div style={styles.bodySkeleton1} />
      <div style={styles.bodySkeleton2} />
      <div style={styles.bodySkeleton3} />

      {/* FOOTER STATS */}
      <div style={styles.footer}>
        <div style={styles.statSkeleton} />
        <div style={styles.statSkeleton} />
        <div style={styles.statSkeleton} />
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid #2a2a2a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  avatarSkeleton: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  authorInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  nameSkeleton: {
    width: '120px',
    height: '16px',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  universitySkeleton: {
    width: '180px',
    height: '12px',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  categoryBadgeSkeleton: {
    width: '100px',
    height: '24px',
    borderRadius: '12px',
    marginBottom: '12px',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  bodySkeleton1: {
    width: '100%',
    height: '14px',
    borderRadius: '4px',
    marginBottom: '8px',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  bodySkeleton2: {
    width: '95%',
    height: '14px',
    borderRadius: '4px',
    marginBottom: '8px',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  bodySkeleton3: {
    width: '70%',
    height: '14px',
    borderRadius: '4px',
    marginBottom: '16px',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  footer: {
    display: 'flex',
    gap: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #2a2a2a',
  },
  statSkeleton: {
    width: '50px',
    height: '16px',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
};

// CSS анимация
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
document.head.appendChild(styleSheet);

export default PostCardSkeleton;