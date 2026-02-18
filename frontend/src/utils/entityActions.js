export function normalizeId(value) {
  if (value === undefined || value === null) return null;
  return String(value);
}

export function getCurrentUserId(currentUser) {
  if (!currentUser) return null;
  return normalizeId(currentUser.id ?? currentUser.user_id ?? null);
}

export function getEntityOwnerId(entityType, entity) {
  if (!entity) return null;

  switch (entityType) {
    case 'post':
      return normalizeId(entity.author_id ?? entity.author?.id ?? null);
    case 'request':
      return normalizeId(entity.author_id ?? entity.author?.id ?? null);
    case 'market_item':
      return normalizeId(entity.seller_id ?? entity.seller?.id ?? null);
    case 'comment':
      return normalizeId(entity.author_id ?? entity.author?.id ?? null);
    default:
      return null;
  }
}

export function isEntityOwner(entityType, entity, currentUser) {
  if (entityType === 'request' && entity?.is_author === true) return true;

  const ownerId = getEntityOwnerId(entityType, entity);
  const currentUserId = getCurrentUserId(currentUser);
  if (ownerId && currentUserId && ownerId === currentUserId) return true;

  // Некоторые ответы на посты содержат только author_telegram_id.
  if (entityType === 'post') {
    const authorTelegramId = normalizeId(entity?.author_telegram_id);
    const currentTelegramId = normalizeId(currentUser?.telegram_id);
    if (authorTelegramId && currentTelegramId && authorTelegramId === currentTelegramId) {
      return true;
    }
  }

  return false;
}

export function getEntityActionSet(entityType, isOwner, options = {}) {
  const shareEnabled = options.shareEnabled === true;

  if (entityType === 'comment') {
    if (isOwner) {
      return {
        canCopyLink: false,
        canShare: false,
        canEdit: true,
        canDelete: true,
        canReportContent: false,
      };
    }
    return {
      canCopyLink: false,
      canShare: false,
      canEdit: false,
      canDelete: false,
      canReportContent: true,
    };
  }

  if (isOwner) {
    return {
      canCopyLink: true,
      canShare: shareEnabled,
      canEdit: true,
      canDelete: true,
      canReportContent: false,
    };
  }

  return {
    canCopyLink: true,
    canShare: shareEnabled,
    canEdit: false,
    canDelete: false,
    canReportContent: true,
  };
}
