// ===== FILE: frontend/src/components/media/MediaViewer.js =====
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from 'lucide-react';
import { Z_PHOTO_VIEWER } from '../../constants/zIndex';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';
import theme from '../../theme';
import { modalBoundaryProps, modalTouchBoundaryHandlers } from '../../utils/modalEventBoundary';

const DATA_OR_BLOB_PREFIX = /^(data:|blob:)/i;
const HTTP_PREFIX = /^https?:\/\//i;

const extractUploadsPathFromAbsolute = (value) => {
  try {
    const parsed = new URL(value);
    const path = String(parsed.pathname || '').replace(/\\/g, '/');
    const idx = path.indexOf('/uploads/');
    return idx >= 0 ? path.slice(idx) : '';
  } catch { return ''; }
};

const toAbsoluteUrl = (path, kind = 'images') => {
  if (!path) return '';
  const s = String(path).replace(/\\/g, '/').trim();
  if (!s) return '';
  if (DATA_OR_BLOB_PREFIX.test(s)) return s;
  if (s.startsWith('/')) return s;
  if (s.startsWith('uploads/')) return `/${s}`;
  if (HTTP_PREFIX.test(s)) return extractUploadsPathFromAbsolute(s) || s;
  return `/uploads/${kind}/${s}`;
};

const normalizeItem = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return { type: 'image', url: toAbsoluteUrl(item, 'images') };
  if (item.type === 'video') return {
    type: 'video',
    url: toAbsoluteUrl(item.url, 'videos'),
    thumbnail_url: toAbsoluteUrl(item.thumbnail_url, 'thumbs'),
    duration: item.duration,
    w: item.w,
    h: item.h,
  };
  return { type: 'image', url: toAbsoluteUrl(item.url, 'images'), w: item.w, h: item.h };
};

const normalizeRect = (rect) => {
  if (!rect) return null;
  const x = Number.isFinite(rect.x) ? rect.x : rect.left;
  const y = Number.isFinite(rect.y) ? rect.y : rect.top;
  const width = rect.width;
  const height = rect.height;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !width || !height) return null;
  const normalized = { x, y, width, height };
  if (rect.objectFit) normalized.objectFit = rect.objectFit;
  if (rect.objectPosition) normalized.objectPosition = rect.objectPosition;
  if (rect.borderRadius !== undefined) normalized.borderRadius = rect.borderRadius;
  if (Number.isFinite(rect.zIndex)) normalized.zIndex = rect.zIndex;
  if (rect.hasContainFill !== undefined) normalized.hasContainFill = Boolean(rect.hasContainFill);
  return normalized;
};

const getHeroReturnTransform = (from, to, active) => {
  if (!from || !to || active) return 'translate3d(0, 0, 0) scale3d(1, 1, 1)';
  const scaleX = Number.isFinite(from.width / to.width) ? from.width / to.width : 1;
  const scaleY = Number.isFinite(from.height / to.height) ? from.height / to.height : 1;
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  return `translate3d(${dx}px, ${dy}px, 0) scale3d(${scaleX}, ${scaleY}, 1)`;
};

const SWIPE_DIRECTION_THRESHOLD = 10;
const SWIPE_AXIS_LOCK_RATIO = 1.15;

const Zoomable = ({ children, onTap, onZoomStart, onZoomEnd }) => {
  const [scale, setScale] = useState(1);
  const startDist = useRef(null);
  const isPinching = useRef(false);

  return (
    <div
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          startDist.current = Math.hypot(dx, dy);
          if (!isPinching.current) {
            isPinching.current = true;
            onZoomStart?.();
          }
        }
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 2 && startDist.current) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          setScale(Math.min(Math.max(1, Math.hypot(dx, dy) / startDist.current), 4));
        }
      }}
      onTouchEnd={() => {
        setScale(1);
        startDist.current = null;
        if (isPinching.current) {
          isPinching.current = false;
          onZoomEnd?.();
        }
      }}
      onDoubleClick={() => setScale((prev) => (prev === 1 ? 2 : 1))}
      onClick={onTap}
      style={{
        ...styles.zoomable,
        transition: scale === 1 ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
};

const VideoSlide = ({ media, isActive, showUI, toggleUI }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isActive && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
    }
  }, [isActive]);

  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <div onClick={toggleUI} style={styles.videoSlide}>
      <video
        ref={videoRef}
        src={media.url}
        poster={media.thumbnail_url || undefined}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video || isDragging) return;
          setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          if (videoRef.current) videoRef.current.currentTime = 0;
        }}
        onClick={togglePlay}
        playsInline
        preload="metadata"
        style={styles.video}
      />
      {!isPlaying && (
        <button type="button" onClick={togglePlay} style={styles.playButton} className="mv-play-btn">
          <Play size={32} fill="#D4FF00" style={{ marginLeft: 4 }} />
        </button>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        style={{
          ...styles.videoControls,
          opacity: showUI ? 1 : 0.35,
          pointerEvents: showUI ? 'auto' : 'none',
        }}
      >
        <div style={styles.videoProgressWrap}>
          <div
            style={{
              ...styles.videoProgressFill,
              background: `linear-gradient(to right, #D4FF00 ${progress}%, rgba(255,255,255,0.18) ${progress}%)`,
            }}
          />
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={(e) => {
              const video = videoRef.current;
              if (!video || !video.duration) return;
              const value = parseFloat(e.target.value);
              setProgress(value);
              video.currentTime = (value / 100) * video.duration;
            }}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            className="mv-slider"
            style={styles.videoSlider}
          />
        </div>
        <button type="button" onClick={toggleMute} style={styles.iconButton}>
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
};

function MediaViewer({ mediaList = [], initialIndex = 0, onClose, sourceRect, sourceRectProvider, onIndexChange }) {
  const items = mediaList.map(normalizeItem).filter(Boolean);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showUI, setShowUI] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [swipeClosing, setSwipeClosing] = useState(false);
  const [heroAnim, setHeroAnim] = useState(null);
  const [heroAnimActive, setHeroAnimActive] = useState(false);

  const dragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const mouseDragStartYRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const suppressTapRef = useRef(false);
  const scrollRef = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const touchStartScrollLeftRef = useRef(0);
  const swipeDirRef = useRef(null);
  const currentImgRef = useRef(null);
  const bodyScrollLockedRef = useRef(false);

  const releaseBodyScroll = useCallback(() => {
    if (!bodyScrollLockedRef.current) return;
    bodyScrollLockedRef.current = false;
    unlockBodyScroll();
  }, []);

  const resolveSourceRect = useCallback((index = currentIndex) => {
    if (typeof sourceRectProvider === 'function') {
      return normalizeRect(sourceRectProvider(index));
    }
    if (typeof sourceRect === 'function') {
      return normalizeRect(sourceRect(index));
    }
    if (Array.isArray(sourceRect)) {
      return normalizeRect(sourceRect[index]);
    }
    return normalizeRect(sourceRect);
  }, [currentIndex, sourceRect, sourceRectProvider]);

  useEffect(() => {
    if (!heroAnim) return undefined;
    setHeroAnimActive(false);
    const id = requestAnimationFrame(() => setHeroAnimActive(true));
    return () => cancelAnimationFrame(id);
  }, [heroAnim]);

  const resetDrag = useCallback(() => {
    dragYRef.current = 0;
    isDraggingRef.current = false;
    setDragY(0);
  }, []);

  const closeViaSwipe = useCallback(() => {
    if (isClosing || swipeClosing || heroAnim) return;
    isDraggingRef.current = false;
    dragYRef.current = window.innerHeight;
    setIsClosing(true);
    setDragY(window.innerHeight);
    setSwipeClosing(true);
    releaseBodyScroll();
    setTimeout(() => onClose?.(), 300);
  }, [isClosing, swipeClosing, heroAnim, releaseBodyScroll, onClose]);

  const closeViaHero = useCallback((fallback = closeViaSwipe) => {
    if (isClosing || swipeClosing || heroAnim) return;

    const imgEl = currentImgRef.current;
    const currentItem = items[currentIndex];
    const to = resolveSourceRect(currentIndex);

    if (!imgEl || !to || currentItem?.type === 'video') {
      fallback();
      return;
    }

    const from = normalizeRect(imgEl.getBoundingClientRect());
    if (!from) {
      fallback();
      return;
    }

    isDraggingRef.current = false;
    dragYRef.current = 0;
    setDragY(0);
    setIsClosing(true);
    releaseBodyScroll();
    setHeroAnim({
      url: currentItem.url,
      from,
      to,
      objectFit: to.objectFit || 'cover',
      objectPosition: to.objectPosition || 'center center',
      borderRadius: to.borderRadius ?? 0,
      zIndex: to.zIndex ?? Z_PHOTO_VIEWER + 10,
      hasContainFill: Boolean(to.hasContainFill || to.objectFit === 'contain'),
    });
    setTimeout(() => onClose?.(), 360);
  }, [isClosing, swipeClosing, heroAnim, items, currentIndex, resolveSourceRect, closeViaSwipe, releaseBodyScroll, onClose]);

  const updateDrag = useCallback((dy) => {
    if (dy <= 0) {
      resetDrag();
      return;
    }
    if (dy > 6) suppressTapRef.current = true;
    isDraggingRef.current = true;
    dragYRef.current = dy;
    setDragY(dy);
  }, [resetDrag]);

  const finishDrag = useCallback(() => {
    mouseDragStartYRef.current = null;
    touchStartY.current = null;
    if (!isDraggingRef.current) {
      resetDrag();
      return;
    }
    isDraggingRef.current = false;
    if (dragYRef.current > 80) {
      closeViaHero(closeViaSwipe);
    } else {
      resetDrag();
    }
  }, [closeViaHero, closeViaSwipe, resetDrag]);

  const cleanupMouseDrag = useCallback(() => {
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
    mouseDragStartYRef.current = null;
  }, []);

  useLayoutEffect(() => {
    lockBodyScroll();
    bodyScrollLockedRef.current = true;
    return () => {
      cleanupMouseDrag();
      releaseBodyScroll();
    };
  }, [cleanupMouseDrag, releaseBodyScroll]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.style.scrollBehavior = 'auto';
    scrollRef.current.scrollLeft = scrollRef.current.clientWidth * initialIndex;
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.style.scrollBehavior = 'smooth';
    }, 50);
  }, [initialIndex]);

  useEffect(() => {
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') {
        scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' });
      }
      if (e.key === 'ArrowRight') {
        scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const toggleUI = useCallback(() => {
    if (suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
    setShowUI((prev) => !prev);
  }, []);

  const handleMouseDown = useCallback((e, isCurrentSlide) => {
    if (!isCurrentSlide || isZoomed || e.button !== 0) return;
    cleanupMouseDrag();
    suppressTapRef.current = false;
    mouseDragStartYRef.current = e.clientY;
    const onMove = (ev) => {
      if (mouseDragStartYRef.current !== null) updateDrag(ev.clientY - mouseDragStartYRef.current);
    };
    const onUp = () => {
      cleanupMouseDrag();
      finishDrag();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cleanupMouseDrag, finishDrag, isZoomed, updateDrag]);

  if (!items.length) return null;

  const isHeroClosing = Boolean(heroAnim);
  const closingPassthrough = swipeClosing || isHeroClosing;
  const overlayOpacity = swipeClosing || isHeroClosing
    ? 0
    : dragY > 0 ? Math.max(0.04, 1 - dragY / 280) : undefined;
  const overlayTransition = swipeClosing || isHeroClosing
    ? 'opacity 0.32s cubic-bezier(0.32, 0.72, 0, 1)'
    : dragY > 0 ? 'none' : undefined;
  const heroFrame = heroAnim?.to || null;
  const heroTransform = heroAnim
    ? getHeroReturnTransform(heroAnim.from, heroAnim.to, heroAnimActive)
    : undefined;

  return createPortal(
    <>
      <style>{`
        @keyframes mv-play-pulse { 0%{box-shadow:0 0 0 0 rgba(212,255,0,.4)} 70%{box-shadow:0 0 0 15px rgba(212,255,0,0)} 100%{box-shadow:0 0 0 0 rgba(212,255,0,0)} }
        @keyframes mv-fade-in { from{opacity:0} to{opacity:1} }
        @keyframes mv-fade-in-scale { from{opacity:0;transform:scale(.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .mv-play-btn { animation: mv-play-pulse 2s infinite }
        .mv-swiper::-webkit-scrollbar { display:none }
        .mv-slider { -webkit-appearance:none; appearance:none; width:100%; height:24px; background:transparent; outline:none; margin:0 }
        .mv-slider::-webkit-slider-runnable-track { width:100%; height:24px; background:transparent }
        .mv-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:50%; background:#fff; margin-top:5px; box-shadow:0 2px 6px rgba(0,0,0,.4); transition:transform .2s cubic-bezier(.32,.72,0,1) }
        .mv-slider:active::-webkit-slider-thumb { transform:scale(1.4) }
      `}</style>

      {heroAnim && (
        <div
          style={{
            position: 'fixed',
            zIndex: heroAnim.zIndex,
            pointerEvents: 'none',
            overflow: 'hidden',
            borderRadius: heroAnim.borderRadius,
            left: heroFrame.x,
            top: heroFrame.y,
            width: heroFrame.width,
            height: heroFrame.height,
            transform: heroTransform,
            transformOrigin: 'top left',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            contain: 'paint style',
            isolation: 'isolate',
            transition: heroAnimActive
              ? 'transform 0.34s cubic-bezier(0.32,0.72,0,1)'
              : 'none',
          }}
        >
          {heroAnim.hasContainFill && (
            <img
              src={heroAnim.url}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: heroAnim.objectPosition,
                transform: 'scale(1.08)',
                filter: 'blur(14px)',
                opacity: 0.42,
                pointerEvents: 'none',
              }}
            />
          )}
          <img
            src={heroAnim.url}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: heroAnim.objectFit,
              objectPosition: heroAnim.objectPosition,
              position: 'relative',
              display: 'block',
            }}
          />
        </div>
      )}

      <div
        {...modalBoundaryProps}
        {...modalTouchBoundaryHandlers}
        style={{
          ...styles.overlay,
          opacity: overlayOpacity,
          transition: overlayTransition,
          pointerEvents: closingPassthrough ? 'none' : styles.overlay.pointerEvents,
          backdropFilter: swipeClosing || isHeroClosing ? 'none' : styles.overlay.backdropFilter,
          WebkitBackdropFilter: swipeClosing || isHeroClosing ? 'none' : styles.overlay.WebkitBackdropFilter,
        }}
      />

      <div
        {...modalBoundaryProps}
        {...modalTouchBoundaryHandlers}
        style={{
          ...styles.container,
          background: isHeroClosing
            ? 'transparent'
            : dragY > 0 ? `rgba(0,0,0,${Math.max(0.12, 1 - dragY / 280)})` : '#000',
          opacity: swipeClosing || isHeroClosing ? 0 : 1,
          pointerEvents: closingPassthrough ? 'none' : styles.container.pointerEvents,
          transition: swipeClosing
            ? 'opacity 0.22s ease, background 0.32s cubic-bezier(0.32,0.72,0,1)'
            : isHeroClosing ? 'background 0.18s cubic-bezier(0.32,0.72,0,1)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.length > 1 && (
          <div style={styles.counter}>
            {currentIndex + 1} / {items.length}
          </div>
        )}

        <div
          ref={scrollRef}
          onScroll={(e) => {
            if (!scrollRef.current) return;
            const idx = Math.round(e.target.scrollLeft / e.target.clientWidth);
            if (idx !== currentIndex) {
              setCurrentIndex(idx);
              dragYRef.current = 0;
              setDragY(0);
            }
          }}
          className="mv-swiper"
          style={styles.swiper}
        >
          {items.map((media, idx) => {
            const isCurrent = idx === currentIndex;
            const slideDy = isCurrent ? dragY : 0;
            const slideTransform = slideDy > 0 ? `translateY(${slideDy}px)` : undefined;
            const slideTransition = isDraggingRef.current ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';

            return (
              <div
                key={idx}
                style={{ ...styles.slide, transform: slideTransform, transition: slideTransition }}
                onTouchStart={(e) => {
                  if (e.touches.length !== 1) return;
                  suppressTapRef.current = false;
                  touchStartY.current = e.touches[0].clientY;
                  touchStartX.current = e.touches[0].clientX;
                  touchStartScrollLeftRef.current = scrollRef.current?.scrollLeft || 0;
                  swipeDirRef.current = null;
                }}
                onTouchMove={(e) => {
                  if (!isCurrent || isZoomed || e.touches.length !== 1 || touchStartY.current === null) return;
                  const dy = e.touches[0].clientY - touchStartY.current;
                  const dx = e.touches[0].clientX - (touchStartX.current ?? e.touches[0].clientX);
                  const absX = Math.abs(dx);
                  const absY = Math.abs(dy);

                  if (!swipeDirRef.current) {
                    if (Math.max(absX, absY) < SWIPE_DIRECTION_THRESHOLD) return;
                    if (absY > absX * SWIPE_AXIS_LOCK_RATIO) {
                      swipeDirRef.current = 'v';
                    } else if (absX > absY * SWIPE_AXIS_LOCK_RATIO) {
                      swipeDirRef.current = 'h';
                      resetDrag();
                      return;
                    } else {
                      return;
                    }
                  }

                  if (swipeDirRef.current === 'v') {
                    if (e.cancelable) e.preventDefault();
                    e.stopPropagation();
                    if (scrollRef.current) scrollRef.current.scrollLeft = touchStartScrollLeftRef.current;
                    updateDrag(dy);
                  } else if (swipeDirRef.current === 'h') {
                    resetDrag();
                  }
                }}
                onTouchEnd={() => {
                  const wasVerticalSwipe = swipeDirRef.current === 'v';
                  swipeDirRef.current = null;
                  touchStartY.current = null;
                  touchStartX.current = null;
                  touchStartScrollLeftRef.current = 0;
                  if (wasVerticalSwipe) finishDrag();
                  else resetDrag();
                }}
                onTouchCancel={() => {
                  swipeDirRef.current = null;
                  touchStartY.current = null;
                  touchStartX.current = null;
                  touchStartScrollLeftRef.current = 0;
                  resetDrag();
                }}
                onMouseDown={(e) => handleMouseDown(e, isCurrent)}
              >
                {media.type === 'video' ? (
                  <VideoSlide
                    media={media}
                    isActive={isCurrent}
                    showUI={showUI}
                    toggleUI={toggleUI}
                  />
                ) : (
                  <div onClick={toggleUI} style={styles.imageSlide}>
                    <Zoomable
                      onTap={(e) => {
                        e.stopPropagation();
                        toggleUI();
                      }}
                      onZoomStart={() => setIsZoomed(true)}
                      onZoomEnd={() => setIsZoomed(false)}
                    >
                      <img
                        ref={isCurrent ? currentImgRef : null}
                        src={media.url}
                        alt=""
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

        {showUI && currentIndex > 0 && (
          <button
            type="button"
            style={{ ...styles.navBtn, left: 16 }}
            onClick={() => scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' })}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {showUI && currentIndex < items.length - 1 && (
          <button
            type="button"
            style={{ ...styles.navBtn, right: 16 }}
            onClick={() => scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' })}
          >
            <ChevronRight size={24} />
          </button>
        )}

        {items.length > 1 && (
          <div style={styles.indicators}>
            {items.map((_, index) => {
              const isActive = index === currentIndex;
              return (
                <div
                  key={index}
                  style={{
                    ...styles.dot,
                    backgroundColor: isActive ? '#D4FF00' : 'rgba(255,255,255,0.58)',
                    opacity: isActive ? 1 : 0.55,
                    boxShadow: isActive
                      ? '0 0 12px rgba(212,255,0,0.85)'
                      : '0 1px 3px rgba(0,0,0,0.5)',
                    transform: isActive ? 'scale(1.12)' : 'scale(1)',
                  }}
                  onClick={() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollLeft = scrollRef.current.clientWidth * index;
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: Z_PHOTO_VIEWER - 1,
    animation: 'mv-fade-in 0.2s ease',
  },
  container: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: Z_PHOTO_VIEWER,
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    animation: 'mv-fade-in-scale 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  counter: {
    position: 'absolute',
    top: 'max(16px, env(safe-area-inset-top, 16px))',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
    background: theme.colors.premium.surfaceElevated,
    padding: '6px 14px',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.5px',
    border: '1px solid rgba(255,255,255,0.1)',
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
    touchAction: 'pan-x',
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
  zoomable: {
    display: 'flex',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    transformOrigin: 'center center',
    cursor: 'pointer',
  },
  image: {
    width: '100%',
    height: '100%',
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
    background: theme.colors.premium.surfaceElevated,
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
    bottom: 'max(14px, calc(env(safe-area-inset-bottom, 0px) + 14px))',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 7,
    zIndex: 10,
    pointerEvents: 'none',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    transition: 'opacity 0.2s, background-color 0.2s, transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    pointerEvents: 'all',
  },
  videoSlide: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
  },
  video: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    cursor: 'pointer',
  },
  videoControls: {
    position: 'absolute',
    bottom: 'max(58px, calc(env(safe-area-inset-bottom, 0px) + 58px))',
    left: 16,
    right: 16,
    height: 40,
    zIndex: 150,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
  },
  videoProgressWrap: {
    flex: 1,
    position: 'relative',
    height: 40,
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  videoProgressFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -2,
    height: 4,
    borderRadius: 2,
    pointerEvents: 'none',
    zIndex: 1,
  },
  videoSlider: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
  },
  playButton: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    background: theme.colors.premium.surfaceElevated,
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#D4FF00',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 5,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    background: theme.colors.premium.surfaceElevated,
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
};

export default MediaViewer;
