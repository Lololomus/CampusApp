import React, { useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import SwipeableModal from '../shared/SwipeableModal';
import { useBottomSheetModal } from '../../hooks/useBottomSheetModal';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { hapticFeedback } from '../../utils/telegram';
import { normalizeTelegramUsername } from '../../utils/telegramUsername';
import theme from '../../theme';

function PublicProfileSheet({ user, isOpen, onClose }) {
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const { isOpen: sheetOpen, requestClose } = useBottomSheetModal({ open: isOpen, onClose });
  const avatarUrl = useMemo(() => {
    if (!user?.avatar) return null;
    return resolveImageUrl(user.avatar, 'avatars');
  }, [user?.avatar]);

  if (!user) return null;

  const username = user.username ? String(user.username).replace(/^@/, '').trim() : null;
  const telegramUsername = normalizeTelegramUsername(user.telegram_username);
  const displayName = user.name || username || 'Пользователь';
  const subtitleParts = [
    user.university,
    user.institute,
    user.course ? `${user.course} курс` : null,
    user.city,
  ].filter(Boolean);
  const canMessage = Boolean(user.show_telegram_id && telegramUsername);

  const handleOpenTelegram = () => {
    if (!canMessage) return;
    hapticFeedback('light');
    const url = `https://t.me/${telegramUsername}`;
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <SwipeableModal isOpen={sheetOpen} onClose={requestClose} title="Профиль">
      <div style={styles.container}>
        <button
          type="button"
          style={styles.avatarButton}
          onClick={() => avatarUrl && setIsPhotoOpen(true)}
          disabled={!avatarUrl}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={styles.avatarImage} />
          ) : (
            <div style={styles.avatarFallback}>
              {(displayName || 'U').trim().charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        <div style={styles.name}>{displayName}</div>
        {canMessage && <div style={styles.username}>@{telegramUsername}</div>}
        {subtitleParts.length > 0 && (
          <div style={styles.meta}>{subtitleParts.join(' • ')}</div>
        )}

        {canMessage && (
          <button type="button" style={styles.cta} onClick={handleOpenTelegram}>
            <MessageCircle size={18} />
            <span>Написать</span>
          </button>
        )}

        {isPhotoOpen && avatarUrl && (
          <div style={styles.backdrop} onClick={() => setIsPhotoOpen(false)}>
            <img
              src={avatarUrl}
              alt=""
              style={styles.fullImage}
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        )}
      </div>
    </SwipeableModal>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  avatarButton: {
    width: 104,
    height: 104,
    borderRadius: 28,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    padding: 0,
    background: 'transparent',
    cursor: 'pointer',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.colors.bgSecondary,
    color: theme.colors.text,
    fontSize: 36,
    fontWeight: theme.fontWeight.semibold,
  },
  name: {
    fontSize: 24,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  username: {
    marginTop: -6,
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  meta: {
    fontSize: 14,
    lineHeight: 1.45,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    maxWidth: 280,
  },
  cta: {
    marginTop: 8,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 16,
    padding: '14px 18px',
    background: theme.colors.primary,
    color: '#000000',
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },
  backdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    zIndex: 12000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.85)',
    padding: 16,
  },
  fullImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    borderRadius: 20,
    objectFit: 'contain',
  },
};

export default PublicProfileSheet;
