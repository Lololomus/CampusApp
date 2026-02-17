// ===== 📄 ФАЙЛ: frontend/src/components/shared/DevAuthPanel.js =====

import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { devLoginAs, devResetUser } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from './Toast';
import { theme } from '../../theme';

function DevAuthPanel() {
  const { setUser, setOnboardingStep, setOnboardingData, logout } = useStore();
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const isDevVisible = useMemo(() => {
    const env = process.env.REACT_APP_APP_ENV || process.env.NODE_ENV;
    return process.env.NODE_ENV !== 'production' && env === 'dev';
  }, []);

  if (!isDevVisible) return null;

  const toggleCollapsed = () => {
    hapticFeedback('light');
    setCollapsed((prev) => !prev);
  };

  const handleLoginAs = async (telegramId) => {
    if (busy) return;
    setBusy(true);
    hapticFeedback('medium');
    try {
      const data = await devLoginAs(telegramId);
      setUser(data.user || null);
      if (!data.user) {
        setOnboardingData({});
        setOnboardingStep(1);
      }
      toast.success(`Dev login: #${telegramId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Dev login failed');
      hapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    hapticFeedback('light');
    try {
      await logout();
      toast.info('Вы вышли из аккаунта');
    } catch {
      toast.error('Ошибка выхода');
      hapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  const handleResetAndReregister = async (telegramId) => {
    if (busy) return;
    setBusy(true);
    hapticFeedback('heavy');
    try {
      await devResetUser(telegramId, true);
      const data = await devLoginAs(telegramId);
      setUser(null);
      setOnboardingData({});
      setOnboardingStep(1);
      toast.success(`Профиль #${telegramId} сброшен`);
      if (data.user) {
        toast.warning('Профиль уже существует, проверьте reset flow');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Reset failed');
      hapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        style={styles.cap}
        onClick={toggleCollapsed}
        aria-label="Open dev auth panel"
      >
        DEV
      </button>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.headerRow}>
        <span style={styles.headerLabel}>Dev Tools</span>
        <button
          type="button"
          style={styles.collapseButton}
          onClick={toggleCollapsed}
          aria-label="Collapse dev auth panel"
        >
          ×
        </button>
      </div>
      <button type="button" style={styles.button} onClick={() => handleLoginAs(999999)} disabled={busy}>
        Login Test #1
      </button>
      <button type="button" style={styles.button} onClick={() => handleLoginAs(999998)} disabled={busy}>
        Login Test #2
      </button>
      <button type="button" style={styles.buttonSecondary} onClick={handleLogout} disabled={busy}>
        Logout
      </button>
      <button type="button" style={styles.buttonDanger} onClick={() => handleResetAndReregister(999999)} disabled={busy}>
        Reset & Re-register
      </button>
    </div>
  );
}

const styles = {
  cap: {
    position: 'fixed',
    right: theme.spacing.md,
    top: '50%',
    zIndex: 4500,
    width: 46,
    height: 46,
    borderRadius: theme.radius.full,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.elevated,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.xs,
    cursor: 'pointer',
    boxShadow: `0 8px 20px ${theme.colors.overlay}`,
    transform: 'translateY(-50%)',
    willChange: 'transform, opacity',
    transition: `transform ${theme.animations.duration.fast}ms ${theme.animations.easing.spring}, opacity ${theme.transitions.fast}`,
  },
  panel: {
    position: 'fixed',
    right: theme.spacing.md,
    top: '50%',
    zIndex: 4500,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    width: 220,
    maxHeight: '70vh',
    overflowY: 'auto',
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    background: theme.colors.elevated,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: `0 8px 20px ${theme.colors.overlay}`,
    transform: 'translateY(-50%)',
    willChange: 'transform, opacity',
    opacity: 1,
    transition: `transform ${theme.animations.duration.normal}ms ${theme.animations.easing.spring}, opacity ${theme.transitions.normal}`,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  headerLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  collapseButton: {
    width: 26,
    height: 26,
    borderRadius: theme.radius.full,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    cursor: 'pointer',
    lineHeight: 1,
    fontSize: theme.fontSize.lg,
    padding: 0,
  },
  button: {
    border: 'none',
    borderRadius: theme.radius.md,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    background: theme.colors.primary,
    color: theme.colors.text,
    cursor: 'pointer',
    textAlign: 'left',
    transition: `transform ${theme.transitions.fast}, opacity ${theme.transitions.fast}`,
  },
  buttonSecondary: {
    border: 'none',
    borderRadius: theme.radius.md,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    cursor: 'pointer',
    textAlign: 'left',
  },
  buttonDanger: {
    border: 'none',
    borderRadius: theme.radius.md,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    background: theme.colors.error,
    color: theme.colors.text,
    cursor: 'pointer',
    textAlign: 'left',
  },
};

export default React.memo(DevAuthPanel);
