// ===== FILE: frontend/src/components/media/PhotoViewer.js =====
// Backward-compatibility re-export. Используй MediaViewer напрямую для видео и meta.

import MediaViewer from './MediaViewer';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { getMediaViewerPerformanceMode } from './MediaViewerProvider';

export default function PhotoViewer({ photos = [], initialIndex = 0, onClose, meta, dismissMode = 'default', sourceRect, sourceRectProvider, onIndexChange }) {
  useBodyScrollLock();
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
      performanceMode={getMediaViewerPerformanceMode()}
    />
  );
}
