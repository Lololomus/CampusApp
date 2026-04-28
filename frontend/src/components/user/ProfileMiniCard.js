// ===== FILE: frontend/src/components/user/ProfileMiniCard.js =====

import React, { useCallback, useRef, useState } from 'react';
import { Camera, Flag, MessageCircle } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import PhotoViewer from '../media/PhotoViewer';
import DropdownMenu from '../shared/DropdownMenu';
import { useStore } from '../../store';
import { getAvatarColor } from '../../utils/avatarColors';

import { resolveImageUrl } from '../../utils/mediaUrl';
import { AVATAR_BORDER_RADIUS } from './Avatar';
import { normalizeTelegramUsername } from '../../utils/telegramUsername';
import { captureSourceRect } from '../../utils/mediaRect';

const getMiniAvatarSourceRect = (element) => captureSourceRect(element, {
  objectFit: 'cover',
  borderRadius: AVATAR_BORDER_RADIUS,
});

function ProfileMiniCard({
  isOpen,
  onClose,
  user,
  anchorRef,
  avatarColor,
  onReportUser,
  onReport,
}) {
  const { user: currentUser } = useStore();
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [photoViewerSourceRect, setPhotoViewerSourceRect] = useState(null);
  const avatarImageRef = useRef(null);

  const resolveAvatarSourceRect = useCallback(() => (
    getMiniAvatarSourceRect(avatarImageRef.current) || photoViewerSourceRect
  ), [photoViewerSourceRect]);

  if (!user) return null;

  const getAvatarUrl = () => {
    if (!user.avatar) return null;
    return resolveImageUrl(user.avatar, 'avatars');
  };

  const avatarUrl = getAvatarUrl();
  const usernameValue = user.username ? String(user.username).replace(/^@/, '').trim() : null;
  const telegramUsername = normalizeTelegramUsername(user.telegram_username);
  const displayName = user.name || usernameValue || 'Пользователь';
  const targetUserId = user.id != null ? String(user.id) : null;
  const currentUserId = currentUser?.id != null
    ? String(currentUser.id)
    : (currentUser?.user_id != null ? String(currentUser.user_id) : null);
  const targetTelegramId = user.telegram_id != null ? String(user.telegram_id) : null;
  const currentTelegramId = currentUser?.telegram_id != null ? String(currentUser.telegram_id) : null;
  const isSelf = Boolean(
    (targetUserId && currentUserId && targetUserId === currentUserId) ||
    (targetTelegramId && currentTelegramId && targetTelegramId === currentTelegramId)
  );
  const initial = (user.name || usernameValue || 'U').trim().charAt(0).toUpperCase();
  const fallbackAvatarColor = avatarColor || getAvatarColor(usernameValue || user.name || 'A');

  const userInfo = [
    user.university,
    user.course ? `${user.course} курс` : null,
  ].filter(Boolean).join(' · ');

  const handleViewPhoto = () => {
    hapticFeedback('light');
    setPhotoViewerSourceRect(getMiniAvatarSourceRect(avatarImageRef.current));
    setIsPhotoViewerOpen(true);
  };

  const handleTelegramOpen = () => {
    if (!telegramUsername) return;
    hapticFeedback('light');
    window.open(`https://t.me/${telegramUsername}`, '_blank');
  };

  const handleReport = () => {
    if (isSelf) return;
    hapticFeedback('light');
    if (onReportUser) {
      onReportUser(user);
      return;
    }
    if (onReport) onReport(user);
  };

  const menuItems = [
    avatarUrl && {
      label: 'Посмотреть фото',
      icon: <Camera size={18} strokeWidth={2.1} />,
      actionType: 'share',
      onClick: handleViewPhoto,
    },
    user.show_telegram_id && telegramUsername && {
      label: 'Написать',
      icon: <MessageCircle size={18} strokeWidth={2.1} />,
      actionType: 'edit',
      onClick: handleTelegramOpen,
    },
    !isSelf && {
      label: 'Пожаловаться',
      icon: <Flag size={18} strokeWidth={2.1} />,
      actionType: 'report',
      onClick: handleReport,
    },
  ].filter(Boolean);

  const headerContent = (
    <div style={styles.headerContainer}>
      <div style={styles.headerTop}>
        {avatarUrl ? (
          <img
            ref={avatarImageRef}
            src={avatarUrl}
            alt=""
            style={{
              ...styles.headerAvatarImage,
              visibility: isPhotoViewerOpen ? 'hidden' : 'visible',
            }}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div style={{ ...styles.headerAvatarFallback, background: fallbackAvatarColor }}>{initial}</div>
        )}
        <div style={styles.headerTextBlock}>
          <div style={styles.username} title={displayName}>{displayName}</div>
          {userInfo && <div style={styles.userInfo} title={userInfo}>{userInfo}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <DropdownMenu
        isOpen={isOpen}
        onClose={onClose}
        anchorRef={anchorRef}
        items={menuItems}
        header={headerContent}
        closeOnScroll
      />

      {isPhotoViewerOpen && avatarUrl && (
        <PhotoViewer
          photos={[avatarUrl]}
          initialIndex={0}
          onClose={() => {
            setIsPhotoViewerOpen(false);
            setPhotoViewerSourceRect(null);
          }}
          sourceRect={photoViewerSourceRect}
          sourceRectProvider={resolveAvatarSourceRect}
        />
      )}
    </>
  );
}

const styles = {
  headerContainer: {
    padding: '4px 12px 8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  headerTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: AVATAR_BORDER_RADIUS,
    objectFit: 'cover',
    flexShrink: 0,
    border: `1px solid ${theme.colors.border}`,
  },
  headerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: AVATAR_BORDER_RADIUS,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`,
  },
  headerTextBlock: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  username: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userInfo: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default ProfileMiniCard;
