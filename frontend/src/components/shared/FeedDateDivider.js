import React from 'react';
import theme from '../../theme';

function FeedDateDivider({ label }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.line} />
      <span style={styles.label}>{label}</span>
      <div style={styles.line} />
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '8px 4px 14px',
  },
  line: {
    flex: 1,
    height: 1,
    background: theme.colors.border,
  },
  label: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};

export default FeedDateDivider;
