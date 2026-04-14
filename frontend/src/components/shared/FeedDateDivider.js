import React from 'react';
import theme from '../../theme';

const BASE_MARGIN = 8;

function getCompensatedMargin(spacing) {
  return BASE_MARGIN - (typeof spacing === 'number' ? spacing : 0);
}

function FeedDateDivider({ label, spacingBefore = 0, spacingAfter = 0 }) {
  const marginTop = getCompensatedMargin(spacingBefore);
  const marginBottom = getCompensatedMargin(spacingAfter);

  return (
    <div style={{ ...styles.wrap, margin: `${marginTop}px ${BASE_MARGIN}px ${marginBottom}px` }}>
      <span style={styles.label}>{label}</span>
    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 18,
  },
  label: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: 700,
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
  },
};

export default FeedDateDivider;
