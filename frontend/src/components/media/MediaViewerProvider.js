import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import MediaViewer from './MediaViewer';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { Z_PHOTO_VIEWER } from '../../constants/zIndex';
import { isAndroid } from '../../utils/platform';

const MediaViewerContext = createContext(null);

export function getMediaViewerPerformanceMode() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'normal';

  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return 'reduced';

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const effectiveType = connection?.effectiveType;
    if (connection?.saveData === true || effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'reduced';
    }

    const memory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
    const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;
    if (isAndroid() && ((memory !== null && memory <= 4) || (cores !== null && cores <= 4))) {
      return 'reduced';
    }
  } catch {
    return 'normal';
  }

  return 'normal';
}

export function MediaViewerProvider({ children }) {
  const [viewer, setViewer] = useState(null);
  const [isClosing, setIsClosing] = useState(false);
  const [closeSignal, setCloseSignal] = useState(0);
  const viewerRef = useRef(null);
  const closeStartedRef = useRef(false);
  const openSeqRef = useRef(0);

  const isOpen = Boolean(viewer);
  useBodyScrollLock(isOpen);

  useEffect(() => {
    viewerRef.current = viewer;
  }, [viewer]);

  const closeMediaViewer = useCallback(() => {
    if (!viewerRef.current || closeStartedRef.current) return;
    closeStartedRef.current = true;
    setIsClosing(true);
    setCloseSignal((value) => value + 1);
  }, []);

  useTelegramScreen(isOpen ? {
    id: 'media-viewer-screen',
    title: '',
    priority: Z_PHOTO_VIEWER,
    back: {
      visible: true,
      onClick: closeMediaViewer,
    },
  } : { id: null });

  const openMediaViewer = useCallback((config) => {
    if (!config?.ownerId || !Array.isArray(config.mediaList) || config.mediaList.length === 0) return false;
    if (viewerRef.current || closeStartedRef.current) return false;

    openSeqRef.current += 1;
    const boundedIndex = Math.max(0, Math.min(Number(config.initialIndex) || 0, config.mediaList.length - 1));
    const nextViewer = {
      ownerId: String(config.ownerId),
      mediaList: config.mediaList,
      initialIndex: boundedIndex,
      currentIndex: boundedIndex,
      sourceRect: config.sourceRect || null,
      getSourceRect: config.getSourceRect,
      onIndexChange: config.onIndexChange,
      onClose: config.onClose,
      meta: config.meta,
      closeMode: config.closeMode,
      openSeq: openSeqRef.current,
      performanceMode: config.performanceMode || getMediaViewerPerformanceMode(),
    };

    viewerRef.current = nextViewer;
    setViewer(nextViewer);
    setIsClosing(false);
    setCloseSignal(0);
    closeStartedRef.current = false;
    return true;
  }, []);

  const handleViewerCloseStart = useCallback(() => {
    if (closeStartedRef.current) return;
    closeStartedRef.current = true;
    setIsClosing(true);
  }, []);

  const handleIndexChange = useCallback((index) => {
    const activeViewer = viewerRef.current;
    setViewer((current) => {
      if (!current || current.currentIndex === index) return current;
      const nextViewer = { ...current, currentIndex: index };
      viewerRef.current = nextViewer;
      return nextViewer;
    });
    activeViewer?.onIndexChange?.(index);
  }, []);

  const handleViewerClosed = useCallback(() => {
    const closedViewer = viewerRef.current;
    closeStartedRef.current = false;
    viewerRef.current = null;
    setViewer(null);
    setIsClosing(false);
    setCloseSignal(0);
    closedViewer?.onClose?.();
  }, []);

  const isMediaSourceHidden = useCallback((ownerId, index) => (
    Boolean(
      viewer
      && String(ownerId) === viewer.ownerId
      && Number(index) === Number(viewer.currentIndex)
    )
  ), [viewer]);

  const value = useMemo(() => ({
    isOpen,
    isClosing,
    activeOwnerId: viewer?.ownerId || null,
    activeIndex: viewer?.currentIndex ?? null,
    performanceMode: viewer?.performanceMode || 'normal',
    openMediaViewer,
    closeMediaViewer,
    isMediaSourceHidden,
  }), [
    isOpen,
    isClosing,
    viewer?.ownerId,
    viewer?.currentIndex,
    viewer?.performanceMode,
    openMediaViewer,
    closeMediaViewer,
    isMediaSourceHidden,
  ]);

  return (
    <MediaViewerContext.Provider value={value}>
      {children}
      {viewer && (
        <MediaViewer
          key={`${viewer.ownerId}:${viewer.openSeq}`}
          mediaList={viewer.mediaList}
          initialIndex={viewer.initialIndex}
          onClose={handleViewerClosed}
          onCloseStart={handleViewerCloseStart}
          sourceRect={viewer.sourceRect}
          sourceRectProvider={viewer.getSourceRect}
          onIndexChange={handleIndexChange}
          requestCloseSignal={closeSignal}
          performanceMode={viewer.performanceMode}
          closeMode={viewer.closeMode}
          meta={viewer.meta}
        />
      )}
    </MediaViewerContext.Provider>
  );
}

export function useMediaViewer() {
  const context = useContext(MediaViewerContext);
  if (!context) {
    throw new Error('useMediaViewer must be used within MediaViewerProvider');
  }
  return context;
}

export function useMediaViewerState() {
  return useContext(MediaViewerContext) || {
    isOpen: false,
    isClosing: false,
    activeOwnerId: null,
    activeIndex: null,
    performanceMode: 'normal',
    openMediaViewer: () => false,
    closeMediaViewer: () => {},
    isMediaSourceHidden: () => false,
  };
}

export default MediaViewerProvider;
