// ===== FILE: frontend/src/components/media/MediaViewer.js =====
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Play, Volume2, VolumeX, Download, ChevronUp } from 'lucide-react';
import { useSwipe } from '../../hooks/useSwipe';
import { Z_PHOTO_VIEWER } from '../../constants/zIndex';
import Avatar from '../user/Avatar';
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
    duration: item.duration, w: item.w, h: item.h,
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
  return { x, y, width, height };
};

// ─── Pinch-to-zoom ────────────────────────────────────────────────────────────
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
          if (!isPinching.current) { isPinching.current = true; onZoomStart?.(); }
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
        setScale(1); startDist.current = null;
        if (isPinching.current) { isPinching.current = false; onZoomEnd?.(); }
      }}
      onDoubleClick={() => setScale(p => p === 1 ? 2 : 1)}
      onClick={onTap}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: scale === 1 ? 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        transform: `scale(${scale})`, transformOrigin: 'center center',
        maxWidth: '100%', maxHeight: '100%', cursor: 'pointer',
      }}
    >
      {children}
    </div>
  );
};

// ─── Видео-слайд ──────────────────────────────────────────────────────────────
const VideoSlide = ({ media, isActive, showUI, footerHeight, footerOpen, hasFooter, toggleUI, onFooterOpen }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isActive && videoRef.current) {
      videoRef.current.pause(); setIsPlaying(false); setProgress(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  const togglePlay = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); } else { v.pause(); setIsPlaying(false); }
  };

  const EASE = '0.4s cubic-bezier(0.32, 0.72, 0, 1)';
  const effectiveFooterH = (showUI && footerOpen && hasFooter) ? footerHeight : 0;
  const barBottom = showUI ? effectiveFooterH + 12 : 16;
  const chevronVisible = showUI && hasFooter && !footerOpen;

  return (
    <div onClick={toggleUI} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <video
        ref={videoRef} src={media.url} poster={media.thumbnail_url || undefined}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v || isDragging) return;
          setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
        }}
        onEnded={() => { setIsPlaying(false); setProgress(0); if (videoRef.current) videoRef.current.currentTime = 0; }}
        onClick={togglePlay} playsInline preload="metadata"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: 'pointer' }}
      />
      {!isPlaying && (
        <button onClick={togglePlay} style={styles.playButton} className="mv-play-btn">
          <Play size={32} fill="#D4FF00" style={{ marginLeft: 4 }} />
        </button>
      )}
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}
        style={{ position: 'absolute', bottom: barBottom, left: 16, right: 16, height: 40, zIndex: 150, display: 'flex', alignItems: 'center', gap: 8, transition: `bottom ${EASE}` }}
      >
        <div style={{ flex: 1, position: 'relative', height: 40, display: 'flex', alignItems: 'center', opacity: showUI ? 1 : 0.35, transition: `opacity ${EASE}`, minWidth: 0 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -2, height: 4, borderRadius: 2, background: `linear-gradient(to right, #D4FF00 ${progress}%, rgba(255,255,255,0.18) ${progress}%)`, pointerEvents: 'none', zIndex: 1 }} />
          <input type="range" min="0" max="100" step="0.1" value={progress}
            onChange={(e) => { const v = videoRef.current; if (!v || !v.duration) return; const val = parseFloat(e.target.value); setProgress(val); v.currentTime = (val / 100) * v.duration; }}
            onMouseDown={() => setIsDragging(true)} onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)} onTouchEnd={() => setIsDragging(false)}
            className="mv-slider" style={{ position: 'relative', zIndex: 2, width: '100%' }}
          />
        </div>
        <div style={{ opacity: showUI ? 1 : 0, pointerEvents: showUI ? 'auto' : 'none', transition: `opacity ${EASE}`, flexShrink: 0 }}>
          <button onClick={(e) => { e.stopPropagation(); const v = videoRef.current; if (!v) return; v.muted = !v.muted; setIsMuted(v.muted); }} style={styles.iconButton}>
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
        <div style={{ width: chevronVisible ? 40 : 0, opacity: chevronVisible ? 1 : 0, overflow: 'hidden', flexShrink: 0, transition: `width ${EASE}, opacity ${EASE}`, pointerEvents: chevronVisible ? 'auto' : 'none' }}>
          <button onClick={(e) => { e.stopPropagation(); onFooterOpen?.(); }} style={{ ...styles.iconButton, width: 40 }}>
            <ChevronUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Главный компонент ────────────────────────────────────────────────────────
function MediaViewer({ mediaList = [], initialIndex = 0, onClose, meta, dismissMode = 'default', sourceRect, sourceRectProvider, onIndexChange }) {
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

  // Hero-анимация: плавающий снимок изображения летит обратно в ячейку
  // from = реальный BoundingRect <img> во вьювере, to = sourceRect ячейки
  const [heroAnim, setHeroAnim] = useState(null); // { url, from, to } | null
  const [heroAnimActive, setHeroAnimActive] = useState(false); // true → запустить CSS-переход

  const dragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const mouseDragStartYRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const suppressTapRef = useRef(false);
  const scrollRef = useRef(null);
  const footerRef = useRef(null);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);
  const swipeDirRef = useRef(null);
  // Ссылка на <img> текущего слайда — используется для захвата реальных bounds
  const currentImgRef = useRef(null);

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

  // Запускаем CSS-переход плавающего изображения после первой отрисовки
  useEffect(() => {
    if (!heroAnim) return;
    const id = requestAnimationFrame(() => setHeroAnimActive(true));
    return () => cancelAnimationFrame(id);
  }, [heroAnim]);

  const closeWithAnimation = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(onClose, 280);
  }, [isClosing, onClose]);

  // Fallback: улетаем вниз (без источника или для видео)
  const closeViaSwipe = useCallback(() => {
    if (isClosing || swipeClosing || heroAnim) return;
    isDraggingRef.current = false;
    setDragY(window.innerHeight);
    setSwipeClosing(true);
    setTimeout(onClose, 300);
  }, [isClosing, swipeClosing, heroAnim, onClose]);

  // Hero-закрытие: плавающий снимок летит от реальных bounds к ячейке
  const closeViaHero = useCallback((fallback = closeViaSwipe) => {
    if (isClosing || swipeClosing || heroAnim) return;

    const imgEl = currentImgRef.current;
    const currentItem = items[currentIndex];
    const to = resolveSourceRect(currentIndex);

    // Для видео — fallback на свайп вниз
    if (!imgEl || !to || currentItem?.type === 'video') {
      fallback();
      return;
    }

    const from = normalizeRect(imgEl.getBoundingClientRect());

    // Если изображение ещё не загружено (нулевые размеры) — fallback
    if (!from) {
      fallback();
      return;
    }

    isDraggingRef.current = false;
    dragYRef.current = 0;
    setDragY(0);

    setHeroAnim({ url: currentItem.url, from, to });
    setTimeout(onClose, 360);
  }, [isClosing, swipeClosing, heroAnim, onClose, items, currentIndex, resolveSourceRect, closeViaSwipe]);

  const closeFromControl = useCallback(() => {
    closeViaHero(closeWithAnimation);
  }, [closeViaHero, closeWithAnimation]);

  const resetDrag = useCallback(() => {
    dragYRef.current = 0;
    isDraggingRef.current = false;
    setDragY(0);
  }, []);

  const updateDrag = useCallback((dy) => {
    if (dy <= 0) { resetDrag(); return; }
    if (dy > 6) suppressTapRef.current = true;
    isDraggingRef.current = true;
    dragYRef.current = dy;
    setDragY(dy);
  }, [resetDrag]);

  const finishDrag = useCallback(() => {
    mouseDragStartYRef.current = null;
    touchStartY.current = null;
    if (!isDraggingRef.current) { resetDrag(); return; }
    isDraggingRef.current = false;
    if (dragYRef.current > 80) {
      closeViaHero(closeViaSwipe);
    } else {
      resetDrag();
    }
  }, [closeViaHero, closeViaSwipe, resetDrag]);

  const cleanupMouseDrag = useCallback(() => {
    if (dragCleanupRef.current) { dragCleanupRef.current(); dragCleanupRef.current = null; }
    mouseDragStartYRef.current = null;
  }, []);

  const footerSwipe = useSwipe({ elementRef: footerRef, isModal: true, threshold: 60, onSwipeDown: () => setFooterOpen(false) });

  useEffect(() => { lockBodyScroll(); return () => { cleanupMouseDrag(); unlockBodyScroll(); }; }, [cleanupMouseDrag]);
  useEffect(() => { setFooterOpen(!isZoomed); }, [isZoomed]);
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.style.scrollBehavior = 'auto';
    scrollRef.current.scrollLeft = scrollRef.current.clientWidth * initialIndex;
    setTimeout(() => { if (scrollRef.current) scrollRef.current.style.scrollBehavior = 'smooth'; }, 50);
  }, [initialIndex]);
  useEffect(() => {
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);
  useEffect(() => {
    if (footerRef.current) setFooterHeight(footerRef.current.offsetHeight);
  }, [currentIndex, showUI, meta]);
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !isSwipeOnlyDismiss) closeFromControl();
      if (e.key === 'ArrowLeft') scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' });
      if (e.key === 'ArrowRight') scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeFromControl, isSwipeOnlyDismiss]);

  const toggleUI = useCallback(() => {
    if (suppressTapRef.current) { suppressTapRef.current = false; return; }
    setShowUI(p => !p);
  }, []);

  const handleMouseDown = useCallback((e, isCurrentSlide) => {
    if (!isCurrentSlide || isZoomed || e.button !== 0) return;
    cleanupMouseDrag();
    suppressTapRef.current = false;
    mouseDragStartYRef.current = e.clientY;
    const onMove = (ev) => { if (mouseDragStartYRef.current !== null) updateDrag(ev.clientY - mouseDragStartYRef.current); };
    const onUp = () => { cleanupMouseDrag(); finishDrag(); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    dragCleanupRef.current = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [cleanupMouseDrag, finishDrag, isZoomed, updateDrag]);

  const handleDownload = (e) => {
    e.stopPropagation();
    const url = items[currentIndex]?.url;
    if (!url) return;
    const a = document.createElement('a'); a.href = url; a.download = url.split('/').pop() || 'media';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (!items.length) return null;

  const isHeroClosing = Boolean(heroAnim);

  // Фон тускнеет при свайпе и полностью гаснет при hero-закрытии
  const overlayOpacity = swipeClosing || isHeroClosing
    ? 0
    : dragY > 0 ? Math.max(0.04, 1 - dragY / 280) : undefined;
  const overlayTransition = swipeClosing || isHeroClosing
    ? 'opacity 0.32s cubic-bezier(0.32, 0.72, 0, 1)'
    : dragY > 0 ? 'none' : undefined;
  const heroTransform = heroAnim
    ? heroAnimActive
      ? `translate3d(${heroAnim.to.x - heroAnim.from.x}px, ${heroAnim.to.y - heroAnim.from.y}px, 0) scale(${heroAnim.to.width / heroAnim.from.width}, ${heroAnim.to.height / heroAnim.from.height})`
      : 'translate3d(0, 0, 0) scale(1, 1)'
    : undefined;

  return createPortal(
    <>
      <style>{`
        @keyframes mv-play-pulse { 0%{box-shadow:0 0 0 0 rgba(212,255,0,.4)} 70%{box-shadow:0 0 0 15px rgba(212,255,0,0)} 100%{box-shadow:0 0 0 0 rgba(212,255,0,0)} }
        @keyframes mv-fade-in { from{opacity:0} to{opacity:1} }
        @keyframes mv-fade-in-scale { from{opacity:0;transform:scale(.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes mv-slide-out { from{opacity:1;transform:scale(1) translateY(0)} to{opacity:0;transform:scale(.96) translateY(48px)} }
        .mv-play-btn { animation: mv-play-pulse 2s infinite }
        .mv-swiper::-webkit-scrollbar { display:none }
        .mv-slider { -webkit-appearance:none; appearance:none; width:100%; height:24px; background:transparent; outline:none; margin:0 }
        .mv-slider::-webkit-slider-runnable-track { width:100%; height:24px; background:transparent }
        .mv-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:14px; height:14px; border-radius:50%; background:#fff; margin-top:5px; box-shadow:0 2px 6px rgba(0,0,0,.4); transition:transform .2s cubic-bezier(.32,.72,0,1) }
        .mv-slider:active::-webkit-slider-thumb { transform:scale(1.4) }
      `}</style>

      {/* ── Плавающий снимок для hero-анимации (поверх всего) ── */}
      {heroAnim && (
        <div
          style={{
            position: 'fixed',
            zIndex: Z_PHOTO_VIEWER + 10,
            pointerEvents: 'none',
            overflow: 'hidden',
            borderRadius: 0,
            left: heroAnim.from.x,
            top: heroAnim.from.y,
            width: heroAnim.from.width,
            height: heroAnim.from.height,
            transform: heroTransform,
            transformOrigin: 'top left',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            contain: 'layout paint style',
            transition: heroAnimActive
              ? 'transform 0.34s cubic-bezier(0.32,0.72,0,1)'
              : 'none',
          }}
        >
          <img
            src={heroAnim.url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Затемнение */}
      <div
        {...modalBoundaryProps} {...modalTouchBoundaryHandlers}
        style={{
          ...styles.overlay,
          animation: isClosing ? 'mv-slide-out 0.28s cubic-bezier(0.32,0.72,0,1) forwards' : styles.overlay.animation,
          opacity: overlayOpacity,
          transition: overlayTransition,
          backdropFilter: swipeClosing || isHeroClosing ? 'none' : styles.overlay.backdropFilter,
          WebkitBackdropFilter: swipeClosing || isHeroClosing ? 'none' : styles.overlay.WebkitBackdropFilter,
        }}
        onClick={isSwipeOnlyDismiss ? undefined : closeFromControl}
      />

      {/* Контейнер */}
      <div
        {...modalBoundaryProps} {...modalTouchBoundaryHandlers}
        style={{
          ...styles.container,
          animation: isClosing ? 'mv-slide-out 0.28s cubic-bezier(0.32,0.72,0,1) forwards' : styles.container.animation,
          background: isHeroClosing
            ? 'transparent'
            : dragY > 0 ? `rgba(0,0,0,${Math.max(0.12, 1 - dragY / 280)})` : '#000',
          transition: isHeroClosing ? 'background 0.32s cubic-bezier(0.32,0.72,0,1)' : undefined,
          opacity: swipeClosing ? 0 : isHeroClosing ? 0 : 1,
          ...(swipeClosing
            ? { transition: 'opacity 0.22s ease, background 0.32s cubic-bezier(0.32,0.72,0,1)' }
            : isHeroClosing
              ? { transition: 'background 0.18s cubic-bezier(0.32,0.72,0,1)' }
              : {}),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Счётчик */}
        {items.length > 1 && (
          <div style={{ ...styles.counter, position: 'absolute', top: 'max(16px, env(safe-area-inset-top, 16px))', left: '50%', transform: `translateX(-50%) ${showUI ? 'translateY(0)' : 'translateY(-100px)'}`, opacity: showUI ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.32,0.72,0,1)', zIndex: 10 }}>
            {currentIndex + 1} / {items.length}
          </div>
        )}
        {!meta && !isSwipeOnlyDismiss && (
          <button style={{ ...styles.closeButton, position: 'absolute', top: 'max(16px, env(safe-area-inset-top, 16px))', right: 16, opacity: showUI ? 1 : 0, transform: showUI ? 'translateY(0)' : 'translateY(-100px)', transition: 'all 0.4s cubic-bezier(0.32,0.72,0,1)', zIndex: 10 }} onClick={closeFromControl}>
            <X size={22} />
          </button>
        )}

        {/* Swiper */}
        <div ref={scrollRef} onScroll={(e) => {
          if (!scrollRef.current) return;
          const idx = Math.round(e.target.scrollLeft / e.target.clientWidth);
          if (idx !== currentIndex) { setCurrentIndex(idx); dragYRef.current = 0; setDragY(0); }
        }} className="mv-swiper" style={{ ...styles.swiper, touchAction: 'pan-x' }}>
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
                  swipeDirRef.current = null;
                }}
                onTouchMove={(e) => {
                  if (!isCurrent || isZoomed || e.touches.length !== 1 || touchStartY.current === null) return;
                  const dy = e.touches[0].clientY - touchStartY.current;
                  const dx = e.touches[0].clientX - (touchStartX.current ?? e.touches[0].clientX);
                  if (!swipeDirRef.current && (Math.abs(dy) > 8 || Math.abs(dx) > 8))
                    swipeDirRef.current = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
                  if (swipeDirRef.current === 'v') updateDrag(dy);
                }}
                onTouchEnd={() => { swipeDirRef.current = null; finishDrag(); }}
                onTouchCancel={() => { swipeDirRef.current = null; finishDrag(); }}
                onMouseDown={(e) => handleMouseDown(e, isCurrent)}
              >
                {media.type === 'video' ? (
                  <VideoSlide
                    media={media} isActive={isCurrent} showUI={showUI}
                    footerHeight={footerHeight} footerOpen={footerOpen} hasFooter={Boolean(meta)}
                    toggleUI={toggleUI} onFooterOpen={() => setFooterOpen(true)}
                  />
                ) : (
                  <div onClick={toggleUI} style={styles.imageSlide}>
                    <Zoomable
                      onTap={(e) => { e.stopPropagation(); toggleUI(); }}
                      onZoomStart={() => setIsZoomed(true)}
                      onZoomEnd={() => setIsZoomed(false)}
                    >
                      <img
                        // Захватываем ref только для текущего слайда
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

        {/* Prev/Next */}
        {showUI && currentIndex > 0 && (
          <button style={{ ...styles.navBtn, left: 16 }} onClick={() => scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' })}>
            <ChevronLeft size={24} />
          </button>
        )}
        {showUI && currentIndex < items.length - 1 && (
          <button style={{ ...styles.navBtn, right: 16 }} onClick={() => scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' })}>
            <ChevronRight size={24} />
          </button>
        )}

        {/* Точки */}
        {items.length > 1 && (
          <div style={styles.indicators}>
            {items.map((_, i) => (
              <div key={i} style={{ ...styles.dot, opacity: i === currentIndex ? 1 : 0.4 }}
                onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.clientWidth * i; }} />
            ))}
          </div>
        )}

        {/* Футер */}
        {meta && (
          <div ref={footerRef} style={{ ...styles.footer, opacity: showUI ? 1 : 0, transform: (showUI && footerOpen) ? 'translateY(0)' : 'translateY(100%)' }} {...footerSwipe}>
            <div style={styles.swipeHandle} />
            {meta.author && (() => {
              const sub = [meta.author.university, meta.author.course ? `${meta.author.course}к` : null].filter(Boolean).join(' · ');
              return (
                <div style={styles.authorRow}>
                  <Avatar user={meta.author} size={44} showProfile={false} />
                  <div style={styles.authorInfo}>
                    <span style={styles.authorName}>{meta.author.username || meta.author.name}</span>
                    {sub && <span style={styles.authorMeta}>{sub}</span>}
                  </div>
                </div>
              );
            })()}
            {meta.caption && <p style={styles.caption}>{meta.caption}</p>}
            <div style={styles.footerButtons}>
              <button style={styles.downloadButton} onClick={handleDownload}><Download size={16} />Скачать</button>
              {!isSwipeOnlyDismiss && (
                <button style={styles.closeButtonFooter} onClick={closeFromControl}><X size={16} strokeWidth={3} />Закрыть</button>
              )}
            </div>
          </div>
        )}

        {meta && showUI && !footerOpen && items[currentIndex]?.type !== 'video' && (
          <button style={styles.footerChevron} onClick={() => setFooterOpen(true)}>
            <ChevronUp size={20} />
          </button>
        )}
      </div>
    </>,
    document.body
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)',
    backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    zIndex: Z_PHOTO_VIEWER - 1, animation: 'mv-fade-in 0.2s ease',
  },
  container: {
    position: 'fixed', top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)',
    zIndex: Z_PHOTO_VIEWER, display: 'flex', flexDirection: 'column', background: '#000',
    animation: 'mv-fade-in-scale 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
    userSelect: 'none', WebkitUserSelect: 'none',
  },
  counter: {
    background: theme.colors.premium.surfaceElevated, padding: '6px 14px', borderRadius: 16,
    fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.5px', border: '1px solid rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 44, height: 44, borderRadius: '50%', background: theme.colors.premium.surfaceElevated,
    border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },
  swiper: {
    flex: 1, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollBehavior: 'smooth',
    width: '100%', height: '100%', msOverflowStyle: 'none', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
  },
  slide: {
    flex: '0 0 100%', width: '100%', height: '100%', scrollSnapAlign: 'center',
    position: 'relative', overflow: 'hidden',
  },
  imageSlide: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  image: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', WebkitUserSelect: 'none', pointerEvents: 'none' },
  navBtn: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 40, height: 40, borderRadius: '50%',
    background: theme.colors.premium.surfaceElevated, border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    zIndex: 10, transition: 'transform 0.15s cubic-bezier(0.32,0.72,0,1), opacity 0.15s',
  },
  indicators: { position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6, zIndex: 10, pointerEvents: 'none' },
  dot: { width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.5)', transition: 'opacity 0.2s', cursor: 'pointer', pointerEvents: 'all' },
  playButton: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36,
    background: theme.colors.premium.surfaceElevated, border: '1px solid rgba(255,255,255,0.1)',
    color: '#D4FF00', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 5,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, background: theme.colors.premium.surfaceElevated, border: '1px solid rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    padding: '16px 16px', paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
    background: 'rgba(10,10,12,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 16,
    transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
  },
  swipeHandle: { width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)', alignSelf: 'center', marginBottom: 4, flexShrink: 0 },
  footerChevron: {
    position: 'absolute', bottom: 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 20px))', right: 16,
    width: 40, height: 40, borderRadius: 20, background: theme.colors.premium.surfaceElevated,
    border: '1px solid rgba(255,255,255,0.12)', color: '#fff', display: 'flex',
    alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 15,
  },
  authorRow: { display: 'flex', alignItems: 'center', gap: 10 },
  authorInfo: { display: 'flex', flexDirection: 'column', gap: 1 },
  authorName: { fontWeight: 700, fontSize: 16, color: '#fff', lineHeight: 1.2 },
  authorMeta: { color: '#8E8E93', fontSize: 13, marginTop: 2, lineHeight: 1.2 },
  caption: { margin: 0, fontSize: 15, color: '#EAEAEA', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  footerButtons: { display: 'flex', gap: 8, alignItems: 'center' },
  downloadButton: { display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 16px', borderRadius: 20, background: 'rgba(44,44,46,1)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', flexShrink: 0 },
  closeButtonFooter: { flex: 1, height: 40, borderRadius: 20, background: '#D4FF00', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 12px rgba(212,255,0,0.2)' },
};

export default MediaViewer;
