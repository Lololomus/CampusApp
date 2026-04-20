// ===== 📄 ФАЙЛ: src/components/shared/PhotoViewer.js =====
// Backward-compatibility re-export. Используй MediaViewer напрямую для видео и meta.

import MediaViewer from './MediaViewer';

export default function PhotoViewer({ photos = [], initialIndex = 0, onClose, meta, dismissMode = 'default', sourceRect, sourceRectProvider, onIndexChange }) {
  const mediaList = photos.map(p => typeof p === 'string' ? { type: 'image', url: p } : p);
  return (
    <MediaViewer
      mediaList={mediaList}
      initialIndex={initialIndex}
      onClose={onClose}
      meta={meta}
      dismissMode={dismissMode}
      sourceRect={sourceRect}
      sourceRectProvider={sourceRectProvider}
      onIndexChange={onIndexChange}
    />
  );
}
