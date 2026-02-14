// ===== 📄 ФАЙЛ: frontend/src/components/shared/ProfileMiniCard.js =====

import React, { useState } from 'react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import PhotoViewer from './PhotoViewer';
import DropdownMenu from '../DropdownMenu'; // ✅ Используем общий компонент

const API_URL = 'http://localhost:8000';

function ProfileMiniCard({ 
  isOpen, 
  onClose, 
  user,
  anchorRef,
  onReport
}) {
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);

  if (!user) return null;

  // ===== ЛОГИКА ДАННЫХ =====
  const getAvatarUrl = () => {
    if (!user.avatar) return null;
    return user.avatar.startsWith('http') 
      ? user.avatar 
      : `${API_URL}/uploads/avatars/${user.avatar}`;
  };

  const avatarUrl = getAvatarUrl();
  const displayName = user.username || user.name || 'Пользователь';
  
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
    hapticFeedback('light');
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
    {
      label: 'Пожаловаться',
      icon: '🚩',
      actionType: 'report', // Оранжевый цвет
      onClick: handleReport
    }
  ].filter(Boolean);

  // ===== ШАПКА ПРОФИЛЯ (ПЕРЕДАЕМ В DROPDOWN) =====
  const headerContent = (
    <div style={styles.headerContainer}>
      <div style={styles.username}>@{displayName}</div>
      {userInfo && <div style={styles.userInfo}>{userInfo}</div>}
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
  username: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  userInfo: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
  }
};

export default ProfileMiniCard;