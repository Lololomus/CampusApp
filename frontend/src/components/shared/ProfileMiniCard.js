// ===== 📄 ФАЙЛ: frontend/src/components/shared/ProfileMiniCard.js =====

import React, { useState } from 'react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import PhotoViewer from './PhotoViewer';
import DropdownMenu from '../DropdownMenu'; // ✅ Используем общий компонент
import { useStore } from '../../store';
import { getAvatarColor } from '../../utils/avatarColors';

import { resolveImageUrl } from '../../utils/mediaUrl';
import { AVATAR_BORDER_RADIUS } from './Avatar';

function ProfileMiniCard({ 
  isOpen, 
  onClose, 
  user,
  anchorRef,
  avatarColor,
  onReportUser,
  onReport
}) {
  const { user: currentUser } = useStore();
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);

  if (!user) return null;

  // ===== ЛОГИКА ДАННЫХ =====
  const getAvatarUrl = () => {
    if (!user.avatar) return null;
    return resolveImageUrl(user.avatar, 'avatars');
  };

  const avatarUrl = getAvatarUrl();
  const usernameValue = user.username ? String(user.username).replace(/^@/, '') : null;
  const displayName = usernameValue ? `@${usernameValue}` : (user.name || 'Пользователь');
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
    user.course ? `${user.course} курс` : null
  ].filter(Boolean).join(' · ');

  // ===== ХЕНДЛЕРЫ =====
  const handleViewPhoto = () => {
    hapticFeedback('light');
    setIsPhotoViewerOpen(true);
    // Menu закроется само, т.к. DropdownMenu вызывает onClose после клика
  };

  const handleTelegramOpen = () => {
    if (!user.username) return;
    hapticFeedback('light');
    const cleanUsername = user.username.replace('@', '');
    window.open(`https://t.me/${cleanUsername}`, '_blank');
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

  // ===== СПИСОК КНОПОК (МЕНЮ) =====
  const menuItems = [
    avatarUrl && {
      label: 'Посмотреть фото',
      icon: '📷',
      actionType: 'share', // Синий цвет
      onClick: handleViewPhoto
    },
    user.show_telegram_id && user.username && {
      label: 'Написать',
      icon: '💬',
      actionType: 'edit',  // Зеленый цвет
      onClick: handleTelegramOpen
    },
    !isSelf && {
      label: 'Пожаловаться',
      icon: '🚩',
      actionType: 'report', // Оранжевый цвет
      onClick: handleReport
    }
  ].filter(Boolean);

  // ===== ШАПКА ПРОФИЛЯ (ПЕРЕДАЕМ В DROPDOWN) =====
  const headerContent = (
    <div style={styles.headerContainer}>
      <div style={styles.headerTop}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" style={styles.headerAvatarImage} loading="lazy" decoding="async" />
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
      {/* ✅ Используем DropdownMenu.
          Он сам создаст Portal, Backdrop и обработает позиционирование.
      */}
      <DropdownMenu
        isOpen={isOpen}
        onClose={onClose}
        anchorRef={anchorRef}
        items={menuItems}
        header={headerContent} // <-- Используем новый проп header
        closeOnScroll={true}
      />

      {/* Просмотрщик фото (отдельно) */}
      {isPhotoViewerOpen && avatarUrl && (
        <PhotoViewer
          photos={[avatarUrl]}
          initialIndex={0}
          onClose={() => setIsPhotoViewerOpen(false)}
        />
      )}
    </>
  );
}

// Стили только для шапки (остальное берется из DropdownMenu)
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
  }
};

export default ProfileMiniCard;
