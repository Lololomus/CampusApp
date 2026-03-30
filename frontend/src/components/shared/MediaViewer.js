// ===== FILE: MediaViewer.js =====
// Полноэкранный просмотрщик медиа: фото и видео.
// Заменяет PhotoViewer. PhotoViewer.js — тонкая обёртка для обратной совместимости.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Download, ChevronUp } from 'lucide-react';
import { useSwipe } from '../../hooks/useSwipe';
import { Z_PHOTO_VIEWER } from '../../constants/zIndex';
import Avatar, { AVATAR_BORDER_RADIUS } from './Avatar';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';

const DATA_OR_BLOB_PREFIX = /^(data:|blob:)/i;
const HTTP_PREFIX = /^https?:\/\//i;

const extractUploadsPathFromAbsolute = (value) => {
  try {
    const parsed = new URL(value);
    const path = String(parsed.pathname || '').replace(/\\/g, '/');
    const markerIndex = path.indexOf('/uploads/');
    if (markerIndex >= 0) {
      return path.slice(markerIndex);
    }
  } catch {
    return '';
  }
  return '';
};

// ─── URL-резолвер для медиа (image / video / thumbs) ──────────────────────────
// Принимает относительный путь вида "2026/03/uuid.mp4" или уже полный "/uploads/..."
const toAbsoluteUrl = (path, kind = 'images') => {
  if (!path) return '';
  const s = String(path).replace(/\\/g, '/').trim();
  if (!s) return '';
  if (DATA_OR_BLOB_PREFIX.test(s)) return s;
  if (s.startsWith('/')) return s;
  if (s.startsWith('uploads/')) return `/${s}`;
  if (HTTP_PREFIX.test(s)) {
    return extractUploadsPathFromAbsolute(s) || s;
  }
  return `/uploads/${kind}/${s}`;
};

// ─── Нормализация элемента медиа ─────────────────────────────────────────────
const normalizeItem = (item) => {
  if (!item) return null;
  if (typeof item === 'string') {
    return { type: 'image', url: toAbsoluteUrl(item, 'images') };
  }
  if (item.type === 'video') {
    return {
      type: 'video',
      url: toAbsoluteUrl(item.url, 'videos'),
      thumbnail_url: toAbsoluteUrl(item.thumbnail_url, 'thumbs'),
      duration: item.duration,
      w: item.w,
      h: item.h,
    };
  }
  return {
    type: 'image',
    url: toAbsoluteUrl(item.url, 'images'),
    w: item.w,
    h: item.h,
  };
};

// ─── Pinch-to-zoom обёртка ────────────────────────────────────────────────────
const Zoomable = ({ children, onTap, onZoomStart, onZoomEnd }) => {
  const [scale, setScale] = useState(1);
  const startDist = useRef(null);
  const isPinching = useRef(false);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      startDist.current = Math.hypot(dx, dy);
      if (!isPinching.current) {
        isPinching.current = true;
        onZoomStart?.();
      }
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && startDist.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      setScale(Math.min(Math.max(1, currentDist / startDist.current), 4));
    }
  };

  const handleTouchEnd = () => {
    setScale(1);
    startDist.current = null;
    if (isPinching.current) {
      isPinching.current = false;
      onZoomEnd?.();
    }
  };

  const handleDoubleClick = () => {
    setScale(prev => prev === 1 ? 2 : 1);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      onClick={onTap}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: scale === 1 ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        maxWidth: '100%',
        maxHeight: '100%',
        cursor: 'pointer',
      }}
    >
      {children}
    </div>
  );
};

// ─── Слайд с видео ───────────────────────────────────────────────────────────
const VideoSlide = ({ media, isActive, showUI, footerHeight, footerOpen, hasFooter, toggleUI, onFooterOpen }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Пауза при смене слайда
  useEffect(() => {
    if (!isActive && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
      setProgress(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  // Обновление прогресса
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || isDragging) return;
    const pct = v.duration ? (v.currentTime / v.duration) * 100 : 0;
    setProgress(pct);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  const togglePlay = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const val = parseFloat(e.target.value);
    setProgress(val);
    v.currentTime = (val / 100) * v.duration;
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  // Реальная визуальная высота футера (0 если свёрнут или UI скрыт)
  const effectiveFooterH = (showUI && footerOpen && hasFooter) ? footerHeight : 0;
  const barBottom = showUI ? effectiveFooterH + 12 : 16;
  const chevronVisible = showUI && hasFooter && !footerOpen;

  const EASE = '0.4s cubic-bezier(0.32, 0.72, 0, 1)';

  return (
    <div
      onClick={toggleUI}
      style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}
    >
      <video
        ref={videoRef}
        src={media.url}
        poster={media.thumbnail_url || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onClick={togglePlay}
        playsInline
        preload="metadata"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'pointer' }}
      />

      {/* Кнопка Play по центру */}
      {!isPlaying && (
        <button onClick={togglePlay} style={styles.playButton} className="mv-play-btn">
          <Play size={32} fill="#D4FF00" style={{ marginLeft: 4 }} />
        </button>
      )}

      {/* ── Единая строка контролов: [ползунок──────] [🔈] [⌃?] ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: barBottom,
          left: 16,
          right: 16,
          height: 40,
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: `bottom ${EASE}`,
        }}
      >
        {/* Ползунок прогресса — занимает всё свободное место */}
        <div style={{
          flex: 1,
          position: 'relative',
          height: 40,
          display: 'flex',
          alignItems: 'center',
          opacity: showUI ? 1 : 0.35,
          transition: `opacity ${EASE}`,
          minWidth: 0,
        }}>
          {/* Трек */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            marginTop: -2,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(to right, #D4FF00 ${progress}%, rgba(255,255,255,0.18) ${progress}%)`,
            pointerEvents: 'none',
            zIndex: 1,
            boxShadow: showUI ? '0 0 8px rgba(212,255,0,0.25)' : 'none',
            transition: `box-shadow ${EASE}`,
          }} />
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSeek}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            className="mv-slider"
            style={{ position: 'relative', zIndex: 2, width: '100%' }}
          />
        </div>

        {/* Кнопка звука */}
        <div style={{
          opacity: showUI ? 1 : 0,
          pointerEvents: showUI ? 'auto' : 'none',
          transition: `opacity ${EASE}`,
          flexShrink: 0,
        }}>
          <button onClick={toggleMute} style={styles.iconButton}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Шеврон — появляется когда футер свёрнут */}
        <div style={{
          width: chevronVisible ? 40 : 0,
          opacity: chevronVisible ? 1 : 0,
          overflow: 'hidden',
          flexShrink: 0,
          transition: `width ${EASE}, opacity ${EASE}`,
          pointerEvents: chevronVisible ? 'auto' : 'none',
        }}>
          <button
            onClick={(e) => { e.stopPropagation(); onFooterOpen?.(); }}
            style={{ ...styles.iconButton, width: 40 }}
          >
            <ChevronUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Главный компонент ────────────────────────────────────────────────────────
function MediaViewer({ mediaList = [], initialIndex = 0, onClose, meta, dismissMode = 'default' }) {
  const items = mediaList.map(normalizeItem).filter(Boolean);
  const isSwipeOnlyDismiss = dismissMode === 'swipe';

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showUI, setShowUI] = useState(true);
  const [footerOpen, setFooterOpen] = useState(true);
  const [footerHeight, setFooterHeight] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [swipeClosing, setSwipeClosing] = useState(false);
  const dragYRef = useRef(0);
  const isDraggingDownRef = useRef(false);
  const mouseDragStartYRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const suppressTapRef = useRef(false);

  const closeWithAnimation = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(onClose, 280);
  }, [isClosing, onClose]);

  // Закрытие свайпом вниз: слайд улетает вниз + фон гаснет
  const closeViaSwipe = useCallback(() => {
    if (isClosing || swipeClosing) return;
    isDraggingDownRef.current = false;
    setDragY(window.innerHeight);
    setSwipeClosing(true);
    setTimeout(onClose, 300);
  }, [isClosing, swipeClosing, onClose]);

  const scrollRef = useRef(null);
  const footerRef = useRef(null);
  const swipeTouchStartY = useRef(null);

  const resetVerticalDrag = useCallback(() => {
    dragYRef.current = 0;
    setDragY(0);
  }, []);

  const updateVerticalDrag = useCallback((dy) => {
    if (dy <= 0) {
      isDraggingDownRef.current = false;
      resetVerticalDrag();
      return;
    }

    if (dy > 6) {
      suppressTapRef.current = true;
    }

    isDraggingDownRef.current = true;
    dragYRef.current = dy;
    setDragY(dy);
  }, [resetVerticalDrag]);

  const finishVerticalDrag = useCallback(() => {
    mouseDragStartYRef.current = null;
    swipeTouchStartY.current = null;

    if (!isDraggingDownRef.current) {
      resetVerticalDrag();
      return;
    }

    isDraggingDownRef.current = false;
    if (dragYRef.current > 120) {
      closeViaSwipe();
      return;
    }

    resetVerticalDrag();
  }, [closeViaSwipe, resetVerticalDrag]);

  const cleanupDesktopDrag = useCallback(() => {
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
    mouseDragStartYRef.current = null;
  }, []);

  const footerSwipe = useSwipe({
    elementRef: footerRef,
    isModal: true,
    threshold: 60,
    onSwipeDown: () => setFooterOpen(false),
  });

  // Авто-сворачивание футера при пинче, восстановление при отпускании
  // Блокировка скролла страницы пока MediaViewer открыт
  useEffect(() => {
    lockBodyScroll();
    return () => {
      cleanupDesktopDrag();
      unlockBodyScroll();
    };
  }, [cleanupDesktopDrag]);

  useEffect(() => {
    if (isZoomed) {
      setFooterOpen(false);
    } else {
      setFooterOpen(true);
    }
  }, [isZoomed]);

  // Инициализация позиции scroll без анимации
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.style.scrollBehavior = 'auto';
    scrollRef.current.scrollLeft = scrollRef.current.clientWidth * initialIndex;
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.style.scrollBehavior = 'smooth';
    }, 50);
  }, [initialIndex]);

  // Замер высоты футера
  useEffect(() => {
    if (footerRef.current) {
      setFooterHeight(footerRef.current.offsetHeight);
    }
  }, [currentIndex, showUI, meta]);

  // Отслеживание текущего слайда по scroll
  const handleScroll = useCallback((e) => {
    if (!scrollRef.current) return;
    const newIndex = Math.round(e.target.scrollLeft / e.target.clientWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      setDragY(0);
      dragYRef.current = 0;
    }
  }, [currentIndex]);

  // Клавиатура
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isSwipeOnlyDismiss) closeWithAnimation();
      if (e.key === 'ArrowLeft' && scrollRef.current) scrollRef.current.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' });
      if (e.key === 'ArrowRight' && scrollRef.current) scrollRef.current.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeWithAnimation, isSwipeOnlyDismiss]);

  const toggleUI = useCallback(() => {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    setShowUI(prev => !prev);
  }, []);

  const handleDesktopDragStart = useCallback((e, isCurrentSlide) => {
    if (!isCurrentSlide || isZoomed || e.button !== 0) return;

    cleanupDesktopDrag();
    suppressTapRef.current = false;
    mouseDragStartYRef.current = e.clientY;

    const handleMouseMove = (moveEvent) => {
      if (mouseDragStartYRef.current === null) return;
      updateVerticalDrag(moveEvent.clientY - mouseDragStartYRef.current);
    };

    const handleMouseUp = () => {
      cleanupDesktopDrag();
      finishVerticalDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [cleanupDesktopDrag, finishVerticalDrag, isZoomed, updateVerticalDrag]);

  const currentItem = items[currentIndex];
  const hasFooter = Boolean(meta);
  const isCurrentVideo = currentItem?.type === 'video';
  const openFooter = useCallback(() => setFooterOpen(true), []);

  // Скачивание текущего медиа
  const handleDownload = (e) => {
    e.stopPropagation();
    if (!currentItem?.url) return;
    const link = document.createElement('a');
    link.href = currentItem.url;
    link.download = currentItem.url.split('/').pop() || 'media';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!items.length) return null;

  return createPortal(
    <>
      {/* CSS для анимаций и slider */}
      <style>{`
        @keyframes mv-play-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(212,255,0,0.4); }
          70%  { box-shadow: 0 0 0 15px rgba(212,255,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(212,255,0,0); }
        }
        @keyframes mv-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mv-fade-in-scale {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes mv-slide-out {
          from { opacity: 1; transform: scale(1) translateY(0); }
          to   { opacity: 0; transform: scale(0.96) translateY(48px); }
        }
        .mv-play-btn {
          animation: mv-play-pulse 2s infinite;
        }
        .mv-swiper::-webkit-scrollbar { display: none; }
        .mv-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 24px;
          background: transparent;
          outline: none;
          margin: 0;
        }
        .mv-slider::-webkit-slider-runnable-track {
          width: 100%; height: 24px; background: transparent;
        }
        .mv-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #fff;
          margin-top: 5px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          transition: transform 0.2s cubic-bezier(0.32,0.72,0,1);
        }
        .mv-slider:active::-webkit-slider-thumb {
          transform: scale(1.4);
        }
      `}</style>

      {/* Overlay — закрывает по клику */}
      <div style={{
        ...styles.overlay,
        animation: isClosing ? 'mv-slide-out 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards' : styles.overlay.animation,
        opacity: swipeClosing ? 0 : (dragY > 0 ? Math.max(0.05, 1 - dragY / 250) : undefined),
        transition: swipeClosing ? 'opacity 0.3s ease' : (dragY > 0 ? 'none' : undefined),
      }} onClick={isSwipeOnlyDismiss ? undefined : closeWithAnimation} />

      {/* Контейнер */}
      <div
        data-no-edge-swipe="true"
        style={{
          ...styles.container,
          animation: isClosing
            ? 'mv-slide-out 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards'
            : styles.container.animation,
          background: dragY > 0 ? `rgba(0,0,0,${Math.max(0.15, 1 - dragY / 250)})` : '#000',
          opacity: swipeClosing ? 0 : 1,
          transition: swipeClosing ? 'opacity 0.3s ease' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header: центрированная пилюля-счётчик + X при отсутствии футера ── */}
        {items.length > 1 && (
          <div style={{
            ...styles.counter,
            position: 'absolute',
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            left: '50%',
            transform: `translateX(-50%) ${showUI ? 'translateY(0)' : 'translateY(-100px)'}`,
            opacity: showUI ? 1 : 0,
            transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            zIndex: 10,
          }}>
            {currentIndex + 1} / {items.length}
          </div>
        )}
        {/* Кнопка закрытия в хедере — только если нет футера */}
        {!hasFooter && !isSwipeOnlyDismiss && (
          <button style={{
            ...styles.closeButton,
            position: 'absolute',
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            right: 16,
            opacity: showUI ? 1 : 0,
            transform: showUI ? 'translateY(0)' : 'translateY(-100px)',
            transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            zIndex: 10,
          }} onClick={closeWithAnimation}>
            <X size={22} />
          </button>
        )}

        {/* ── Scroll-snap swiper ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="mv-swiper"
          style={{ ...styles.swiper, touchAction: 'pan-x pan-y' }}
        >
          {items.map((media, idx) => {
            const isCurrentSlide = idx === currentIndex;
            const slideDragY = isCurrentSlide && dragY > 0 ? dragY : 0;
            return (
              <div
                key={idx}
                style={{
                  ...styles.slide,
                  transform: slideDragY > 0 ? `translateY(${slideDragY}px)` : undefined,
                  transition: isDraggingDownRef.current ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
                }}
                onTouchStart={(e) => {
                  if (e.touches.length === 1) {
                    suppressTapRef.current = false;
                    swipeTouchStartY.current = e.touches[0].clientY;
                  }
                }}
                onTouchMove={(e) => {
                  if (!isCurrentSlide || isZoomed || e.touches.length !== 1 || swipeTouchStartY.current === null) return;
                  updateVerticalDrag(e.touches[0].clientY - swipeTouchStartY.current);
                }}
                onTouchEnd={finishVerticalDrag}
                onTouchCancel={finishVerticalDrag}
                onMouseDown={(e) => handleDesktopDragStart(e, isCurrentSlide)}
              >
                {media.type === 'video' ? (
                  <VideoSlide
                    media={media}
                    isActive={idx === currentIndex}
                    showUI={showUI}
                    footerHeight={footerHeight}
                    footerOpen={footerOpen}
                    hasFooter={hasFooter}
                    toggleUI={toggleUI}
                    onFooterOpen={openFooter}
                  />
                ) : (
                  <div
                    onClick={toggleUI}
                    style={styles.imageSlide}
                  >
                    <Zoomable
                      onTap={(e) => { e.stopPropagation(); toggleUI(); }}
                      onZoomStart={() => setIsZoomed(true)}
                      onZoomEnd={() => setIsZoomed(false)}
                    >
                      <img
                        src={media.url}
                        alt={`Медиа ${idx + 1}`}
                        style={styles.image}
                        loading={idx === initialIndex ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    </Zoomable>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Кнопки Prev/Next (desktop) ── */}
        {showUI && currentIndex > 0 && (
          <button
            style={{ ...styles.navBtn, left: 16 }}
            onClick={() => scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' })}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {showUI && currentIndex < items.length - 1 && (
          <button
            style={{ ...styles.navBtn, right: 16 }}
            onClick={() => scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' })}
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* ── Индикаторы-точки ── */}
        {items.length > 1 && (
          <div style={styles.indicators}>
            {items.map((_, idx) => (
              <div
                key={idx}
                style={{ ...styles.dot, opacity: idx === currentIndex ? 1 : 0.4 }}
                onClick={() => {
                  if (!scrollRef.current) return;
                  scrollRef.current.scrollLeft = scrollRef.current.clientWidth * idx;
                }}
              />
            ))}
          </div>
        )}

        {/* ── Футер (если передан meta) ── */}
        {hasFooter && (
          <div
            ref={footerRef}
            style={{
              ...styles.footer,
              opacity: showUI ? 1 : 0,
              transform: (showUI && footerOpen) ? 'translateY(0)' : 'translateY(100%)',
            }}
            {...footerSwipe}
          >
            {/* Шторка-индикатор для свайпа вниз */}
            <div style={styles.swipeHandle} />

            {/* Автор */}
            {meta.author && (() => {
              const authorSubtitle = [
                meta.author.university,
                meta.author.course ? `${meta.author.course}к` : null,
              ].filter(Boolean).join(' · ');
              return (
                <div style={styles.authorRow}>
                  <Avatar
                    user={meta.author}
                    size={44}
                    showProfile={false}
                  />
                  <div style={styles.authorInfo}>
                    <span style={styles.authorName}>
                      {meta.author.username || meta.author.name}
                    </span>
                    {authorSubtitle && (
                      <span style={styles.authorMeta}>{authorSubtitle}</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Описание */}
            {meta.caption && (
              <p style={styles.caption}>{meta.caption}</p>
            )}

            {/* Кнопки */}
            <div style={styles.footerButtons}>
              <button style={styles.downloadButton} onClick={handleDownload}>
                <Download size={16} />
                Скачать
              </button>
              {!isSwipeOnlyDismiss && (
                <button style={styles.closeButtonFooter} onClick={closeWithAnimation}>
                  <X size={16} strokeWidth={3} />
                  Закрыть
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Chevron для не-видео слайдов (видео имеет свой встроенный) ── */}
        {hasFooter && showUI && !footerOpen && !isCurrentVideo && (
          <button
            style={styles.footerChevron}
            onClick={openFooter}
          >
            <ChevronUp size={20} />
          </button>
        )}
      </div>
    </>,
    document.body
  );
}

// ─── Стили ───────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: Z_PHOTO_VIEWER - 1,
    animation: 'mv-fade-in 0.2s ease',
  },
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: Z_PHOTO_VIEWER,
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    animation: 'mv-fade-in-scale 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  counter: {
    background: 'rgba(28,28,30,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding: '6px 14px',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.5px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(28,28,30,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  swiper: {
    flex: 1,
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollBehavior: 'smooth',
    width: '100%',
    height: '100%',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
  },
  slide: {
    flex: '0 0 100%',
    width: '100%',
    height: '100%',
    scrollSnapAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imageSlide: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'none',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(28,28,30,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
  indicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
    pointerEvents: 'none',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
    transition: 'opacity 0.2s',
    cursor: 'pointer',
    pointerEvents: 'all',
  },
  playButton: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    background: 'rgba(28,28,30,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#D4FF00',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 5,
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: 'rgba(28,28,30,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    padding: '16px 16px',
    paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
    background: 'rgba(10,10,12,0.6)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
  },
  swipeHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: 4,
    flexShrink: 0,
  },
  footerChevron: {
    position: 'absolute',
    bottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    background: 'rgba(28,28,30,0.75)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 15,
    transition: 'opacity 0.3s ease, transform 0.3s ease',
  },
  authorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  authorInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  authorName: {
    fontWeight: 700,
    fontSize: 16,
    color: '#fff',
    lineHeight: 1.2,
  },
  authorMeta: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 1.2,
  },
  caption: {
    margin: 0,
    fontSize: 15,
    color: '#EAEAEA',
    lineHeight: 1.45,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  footerButtons: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  downloadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    height: 40,
    padding: '0 16px',
    borderRadius: 20,
    background: 'rgba(44,44,46,1)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
  closeButtonFooter: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    background: '#D4FF00',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    color: '#000',
    fontWeight: 800,
    fontSize: 14,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(212,255,0,0.2)',
    transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
};

export default MediaViewer;
