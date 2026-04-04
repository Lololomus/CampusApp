import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { devLoginAs, devResetUser } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from './Toast';
import { theme } from '../../theme';
import { parseDeepLink } from '../../utils/deepLinks';

const DEV_ADMIN_TELEGRAM_ID = 999999;
const DEV_AMBASSADOR_TELEGRAM_ID = 999998;

function DevAuthPanel({ onRunSplashVariant }) {
  const {
    user,
    setUser,
    setOnboardingStep,
    setOnboardingData,
    logout,
    setActiveTab,
    clearDatingProfile,
    setPendingDatingOnboardingOpen,
    setPendingDeepLink,
  } = useStore();
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [testStartParam, setTestStartParam] = useState('');

  const isDevVisible = useMemo(() => {
    const mode = import.meta.env.MODE;
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    return mode === 'development' && isLocalhost;
  }, []);

  if (!isDevVisible) return null;

  const currentDevTelegramId = Number(user?.telegram_id || 0);
  const canResetCurrentDating = (
    currentDevTelegramId === DEV_ADMIN_TELEGRAM_ID ||
    currentDevTelegramId === DEV_AMBASSADOR_TELEGRAM_ID
  );

  const toggleCollapsed = () => {
    hapticFeedback('light');
    setCollapsed((prev) => !prev);
  };

  const handleSplashPreview = (variant) => {
    if (!onRunSplashVariant) return;
    hapticFeedback('light');
    onRunSplashVariant(variant);
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
      toast.success(`Вход под тестовым аккаунтом: #${telegramId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Не удалось выполнить тестовый вход');
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
      toast.error('Не удалось выйти из аккаунта');
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
        toast.warning('Профиль уже существует, проверьте сценарий сброса');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Не удалось выполнить сброс');
      hapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  const handleResetDatingProfile = async () => {
    if (busy) return;
    if (!canResetCurrentDating) {
      toast.info('Сначала войдите как тестовый админ или амбассадор');
      return;
    }

    setBusy(true);
    hapticFeedback('heavy');
    try {
      await devResetUser(currentDevTelegramId);
      clearDatingProfile();
      setUser({ ...user, show_in_dating: false });
      setPendingDatingOnboardingOpen(true);
      setActiveTab('people');
      toast.success('Дейтинг-профиль сброшен');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Не удалось сбросить дейтинг-профиль');
      hapticFeedback('error');
    } finally {
      setBusy(false);
    }
  };

  const handleRunDeepLink = () => {
    const parsedLink = parseDeepLink(testStartParam);
    if (!parsedLink) {
      toast.error('Некорректный start_param');
      hapticFeedback('error');
      return;
    }

    hapticFeedback('medium');
    setPendingDeepLink(parsedLink);
    toast.success(`Переход поставлен в очередь: ${parsedLink.raw}`);
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
          x
        </button>
      </div>

      {onRunSplashVariant && (
        <div style={styles.previewSection}>
          <span style={styles.previewLabel}>Splash Preview</span>
          <div style={styles.previewButtonsRow}>
            <button type="button" style={styles.previewButton} onClick={() => handleSplashPreview('first')}>
              First Launch
            </button>
            <button type="button" style={styles.previewButton} onClick={() => handleSplashPreview('repeat')}>
              Repeat Launch
            </button>
          </div>
        </div>
      )}

      <div style={styles.previewSection}>
        <span style={styles.previewLabel}>Deep Link Test</span>
        <input
          type="text"
          value={testStartParam}
          onChange={(event) => setTestStartParam(event.target.value)}
          placeholder="post_1 / create_post"
          style={styles.input}
        />
        <button type="button" style={styles.previewButton} onClick={handleRunDeepLink}>
          Run Deep Link
        </button>
      </div>

      <button type="button" style={styles.button} onClick={() => handleLoginAs(DEV_ADMIN_TELEGRAM_ID)} disabled={busy}>
        Login Superadmin
      </button>
      <button type="button" style={styles.button} onClick={() => handleLoginAs(DEV_AMBASSADOR_TELEGRAM_ID)} disabled={busy}>
        Login Ambassador (RUK Moscow)
      </button>
      <button type="button" style={styles.buttonSecondary} onClick={handleLogout} disabled={busy}>
        Logout
      </button>
      <button
        type="button"
        style={styles.buttonSecondary}
        onClick={handleResetDatingProfile}
        disabled={busy || !canResetCurrentDating}
      >
        Reset Current Dating
      </button>
      <button type="button" style={styles.buttonDanger} onClick={() => handleResetAndReregister(DEV_ADMIN_TELEGRAM_ID)} disabled={busy}>
        Reset Admin Account
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
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  previewLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  previewButtonsRow: {
    display: 'flex',
    gap: theme.spacing.xs,
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
  previewButton: {
    flex: 1,
    border: 'none',
    borderRadius: theme.radius.md,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    cursor: 'pointer',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    outline: 'none',
    boxSizing: 'border-box',
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
