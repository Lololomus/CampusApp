// ===== FILE: ErrorBoundary.js =====

import React from 'react';
import { theme } from '../../theme';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.title}>Что-то пошло не так</div>
          <button style={styles.button} onClick={this.handleRetry}>
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.lg,
  },
  button: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.text,
    border: 'none',
    borderRadius: theme.radius.sm,
    padding: '12px 24px',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
  },
};

export default ErrorBoundary;
