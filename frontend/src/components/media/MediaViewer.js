// ===== FILE: frontend/src/components/media/MediaViewer.js =====
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Play, Volume2, VolumeX } from 'lucide-react';
import { Z_PHOTO_VIEWER } from '../../constants/zIndex';
import { hapticFeedback } from '../../utils/telegram';
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

const getRenderedImageRect = (imgEl) => {
  const box = normalizeRect(imgEl?.getBoundingClientRect?.());
  if (!box) return null;

  const naturalWidth = imgEl.naturalWidth;
  const naturalHeight = imgEl.naturalHeight;
  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
    return box;
  }

  const mediaRatio = naturalWidth / naturalHeight;
  const boxRatio = box.width / box.height;
  let width = box.width;
  let height = box.height;

  if (mediaRatio > boxRatio) {
    height = box.width / mediaRatio;
  } else {
    width = box.height * mediaRatio;
  }

  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  return { x, y, width, height };
};

const getRenderedVideoRect = (videoEl) => {
  const box = normalizeRect(videoEl?.getBoundingClientRect?.());
  if (!box) return null;

  const videoWidth = videoEl.videoWidth;
  const videoHeight = videoEl.videoHeight;
  if (!Number.isFinite(videoWidth) || !Number.isFinite(videoHeight) || videoWidth <= 0 || videoHeight <= 0) {
    return box;
  }

  const mediaRatio = videoWidth / videoHeight;
  const boxRatio = box.width / box.height;
  let width = box.width;
  let height = box.height;

  if (mediaRatio > boxRatio) {
    height = box.width / mediaRatio;
  } else {
    width = box.height * mediaRatio;
  }

  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;
  return { x, y, width, height };
};

const getRenderedMediaRect = (mediaEl, mediaType) => {
  if (!mediaEl) return null;
  if (mediaType === 'image') return getRenderedImageRect(mediaEl);
  if (mediaType === 'video') return getRenderedVideoRect(mediaEl);
  return normalizeRect(mediaEl.getBoundingClientRect?.());
};

const getMediaAspectRatio = (mediaEl, mediaType, item) => {
  const itemWidth = Number(item?.w);
  const itemHeight = Number(item?.h);
  if (Number.isFinite(itemWidth) && Number.isFinite(itemHeight) && itemWidth > 0 && itemHeight > 0) {
    return itemWidth / itemHeight;
  }

  if (mediaType === 'video') {
    const videoWidth = mediaEl?.videoWidth;
    const videoHeight = mediaEl?.videoHeight;
    if (Number.isFinite(videoWidth) && Number.isFinite(videoHeight) && videoWidth > 0 && videoHeight > 0) {
      return videoWidth / videoHeight;
    }
  }

  const naturalWidth = mediaEl?.naturalWidth;
  const naturalHeight = mediaEl?.naturalHeight;
  if (Number.isFinite(naturalWidth) && Number.isFinite(naturalHeight) && naturalWidth > 0 && naturalHeight > 0) {
    return naturalWidth / naturalHeight;
  }

  return null;
};

const getContainedRect = (containerRect, mediaAspectRatio) => {
  const box = normalizeRect(containerRect);
  if (!box || !Number.isFinite(mediaAspectRatio) || mediaAspectRatio <= 0) return box;

  const boxRatio = box.width / box.height;
  let width = box.width;
  let height = box.height;

  if (mediaAspectRatio > boxRatio) {
    height = box.width / mediaAspectRatio;
  } else {
    width = box.height * mediaAspectRatio;
  }

  return {
    ...box,
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
};

const getHeroMediaUrl = (item) => {
  if (!item) return '';
  return item.type === 'video' ? item.thumbnail_url : item.url;
};

const getHeroCloseTransform = (heroAnim, isActive) => {
  if (!heroAnim || !isActive) return 'translate3d(0, 0, 0) scale(1, 1)';

  const { from, to } = heroAnim;
  const scaleX = from.width ? to.width / from.width : 1;
  const scaleY = from.height ? to.height / from.height : 1;
  const translateX = to.x - from.x;
  const translateY = to.y - from.y;

  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
};

const getRectAspectRatio = (rect) => {
  if (!rect?.width || !rect?.height) return null;
  return rect.width / rect.height;
};

const shouldAnimateHeroBounds = (from, to, objectFit) => {
  if ((objectFit || 'cover') !== 'cover') return false;
  const fromAspect = getRectAspectRatio(from);
  const toAspect = getRectAspectRatio(to);
  if (!fromAspect || !toAspect) return false;
  return Math.abs(fromAspect - toAspect) > 0.04;
};

const HERO_CLOSE_MS = 340;
const SWIPE_CLOSE_MS = 300;
const HERO_EASING = 'cubic-bezier(0.32,0.72,0,1)';
const SWIPE_DIRECTION_THRESHOLD = 10;
const SWIPE_AXIS_LOCK_RATIO = 1.15;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_MS = 280;
const TAP_MOVE_THRESHOLD = 10;
const PAN_START_THRESHOLD = 4;
const TRANSFORM_EPSILON = 0.01;
const ZOOM_LIMIT_EPSILON = 0.003;
const ZOOM_TRANSITION = 'transform 0.24s cubic-bezier(0.32, 0.72, 0, 1)';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const alignScrollToIndex = (scrollEl, index) => {
  if (!scrollEl) return;
  const width = scrollEl.clientWidth;
  if (!width) return;

  const previousBehavior = scrollEl.style.scrollBehavior;
  scrollEl.style.scrollBehavior = 'auto';
  scrollEl.scrollLeft = width * index;
  scrollEl.style.scrollBehavior = previousBehavior;
};

const getTouchDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
};

const getTouchMidpoint = (touches) => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});

const getContainedImageFrame = (container) => {
  const rect = container?.getBoundingClientRect?.();
  const containerWidth = container?.clientWidth || rect?.width || 0;
  const containerHeight = container?.clientHeight || rect?.height || 0;
  if (!containerWidth || !containerHeight) return { left: 0, top: 0, width: 0, height: 0 };

  const img = container.querySelector('img');
  const naturalWidth = img?.naturalWidth || 0;
  const naturalHeight = img?.naturalHeight || 0;
  if (!naturalWidth || !naturalHeight) {
    return { left: 0, top: 0, width: containerWidth, height: containerHeight };
  }

  const containerRatio = containerWidth / containerHeight;
  const imageRatio = naturalWidth / naturalHeight;

  if (imageRatio > containerRatio) {
    const height = containerWidth / imageRatio;
    return {
      left: 0,
      top: (containerHeight - height) / 2,
      width: containerWidth,
      height,
    };
  }

  const width = containerHeight * imageRatio;
  return {
    left: (containerWidth - width) / 2,
    top: 0,
    width,
    height: containerHeight,
  };
};

const getZoomViewportRect = (container) => {
  const rect = container?.getBoundingClientRect?.();
  const width = container?.clientWidth || rect?.width || 0;
  const height = container?.clientHeight || rect?.height || 0;
  if (!rect || !width || !height) return null;
  return { left: rect.left, top: rect.top, width, height };
};

const clampZoomAxis = (value, frameStart, frameSize, viewportSize, scale) => {
  const scaledSize = frameSize * scale;
  if (scaledSize <= viewportSize) {
    return (viewportSize - scaledSize) / 2 - frameStart;
  }

  return clamp(value, viewportSize - frameStart - scaledSize, -frameStart);
};

const areTransformsClose = (a, b) => (
  Math.abs(a.scale - b.scale) < 0.001 &&
  Math.abs(a.x - b.x) < TRANSFORM_EPSILON &&
  Math.abs(a.y - b.y) < TRANSFORM_EPSILON
);

const getZoomTransformStyle = ({ x, y, scale }) => (
  `translate3d(${x}px, ${y}px, 0) scale(${scale})`
);

const getZoomContentPoint = (localX, localY, frame, transform) => ({
  x: clamp((localX - frame.left - transform.x) / transform.scale, 0, frame.width),
  y: clamp((localY - frame.top - transform.y) / transform.scale, 0, frame.height),
});

const getZoomBoundary = (scale) => {
  if (scale >= MAX_ZOOM - 0.001) return 'max';
  if (scale <= MIN_ZOOM + 0.001) return 'min';
  return null;
};

const Zoomable = ({ children, isActive, onTap, onZoomStart, onZoomEnd }) => {
  const containerRef = useRef(null);
  const zoomableRef = useRef(null);
  const contentFrameRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [contentFrame, setContentFrame] = useState(contentFrameRef.current);
  const transformRef = useRef(transform);
  const gestureRef = useRef(null);
  const suppressTapRef = useRef(false);
  const isZoomedRef = useRef(false);
  const zoomBoundaryRef = useRef(null);
  const tapStartRef = useRef(null);
  const lastTapRef = useRef(null);
  const singleTapTimerRef = useRef(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const measureContentFrame = useCallback(() => {
    const next = getContainedImageFrame(containerRef.current);
    contentFrameRef.current = next;
    setContentFrame((prev) => (
      Math.abs(prev.left - next.left) < 0.5 &&
      Math.abs(prev.top - next.top) < 0.5 &&
      Math.abs(prev.width - next.width) < 0.5 &&
      Math.abs(prev.height - next.height) < 0.5
        ? prev
        : next
    ));
    return next;
  }, []);

  const notifyZoomStart = useCallback(() => {
    if (isZoomedRef.current) return;
    isZoomedRef.current = true;
    onZoomStart?.();
  }, [onZoomStart]);

  const updateZoomState = useCallback((nextScale) => {
    const isZoomedNow = nextScale > 1.01;
    if (isZoomedNow && !isZoomedRef.current) {
      notifyZoomStart();
    } else if (!isZoomedNow && isZoomedRef.current) {
      isZoomedRef.current = false;
      onZoomEnd?.();
    }
  }, [notifyZoomStart, onZoomEnd]);

  const clampTransform = useCallback((next) => {
    const scale = clamp(next.scale, MIN_ZOOM, MAX_ZOOM);
    const rect = getZoomViewportRect(containerRef.current);
    const frame = contentFrameRef.current.width ? contentFrameRef.current : measureContentFrame();
    if (!rect || !frame.width || !frame.height || scale <= 1.01) {
      return { scale: 1, x: 0, y: 0 };
    }

    return {
      scale,
      x: clampZoomAxis(next.x, frame.left, frame.width, rect.width, scale),
      y: clampZoomAxis(next.y, frame.top, frame.height, rect.height, scale),
    };
  }, [measureContentFrame]);

  const writeZoomTransform = useCallback((next, isGesture = false) => {
    const node = zoomableRef.current;
    if (!node) return;

    node.style.transform = getZoomTransformStyle(next);
    node.style.willChange = isGesture || next.scale > 1.01 ? 'transform' : '';
    node.style.transition = isGesture ? 'none' : ZOOM_TRANSITION;
  }, []);

  const applyTransform = useCallback((next, options = {}) => {
    const { haptic = true } = options;
    const clamped = clampTransform(next);
    const previous = transformRef.current;
    if (areTransformsClose(previous, clamped)) {
      updateZoomState(clamped.scale);
      const nextBoundary = getZoomBoundary(clamped.scale);
      if (haptic && nextBoundary && nextBoundary !== zoomBoundaryRef.current) {
        hapticFeedback('selection');
      }
      zoomBoundaryRef.current = nextBoundary;
      return clamped;
    }

    transformRef.current = clamped;
    setTransform(clamped);
    writeZoomTransform(clamped);
    updateZoomState(clamped.scale);

    const nextBoundary = getZoomBoundary(clamped.scale);
    if (haptic && nextBoundary && nextBoundary !== zoomBoundaryRef.current) {
      hapticFeedback('selection');
    }
    zoomBoundaryRef.current = nextBoundary;
    return clamped;
  }, [clampTransform, updateZoomState, writeZoomTransform]);

  const applyGestureTransform = useCallback((next) => {
    const clamped = clampTransform(next);
    const previous = transformRef.current;
    const nextBoundary = getZoomBoundary(clamped.scale);

    if (nextBoundary && nextBoundary !== zoomBoundaryRef.current) {
      hapticFeedback('selection');
    }
    zoomBoundaryRef.current = nextBoundary;

    if (areTransformsClose(previous, clamped)) {
      return clamped;
    }

    transformRef.current = clamped;
    writeZoomTransform(clamped, true);
    return clamped;
  }, [clampTransform, writeZoomTransform]);

  const commitGestureTransform = useCallback(() => {
    const current = transformRef.current;
    setTransform((prev) => (areTransformsClose(prev, current) ? prev : current));
    writeZoomTransform(current);
    updateZoomState(current.scale);
    return current;
  }, [updateZoomState, writeZoomTransform]);

  const resetZoom = useCallback(() => {
    const next = { scale: 1, x: 0, y: 0 };
    setIsInteracting(false);
    zoomBoundaryRef.current = null;
    transformRef.current = next;
    setTransform(next);
    writeZoomTransform(next);
    updateZoomState(next.scale);
  }, [updateZoomState, writeZoomTransform]);

  const zoomAt = useCallback((clientX, clientY, nextScale) => {
    const rect = getZoomViewportRect(containerRef.current);
    const frame = contentFrameRef.current.width ? contentFrameRef.current : measureContentFrame();
    if (!rect || !frame.width || !frame.height) return;

    const current = transformRef.current;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const contentPoint = getZoomContentPoint(localX, localY, frame, current);

    applyTransform({
      scale: nextScale,
      x: localX - frame.left - contentPoint.x * nextScale,
      y: localY - frame.top - contentPoint.y * nextScale,
    });
  }, [applyTransform, measureContentFrame]);

  const clearSingleTapTimer = useCallback(() => {
    if (singleTapTimerRef.current) {
      window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  }, []);

  const zoomByDoubleTap = useCallback((clientX, clientY) => {
    clearSingleTapTimer();
    lastTapRef.current = null;
    suppressTapRef.current = true;
    setIsInteracting(false);
    if (transformRef.current.scale > 1.01) resetZoom();
    else zoomAt(clientX, clientY, MAX_ZOOM);
    window.setTimeout(() => { suppressTapRef.current = false; }, 450);
  }, [clearSingleTapTimer, resetZoom, zoomAt]);

  const handleTouchTap = useCallback((clientX, clientY) => {
    const now = Date.now();
    suppressTapRef.current = true;
    const previousTap = lastTapRef.current;
    if (
      previousTap &&
      now - previousTap.time <= DOUBLE_TAP_MS &&
      Math.hypot(clientX - previousTap.x, clientY - previousTap.y) <= TAP_MOVE_THRESHOLD * 2
    ) {
      zoomByDoubleTap(clientX, clientY);
      return;
    }

    clearSingleTapTimer();
    lastTapRef.current = { time: now, x: clientX, y: clientY };
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = null;
      lastTapRef.current = null;
      onTap?.({ preventDefault() {}, stopPropagation() {} });
      suppressTapRef.current = false;
    }, DOUBLE_TAP_MS);
  }, [clearSingleTapTimer, onTap, zoomByDoubleTap]);

  useEffect(() => {
    if (!isActive) resetZoom();
  }, [isActive, resetZoom]);

  useEffect(() => () => {
    clearSingleTapTimer();
  }, [clearSingleTapTimer]);

  useLayoutEffect(() => {
    measureContentFrame();
  }, [children, isActive, measureContentFrame]);

  useEffect(() => {
    const container = containerRef.current;
    const image = container?.querySelector('img');
    if (!container) return undefined;

    const handleMeasure = () => {
      const frame = measureContentFrame();
      if (transformRef.current.scale > 1.01) {
        applyTransform(transformRef.current, { haptic: false });
      } else {
        contentFrameRef.current = frame;
      }
    };

    image?.addEventListener('load', handleMeasure);
    window.addEventListener('resize', handleMeasure);
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(handleMeasure)
      : null;
    observer?.observe(container);

    handleMeasure();

    return () => {
      image?.removeEventListener('load', handleMeasure);
      window.removeEventListener('resize', handleMeasure);
      observer?.disconnect();
    };
  }, [applyTransform, measureContentFrame]);

  const renderedTransform = isInteracting ? transformRef.current : transform;

  return (
    <div
      ref={containerRef}
      onTouchStart={(e) => {
        if (e.touches.length === 2) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          const rect = getZoomViewportRect(containerRef.current);
          const frame = contentFrameRef.current.width ? contentFrameRef.current : measureContentFrame();
          if (!rect || !frame.width || !frame.height) return;

          tapStartRef.current = null;
          clearSingleTapTimer();
          lastTapRef.current = null;
          gestureRef.current = {
            type: 'pinch',
            lastDistance: getTouchDistance(e.touches),
          };
          suppressTapRef.current = true;
          setIsInteracting(true);
          notifyZoomStart();
        } else if (e.touches.length === 1) {
          const touch = e.touches[0];
          tapStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
            moved: false,
          };

          if (transformRef.current.scale > 1.01) {
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            gestureRef.current = {
              type: 'pan',
              startX: touch.clientX,
              startY: touch.clientY,
              lastX: touch.clientX,
              lastY: touch.clientY,
              moved: false,
            };
          }
        }
      }}
      onTouchMove={(e) => {
        const gesture = gestureRef.current;
        if (!gesture && tapStartRef.current && e.touches.length === 1) {
          const touch = e.touches[0];
          if (Math.hypot(touch.clientX - tapStartRef.current.x, touch.clientY - tapStartRef.current.y) > TAP_MOVE_THRESHOLD) {
            tapStartRef.current.moved = true;
          }
          return;
        }
        if (!gesture) return;

        if (gesture.type === 'pinch' && e.touches.length === 2) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          const rect = getZoomViewportRect(containerRef.current);
          const frame = contentFrameRef.current.width ? contentFrameRef.current : measureContentFrame();
          if (!rect || !frame.width || !frame.height) return;

          const midpoint = getTouchMidpoint(e.touches);
          const localX = midpoint.x - rect.left;
          const localY = midpoint.y - rect.top;
          const current = transformRef.current;
          const distance = getTouchDistance(e.touches);
          const distanceRatio = gesture.lastDistance ? distance / gesture.lastDistance : 1;
          const rawScale = current.scale * distanceRatio;

          if (
            (current.scale >= MAX_ZOOM - ZOOM_LIMIT_EPSILON && rawScale >= current.scale) ||
            (current.scale <= MIN_ZOOM + ZOOM_LIMIT_EPSILON && rawScale <= current.scale)
          ) {
            gesture.lastDistance = distance;
            return;
          }

          const nextScale = clamp(rawScale, MIN_ZOOM, MAX_ZOOM);
          const contentPoint = getZoomContentPoint(localX, localY, frame, current);

          applyGestureTransform({
            scale: nextScale,
            x: localX - frame.left - contentPoint.x * nextScale,
            y: localY - frame.top - contentPoint.y * nextScale,
          });
          gesture.lastDistance = distance;
        } else if (gesture.type === 'pan' && e.touches.length === 1) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
          const touch = e.touches[0];
          const totalDx = touch.clientX - gesture.startX;
          const totalDy = touch.clientY - gesture.startY;
          if (!gesture.moved && Math.hypot(totalDx, totalDy) < PAN_START_THRESHOLD) {
            return;
          }

          if (!gesture.moved) {
            gesture.moved = true;
            if (tapStartRef.current) tapStartRef.current.moved = true;
            suppressTapRef.current = true;
            setIsInteracting(true);
          }

          const current = transformRef.current;
          const nextTransform = applyGestureTransform({
            scale: current.scale,
            x: current.x + touch.clientX - gesture.lastX,
            y: current.y + touch.clientY - gesture.lastY,
          });

          if (areTransformsClose(current, nextTransform)) {
            gesture.lastX = touch.clientX;
            gesture.lastY = touch.clientY;
            return;
          }

          gesture.lastX = touch.clientX;
          gesture.lastY = touch.clientY;
        }
      }}
      onTouchEnd={(e) => {
        const gesture = gestureRef.current;
        const tapStart = tapStartRef.current;
        const changedTouch = e.changedTouches?.[0];
        const isTapCandidate = Boolean(
          changedTouch &&
          tapStart &&
          !tapStart.moved &&
          Date.now() - tapStart.time <= 450 &&
          Math.hypot(changedTouch.clientX - tapStart.x, changedTouch.clientY - tapStart.y) <= TAP_MOVE_THRESHOLD &&
          (!gesture || (gesture.type === 'pan' && !gesture.moved))
        );

        if (gesture || transformRef.current.scale > 1.01 || suppressTapRef.current || isTapCandidate) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();
        }
        if (e.touches.length === 0) {
          gestureRef.current = null;
          tapStartRef.current = null;
          if (transformRef.current.scale <= 1.01) {
            resetZoom();
          } else {
            commitGestureTransform();
            setIsInteracting(false);
          }
          if (isTapCandidate) {
            handleTouchTap(changedTouch.clientX, changedTouch.clientY);
          } else {
            window.setTimeout(() => { suppressTapRef.current = false; }, 450);
          }
        } else if (e.touches.length === 1 && transformRef.current.scale > 1.01) {
          const touch = e.touches[0];
          gestureRef.current = {
            type: 'pan',
            startX: touch.clientX,
            startY: touch.clientY,
            lastX: touch.clientX,
            lastY: touch.clientY,
            moved: false,
          };
        }
      }}
      onTouchCancel={(e) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        gestureRef.current = null;
        tapStartRef.current = null;
        if (transformRef.current.scale <= 1.01) {
          resetZoom();
        } else {
          commitGestureTransform();
          setIsInteracting(false);
        }
        window.setTimeout(() => { suppressTapRef.current = false; }, 450);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        suppressTapRef.current = true;
        setIsInteracting(false);
        zoomByDoubleTap(e.clientX, e.clientY);
        window.setTimeout(() => { suppressTapRef.current = false; }, 450);
      }}
      onClick={(e) => {
        if (suppressTapRef.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressTapRef.current = false;
          return;
        }
        onTap?.(e);
      }}
      style={{
        ...styles.zoomViewport,
        touchAction: renderedTransform.scale > 1.01 || isInteracting ? 'none' : 'manipulation',
      }}
    >
      <div
        ref={zoomableRef}
        style={{
          ...styles.zoomable,
          left: contentFrame.left,
          top: contentFrame.top,
          width: contentFrame.width,
          height: contentFrame.height,
          transition: isInteracting ? 'none' : ZOOM_TRANSITION,
          transform: getZoomTransformStyle(renderedTransform),
          willChange: isInteracting || renderedTransform.scale > 1.01 ? 'transform' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

const VideoSlide = ({ media, isActive, isClosing, showUI, toggleUI, mediaRef }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const setVideoNode = useCallback((node) => {
    videoRef.current = node;
    if (mediaRef) mediaRef.current = node;
  }, [mediaRef]);

  useEffect(() => {
    if ((!isActive || isClosing) && videoRef.current) {
      videoRef.current.pause();
      if (!isClosing) videoRef.current.currentTime = 0;
      setIsPlaying(false);
      if (!isClosing) setProgress(0);
    }
  }, [isActive, isClosing]);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (isClosing) return;
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
    if (isClosing) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <div onClick={toggleUI} style={styles.videoSlide}>
      <video
        ref={setVideoNode}
        src={media.url}
        poster={media.thumbnail_url || undefined}
        onTimeUpdate={() => {
          const video = videoRef.current;
          if (!video || isDragging || isClosing) return;
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
      {!isPlaying && !isClosing && (
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
          opacity: isClosing ? 0 : showUI ? 1 : 0.35,
          pointerEvents: isClosing ? 'none' : showUI ? 'auto' : 'none',
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

function MediaViewer({
  mediaList = [],
  initialIndex = 0,
  onClose,
  onCloseStart,
  sourceRect,
  sourceRectProvider,
  onIndexChange,
  requestCloseSignal = 0,
  performanceMode = 'normal',
}) {
  const items = useMemo(() => mediaList.map(normalizeItem).filter(Boolean), [mediaList]);
  const isReducedPerformance = performanceMode === 'reduced';
  const viewerScrollBehavior = isReducedPerformance ? 'auto' : 'smooth';

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
  const currentMediaRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const heroCloseDoneRef = useRef(false);
  const didNotifyIndexChangeRef = useRef(false);
  const currentIndexRef = useRef(initialIndex);
  const requestCloseSignalRef = useRef(requestCloseSignal);

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

  const notifyCloseStart = useCallback(() => {
    onCloseStart?.();
  }, [onCloseStart]);

  useEffect(() => {
    if (!heroAnim) return undefined;
    setHeroAnimActive(false);
    const id = requestAnimationFrame(() => setHeroAnimActive(true));

    return () => {
      cancelAnimationFrame(id);
    };
  }, [heroAnim]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const resetDrag = useCallback(() => {
    dragYRef.current = 0;
    isDraggingRef.current = false;
    setDragY(0);
  }, []);

  const closeViaSwipe = useCallback(() => {
    if (isClosing || swipeClosing || heroAnim) return;
    notifyCloseStart();
    isDraggingRef.current = false;
    dragYRef.current = window.innerHeight;
    setIsClosing(true);
    setDragY(window.innerHeight);
    setSwipeClosing(true);
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose?.();
    }, SWIPE_CLOSE_MS);
  }, [isClosing, swipeClosing, heroAnim, notifyCloseStart, onClose]);

  const closeViaFade = useCallback(() => {
    if (isClosing || swipeClosing || heroAnim) return;
    notifyCloseStart();
    isDraggingRef.current = false;
    dragYRef.current = 0;
    setIsClosing(true);
    setDragY(0);
    setSwipeClosing(true);
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose?.();
    }, 180);
  }, [isClosing, swipeClosing, heroAnim, notifyCloseStart, onClose]);

  const finishHeroClose = useCallback(() => {
    if (heroCloseDoneRef.current) return;
    heroCloseDoneRef.current = true;
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    onClose?.();
  }, [onClose]);

  const closeViaHero = useCallback((fallback = closeViaSwipe) => {
    if (isClosing || swipeClosing || heroAnim) return;
    if (isReducedPerformance) {
      fallback();
      return;
    }

    const mediaEl = currentMediaRef.current;
    const currentItem = items[currentIndex];
    const to = resolveSourceRect(currentIndex);
    const heroUrl = getHeroMediaUrl(currentItem);

    if (!mediaEl || !to || !heroUrl) {
      fallback();
      return;
    }

    const from = getRenderedMediaRect(mediaEl, currentItem?.type);
    if (!from) {
      fallback();
      return;
    }

    notifyCloseStart();
    isDraggingRef.current = false;
    dragYRef.current = 0;
    setDragY(0);
    setIsClosing(true);
    const targetRect = to.objectFit === 'contain'
      ? getContainedRect(to, getMediaAspectRatio(mediaEl, currentItem?.type, currentItem))
      : to;

    const targetObjectFit = to.objectFit || 'cover';

    setHeroAnim({
      url: heroUrl,
      from,
      to: targetRect,
      objectFit: targetObjectFit,
      objectPosition: to.objectPosition || 'center center',
      fromBorderRadius: 0,
      borderRadius: to.borderRadius ?? 0,
      zIndex: to.zIndex ?? Z_PHOTO_VIEWER + 10,
      hasContainFill: Boolean(to.hasContainFill || to.objectFit === 'contain'),
      animateBounds: shouldAnimateHeroBounds(from, targetRect, targetObjectFit),
    });
    heroCloseDoneRef.current = false;
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      finishHeroClose();
    }, HERO_CLOSE_MS + 80);
  }, [isClosing, swipeClosing, heroAnim, isReducedPerformance, items, currentIndex, resolveSourceRect, closeViaSwipe, notifyCloseStart, finishHeroClose]);

  const updateDrag = useCallback((dy) => {
    const nextY = Math.max(0, dy);
    if (nextY > 6) suppressTapRef.current = true;
    isDraggingRef.current = true;
    if (Math.abs(dragYRef.current - nextY) < 0.5) return;
    dragYRef.current = nextY;
    setDragY(nextY);
  }, []);

  const finishDrag = useCallback(() => {
    mouseDragStartYRef.current = null;
    touchStartY.current = null;
    if (!isDraggingRef.current) {
      resetDrag();
      return;
    }
    isDraggingRef.current = false;
    if (dragYRef.current > 80) {
      closeViaHero(isReducedPerformance ? closeViaFade : closeViaSwipe);
    } else {
      resetDrag();
    }
  }, [closeViaHero, closeViaFade, closeViaSwipe, isReducedPerformance, resetDrag]);

  const cleanupMouseDrag = useCallback(() => {
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
    mouseDragStartYRef.current = null;
  }, []);

  useLayoutEffect(() => () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    cleanupMouseDrag();
  }, [cleanupMouseDrag]);

  useEffect(() => {
    if (!scrollRef.current) return;
    alignScrollToIndex(scrollRef.current, initialIndex);
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.style.scrollBehavior = isReducedPerformance ? 'auto' : 'smooth';
    }, 50);
  }, [initialIndex, isReducedPerformance]);

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;

    let raf = null;
    const align = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        alignScrollToIndex(scrollEl, currentIndexRef.current);
      });
    };

    align();
    window.addEventListener('resize', align);
    window.addEventListener('orientationchange', align);
    window.visualViewport?.addEventListener('resize', align);
    window.visualViewport?.addEventListener('scroll', align);

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(align)
      : null;
    observer?.observe(scrollEl);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', align);
      window.removeEventListener('orientationchange', align);
      window.visualViewport?.removeEventListener('resize', align);
      window.visualViewport?.removeEventListener('scroll', align);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!didNotifyIndexChangeRef.current) {
      didNotifyIndexChangeRef.current = true;
      return;
    }
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);

  useEffect(() => {
    if (requestCloseSignal === requestCloseSignalRef.current) return;
    requestCloseSignalRef.current = requestCloseSignal;
    if (requestCloseSignal > 0) {
      closeViaHero(isReducedPerformance ? closeViaFade : closeViaSwipe);
    }
  }, [requestCloseSignal, closeViaHero, closeViaFade, closeViaSwipe, isReducedPerformance]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') {
        scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: viewerScrollBehavior });
      }
      if (e.key === 'ArrowRight') {
        scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: viewerScrollBehavior });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewerScrollBehavior]);

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
    ? 'opacity 0.18s ease'
    : dragY > 0 ? 'none' : undefined;
  const heroTransform = getHeroCloseTransform(heroAnim, heroAnimActive);
  const heroUsesBoundsAnimation = Boolean(heroAnim?.animateBounds);
  const heroRect = heroAnim
    ? (heroUsesBoundsAnimation && heroAnimActive ? heroAnim.to : heroAnim.from)
    : null;

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
            borderRadius: heroAnimActive ? heroAnim.borderRadius : heroAnim.fromBorderRadius,
            left: heroRect.x,
            top: heroRect.y,
            width: heroRect.width,
            height: heroRect.height,
            transform: heroUsesBoundsAnimation ? 'translate3d(0, 0, 0)' : heroTransform,
            transformOrigin: 'top left',
            willChange: heroUsesBoundsAnimation ? 'left, top, width, height, border-radius' : 'transform, border-radius',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            contain: 'layout paint style',
            isolation: 'isolate',
            backgroundColor: heroAnim.hasContainFill ? '#000' : 'transparent',
            transition: heroAnimActive
              ? heroUsesBoundsAnimation
                ? `left ${HERO_CLOSE_MS}ms ${HERO_EASING}, top ${HERO_CLOSE_MS}ms ${HERO_EASING}, width ${HERO_CLOSE_MS}ms ${HERO_EASING}, height ${HERO_CLOSE_MS}ms ${HERO_EASING}, border-radius ${HERO_CLOSE_MS}ms ${HERO_EASING}`
                : `transform ${HERO_CLOSE_MS}ms ${HERO_EASING}, border-radius ${HERO_CLOSE_MS}ms ${HERO_EASING}`
              : 'none',
          }}
          onTransitionEnd={(e) => {
            if (e.currentTarget !== e.target) return;
            if (heroUsesBoundsAnimation && e.propertyName === 'width') finishHeroClose();
            if (!heroUsesBoundsAnimation && e.propertyName === 'transform') finishHeroClose();
          }}
        >
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
        }}
      />

      <div
        aria-hidden="true"
        style={{
          ...styles.bottomScrim,
          opacity: closingPassthrough ? 0 : dragY > 0 ? Math.max(0, 1 - dragY / 280) : 1,
          transition: closingPassthrough ? 'opacity 0.18s ease' : dragY > 0 ? 'none' : undefined,
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
          animation: isReducedPerformance ? 'mv-fade-in 0.16s ease' : styles.container.animation,
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
          style={{
            ...styles.swiper,
            overflowX: isZoomed ? 'hidden' : styles.swiper.overflowX,
            scrollSnapType: isZoomed ? 'none' : styles.swiper.scrollSnapType,
            touchAction: isZoomed ? 'none' : styles.swiper.touchAction,
            scrollBehavior: viewerScrollBehavior,
          }}
        >
          {items.map((media, idx) => {
            const isCurrent = idx === currentIndex;
            const shouldRenderMedia = Math.abs(idx - currentIndex) <= 1;
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
                    if (dy > 0 && absY > absX * SWIPE_AXIS_LOCK_RATIO) {
                      swipeDirRef.current = 'v';
                    } else if (absX > absY * SWIPE_AXIS_LOCK_RATIO) {
                      swipeDirRef.current = 'h';
                      if (dragYRef.current !== 0) resetDrag();
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
                    if (dragYRef.current !== 0) resetDrag();
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
                {!shouldRenderMedia ? (
                  <div style={styles.virtualSlidePlaceholder} />
                ) : media.type === 'video' ? (
                  <VideoSlide
                    media={media}
                    isActive={isCurrent}
                    isClosing={closingPassthrough}
                    showUI={showUI}
                    toggleUI={toggleUI}
                    mediaRef={isCurrent ? currentMediaRef : null}
                  />
                ) : (
                  <div onClick={toggleUI} style={styles.imageSlide}>
                    <Zoomable
                      isActive={isCurrent}
                      onTap={(e) => {
                        e.stopPropagation();
                        toggleUI();
                      }}
                      onZoomStart={() => {
                        touchStartY.current = null;
                        touchStartX.current = null;
                        swipeDirRef.current = null;
                        resetDrag();
                        setIsZoomed(true);
                      }}
                      onZoomEnd={() => {
                        touchStartY.current = null;
                        touchStartX.current = null;
                        swipeDirRef.current = null;
                        resetDrag();
                        setIsZoomed(false);
                      }}
                    >
                      <img
                        ref={isCurrent ? currentMediaRef : null}
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
            onClick={() => scrollRef.current?.scrollBy({ left: -scrollRef.current.clientWidth, behavior: viewerScrollBehavior })}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {showUI && currentIndex < items.length - 1 && (
          <button
            type="button"
            style={{ ...styles.navBtn, right: 16 }}
            onClick={() => scrollRef.current?.scrollBy({ left: scrollRef.current.clientWidth, behavior: viewerScrollBehavior })}
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
    bottom: 0,
    left: 'var(--app-fixed-left, 0px)',
    width: 'var(--app-fixed-width, 100%)',
    backgroundColor: 'rgba(0,0,0,0.95)',
    zIndex: Z_PHOTO_VIEWER - 1,
    animation: 'mv-fade-in 0.2s ease',
  },
  bottomScrim: {
    position: 'fixed',
    left: 'var(--app-fixed-left, 0px)',
    width: 'var(--app-fixed-width, 100%)',
    bottom: 0,
    height: 'calc(132px + max(env(safe-area-inset-bottom, 0px), var(--tg-safe-area-bottom, 0px), var(--tg-content-safe-area-bottom, 0px)))',
    zIndex: Z_PHOTO_VIEWER - 1,
    pointerEvents: 'none',
    background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 42%, transparent 100%)',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  },
  container: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left, 0px)',
    width: 'var(--app-fixed-width, 100%)',
    zIndex: Z_PHOTO_VIEWER,
    display: 'flex',
    flexDirection: 'column',
    background: '#000',
    animation: 'mv-fade-in-scale 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
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
  virtualSlidePlaceholder: {
    width: '100%',
    height: '100%',
    background: '#000',
  },
  zoomViewport: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    cursor: 'pointer',
  },
  zoomable: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    transformOrigin: 'top left',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'contain',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    pointerEvents: 'none',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
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
