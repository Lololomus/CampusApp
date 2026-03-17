// ===== 📄 ФАЙЛ: frontend/src/components/shared/Avatar.js =====

import React, { forwardRef } from 'react';
import theme from '../../theme';
import { getAvatarColor } from '../../utils/avatarColors';
import { resolveImageUrl } from '../../utils/mediaUrl';

// Hero-формат: меняй здесь — обновится везде
export const AVATAR_BORDER_RADIUS = theme.radius.md; // 12px

const Avatar = forwardRef(({ 
  user, 
  size = 40, 
  onClick, 
  showProfile = true, 
  isAnonymous = false,
  style = {}
}, ref) => {
  // Получение данных для отображения
  const getAvatarData = () => {
    if (isAnonymous) {
      return { 
        type: 'initial', 
        value: '?', 
        bg: theme.colors.textDisabled 
      };
    }

    // ИСПРАВЛЕНИЕ: правильный путь uploads/avatars
    if (user?.avatar && user.avatar.trim() !== '') {
      const avatarUrl = resolveImageUrl(user.avatar, 'avatars');
      if (avatarUrl) {
        return { type: 'image', value: avatarUrl };
      }
    }

    // Fallback на инициал если фото нет
    const displayName = user?.username || user?.name || 'A';
    const initial = displayName[0]?.toUpperCase() || 'A';
    const bg = getAvatarColor(displayName);
    
    return { type: 'initial', value: initial, bg };
  };

  const avatarData = getAvatarData();
  const clickable = showProfile && !isAnonymous && onClick;

  const handleClick = (e) => {
    if (clickable) {
      e.stopPropagation();
      onClick(user);
    }
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        ...styles.avatar,
        width: size,
        height: size,
        cursor: clickable ? 'pointer' : 'default',
        background: avatarData.type === 'initial' 
          ? avatarData.bg 
          : theme.colors.bgSecondary,
        ...style
      }}
      className="avatar-component"
    >
      {avatarData.type === 'image' ? (
        <img 
          src={avatarData.value} 
          alt="" 
          style={styles.avatarImage}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            // Fallback к инициалу если фото не загрузилось
            const parent = e.target.parentElement;
            if (parent) {
              e.target.style.display = 'none';
              const displayName = user?.username || user?.name || 'A';
              const initial = displayName[0]?.toUpperCase() || 'A';
              const bg = getAvatarColor(displayName);
              parent.style.background = bg;
              parent.innerHTML = `<span style="user-select: none; font-size: ${size * 0.45}px; font-weight: 700; color: #fff;">${initial}</span>`;
            }
          }}
        />
      ) : (
        <span style={{...styles.initial, fontSize: size * 0.45}}>{avatarData.value}</span>
      )}
    </div>
  );
});

Avatar.displayName = 'Avatar';

const styles = {
  avatar: {
    borderRadius: AVATAR_BORDER_RADIUS,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    flexShrink: 0,
    overflow: 'hidden',
    position: 'relative',
    transition: 'transform 0.2s ease',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  initial: {
    userSelect: 'none',
  }
};

export default Avatar;
