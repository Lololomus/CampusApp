import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Download, FileText, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

import { getDocumentDownloadBlob, getDocumentPreviewBlob } from '../../api';
import { Z_PHOTO_VIEWER } from '../../constants/zIndex';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import theme from '../../theme';
import { formatDocumentSize } from '../../utils/documentValidation';
import { hapticFeedback } from '../../utils/telegram';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import { toast } from '../shared/Toast';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const MAX_PREVIEW_PAGES = 100;
const RENDER_AHEAD_PAGES = 1;
const MIN_DOCUMENT_ZOOM = 1;
const MAX_DOCUMENT_ZOOM = 4;
const DOUBLE_TAP_MS = 280;
const TAP_MOVE_THRESHOLD = 10;
const PAN_START_THRESHOLD = 4;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getTouchDistance = (touches) => {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
};

const getTouchMidpoint = (touches) => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});

function DocumentViewerModal({ document, onClose }) {
  const [status, setStatus] = useState('loading');
  const [pageCount, setPageCount] = useState(0);
  const [hasPageSkeletons, setHasPageSkeletons] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [zoomTransform, setZoomTransform] = useState({ scale: 1, x: 0, y: 0 });
  const bodyRef = useRef(null);
  const containerRef = useRef(null);
  const objectUrlRef = useRef('');
  const closeTimerRef = useRef(null);
  const zoomTransformRef = useRef(zoomTransform);
  const gestureRef = useRef(null);
  const tapStartRef = useRef(null);
  const lastTapRef = useRef(null);
  const singleTapTimerRef = useRef(null);
  const isOpen = Boolean(document);
  const showDevBackButton = import.meta.env.DEV;
  const isDocumentZoomed = zoomTransform.scale > 1.01;

  useBodyScrollLock(isOpen);

  const clampDocumentTransform = useCallback((next) => {
    const body = bodyRef.current;
    const content = containerRef.current;
    const scale = clamp(next.scale, MIN_DOCUMENT_ZOOM, MAX_DOCUMENT_ZOOM);
    if (!body || !content || scale <= 1.01) {
      return { scale: 1, x: 0, y: 0 };
    }

    const viewportWidth = body.clientWidth || 0;
    const viewportHeight = body.clientHeight || 0;
    const contentWidth = content.scrollWidth || content.offsetWidth || viewportWidth;
    const contentHeight = content.scrollHeight || content.offsetHeight || viewportHeight;
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;
    const scrollTop = body.scrollTop || 0;
    const minX = Math.min(0, viewportWidth - scaledWidth);
    const minY = Math.min(scrollTop, scrollTop + viewportHeight - scaledHeight);

    return {
      scale,
      x: clamp(next.x, minX, 0),
      y: clamp(next.y, minY, scrollTop),
    };
  }, []);

  const applyZoomTransform = useCallback((next) => {
    const clamped = clampDocumentTransform(next);
    zoomTransformRef.current = clamped;
    setZoomTransform(clamped);
    return clamped;
  }, [clampDocumentTransform]);

  const resetZoom = useCallback(() => {
    applyZoomTransform({ scale: 1, x: 0, y: 0 });
  }, [applyZoomTransform]);

  const zoomAt = useCallback((clientX, clientY, nextScale) => {
    const body = bodyRef.current;
    const rect = body?.getBoundingClientRect?.();
    if (!body || !rect) return;

    const current = zoomTransformRef.current;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const scrollTop = body.scrollTop || 0;
    const contentX = (localX - current.x) / current.scale;
    const contentY = (localY + scrollTop - current.y) / current.scale;

    applyZoomTransform({
      scale: nextScale,
      x: localX - contentX * nextScale,
      y: localY + scrollTop - contentY * nextScale,
    });
  }, [applyZoomTransform]);

  const clearSingleTapTimer = useCallback(() => {
    if (singleTapTimerRef.current) {
      window.clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
  }, []);

  const handleDoubleTapZoom = useCallback((clientX, clientY) => {
    clearSingleTapTimer();
    lastTapRef.current = null;
    if (zoomTransformRef.current.scale > 1.01) {
      resetZoom();
    } else {
      zoomAt(clientX, clientY, MAX_DOCUMENT_ZOOM);
    }
  }, [clearSingleTapTimer, resetZoom, zoomAt]);

  const registerTap = useCallback((clientX, clientY) => {
    const now = Date.now();
    const previousTap = lastTapRef.current;
    if (
      previousTap &&
      now - previousTap.time <= DOUBLE_TAP_MS &&
      Math.hypot(clientX - previousTap.x, clientY - previousTap.y) <= TAP_MOVE_THRESHOLD * 2
    ) {
      handleDoubleTapZoom(clientX, clientY);
      return;
    }

    clearSingleTapTimer();
    lastTapRef.current = { time: now, x: clientX, y: clientY };
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = null;
      lastTapRef.current = null;
    }, DOUBLE_TAP_MS);
  }, [clearSingleTapTimer, handleDoubleTapZoom]);

  const handleClose = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    setIsExiting(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose?.();
    }, 320);
  }, [isExiting, onClose]);

  useTelegramScreen(isOpen ? {
    id: 'document-viewer-modal',
    title: '',
    priority: Z_PHOTO_VIEWER + 20,
    back: {
      visible: true,
      onClick: handleClose,
    },
  } : { id: null });

  useEffect(() => {
    if (!isOpen) return undefined;
    ensureDocumentPreviewStyles();
    setIsExiting(false);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      clearSingleTapTimer();
    };
  }, [clearSingleTapTimer, isOpen, document?.id]);

  useEffect(() => {
    resetZoom();
  }, [document?.id, resetZoom]);

  useEffect(() => {
    let cancelled = false;
    let pdf = null;
    const slots = [];
    const visibleSet = new Set();
    let observer = null;

    const cleanup = () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      for (const slot of slots) {
        if (slot.renderTask) {
          try { slot.renderTask.cancel(); } catch (_err) { /* noop */ }
          slot.renderTask = null;
        }
        if (slot.canvas) slot.canvas.remove();
        if (slot.placeholder) slot.placeholder.remove();
      }
      slots.length = 0;
      if (pdf) {
        try { pdf.destroy(); } catch (_err) { /* noop */ }
        pdf = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };

    const buildSkeleton = (pageNumber, viewport) => {
      const placeholder = documentRef().createElement('div');
      placeholder.className = 'document-preview-skeleton';
      placeholder.dataset.pageNumber = String(pageNumber);
      placeholder.style.width = '100%';
      placeholder.style.maxWidth = `${Math.floor(viewport.width)}px`;
      placeholder.style.aspectRatio = `${Math.floor(viewport.width)} / ${Math.floor(viewport.height)}`;
      placeholder.style.margin = '0 auto 14px';
      placeholder.style.borderRadius = '6px';
      placeholder.style.boxShadow = '0 10px 30px rgba(0,0,0,0.22)';
      return placeholder;
    };

    const renderSlot = (slot) => {
      if (slot.canvas || slot.renderTask) return;
      const canvas = documentRef().createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.floor(slot.viewport.width);
      canvas.height = Math.floor(slot.viewport.height);
      canvas.style.width = '100%';
      canvas.style.maxWidth = `${Math.floor(slot.viewport.width)}px`;
      canvas.style.height = 'auto';
      canvas.style.display = 'block';
      canvas.style.margin = '0 auto 14px';
      canvas.style.borderRadius = '6px';
      canvas.style.background = '#fff';
      canvas.style.boxShadow = '0 10px 30px rgba(0,0,0,0.28)';
      canvas.dataset.pageNumber = String(slot.pageNumber);

      const previousNode = slot.canvas || slot.placeholder;
      previousNode.replaceWith(canvas);
      if (slot.placeholder && slot.placeholder !== previousNode) {
        slot.placeholder.remove();
      }
      slot.placeholder = null;
      slot.canvas = canvas;
      observer?.observe(canvas);

      const task = slot.page.render({ canvasContext: ctx, viewport: slot.viewport });
      slot.renderTask = task;
      task.promise
        .catch(() => { /* cancellation or transient error */ })
        .finally(() => {
          if (slot.renderTask === task) {
            slot.renderTask = null;
          }
        });
    };

    const unrenderSlot = (slot) => {
      if (slot.renderTask) {
        try { slot.renderTask.cancel(); } catch (_err) { /* noop */ }
        slot.renderTask = null;
      }
      if (!slot.canvas) return;
      const placeholder = buildSkeleton(slot.pageNumber, slot.viewport);
      slot.canvas.replaceWith(placeholder);
      slot.canvas = null;
      slot.placeholder = placeholder;
      observer?.observe(placeholder);
    };

    const updateVisible = () => {
      const desired = new Set();
      for (const num of visibleSet) {
        for (let d = -RENDER_AHEAD_PAGES; d <= RENDER_AHEAD_PAGES; d += 1) {
          const target = num + d;
          if (target >= 1 && target <= slots.length) {
            desired.add(target);
          }
        }
      }
      for (const slot of slots) {
        if (desired.has(slot.pageNumber)) {
          renderSlot(slot);
        } else if (slot.canvas) {
          unrenderSlot(slot);
        }
      }
    };

    const start = async () => {
      cleanup();
      setHasPageSkeletons(false);
      setPageCount(0);
      if (!document?.id || !document?.has_preview) {
        setStatus('unavailable');
        return;
      }
      setStatus('loading');

      const blob = await getDocumentPreviewBlob(document.id);
      if (cancelled) return;
      objectUrlRef.current = URL.createObjectURL(blob);
      pdf = await pdfjsLib.getDocument(objectUrlRef.current).promise;
      if (cancelled) return;

      setPageCount(pdf.numPages);
      if (pdf.numPages > MAX_PREVIEW_PAGES) {
        setStatus('too_large');
        return;
      }

      ensureDocumentPreviewStyles();
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const containerWidth = Math.min(containerRef.current?.clientWidth || 360, 920);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.max(0.7, Math.min(2, (containerWidth - 28) / baseViewport.width));
        const viewport = page.getViewport({ scale });

        const placeholder = buildSkeleton(pageNumber, viewport);
        containerRef.current?.appendChild(placeholder);
        slots.push({
          pageNumber,
          page,
          viewport,
          placeholder,
          canvas: null,
          renderTask: null,
        });
      }

      if (cancelled) return;
      setHasPageSkeletons(true);
      setStatus('ready');

      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const num = Number(entry.target.dataset.pageNumber);
          if (!num) continue;
          if (entry.isIntersecting) {
            visibleSet.add(num);
          } else {
            visibleSet.delete(num);
          }
        }
        updateVisible();
      }, {
        root: containerRef.current,
        rootMargin: '300px 0px',
        threshold: 0,
      });

      for (const slot of slots) {
        observer.observe(slot.placeholder);
      }
    };

    start().catch((error) => {
      console.error('Document preview failed:', error);
      if (!cancelled) {
        cleanup();
        setHasPageSkeletons(false);
        setStatus('failed');
      }
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [document?.id, document?.has_preview]);

  const handleDownload = async () => {
    if (!document?.id) return;
    try {
      const blob = await getDocumentDownloadBlob(document.id);
      const url = URL.createObjectURL(blob);
      const link = documentRef().createElement('a');
      link.href = url;
      link.download = document.original_filename || 'document';
      documentRef().body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Document download failed:', error);
      toast.error('Не удалось скачать документ');
    }
  };

  if (!document) return null;

  const content = (
    <EdgeSwipeBack
      onBack={onClose}
      disabled={isExiting || isDocumentZoomed}
      iosOnly={false}
      zIndex={Z_PHOTO_VIEWER + 20}
    >
      <div
        style={{
          ...styles.sheet,
          animation: isExiting
            ? 'documentViewerSlideOutRight 0.32s cubic-bezier(0.32, 0.72, 0, 1) forwards'
            : 'documentViewerSlideInRight 0.34s cubic-bezier(0.32, 0.72, 0, 1) forwards',
          pointerEvents: isExiting ? 'none' : 'auto',
        }}
      >
        <div style={styles.header}>
          {showDevBackButton && (
            <button type="button" style={styles.navButton} onClick={handleClose} aria-label="Закрыть">
              <ChevronLeft size={24} strokeWidth={2.4} />
            </button>
          )}

          <div style={styles.fileBlock}>
            <span style={styles.fileIcon}>
              <FileText size={18} />
            </span>
            <div style={styles.titleWrap}>
              <div style={styles.title}>{document.original_filename}</div>
              <div style={styles.meta}>
                {formatDocumentSize(document.size_bytes)}
                {pageCount > 0 ? ` · ${pageCount} стр.` : ''}
              </div>
            </div>
          </div>

          <button type="button" style={styles.actionButton} onClick={handleDownload} aria-label="Скачать документ">
            <Download size={19} strokeWidth={2.4} />
          </button>
        </div>

        <div
          ref={bodyRef}
          style={{
            ...styles.body,
            touchAction: isDocumentZoomed ? 'none' : 'pan-y',
          }}
          onTouchStart={(e) => {
            if (status !== 'ready') return;
            if (e.touches.length === 2) {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
              const midpoint = getTouchMidpoint(e.touches);
              gestureRef.current = {
                type: 'pinch',
                lastDistance: getTouchDistance(e.touches),
                lastMidpoint: midpoint,
              };
              tapStartRef.current = null;
              clearSingleTapTimer();
              return;
            }

            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            tapStartRef.current = {
              x: touch.clientX,
              y: touch.clientY,
              time: Date.now(),
              moved: false,
            };

            if (zoomTransformRef.current.scale > 1.01) {
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
          }}
          onTouchMove={(e) => {
            if (status !== 'ready') return;
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
              const distance = getTouchDistance(e.touches);
              const distanceRatio = gesture.lastDistance ? distance / gesture.lastDistance : 1;
              const current = zoomTransformRef.current;
              const nextScale = clamp(current.scale * distanceRatio, MIN_DOCUMENT_ZOOM, MAX_DOCUMENT_ZOOM);
              const midpoint = getTouchMidpoint(e.touches);
              zoomAt(midpoint.x, midpoint.y, nextScale);
              gesture.lastDistance = distance;
              gesture.lastMidpoint = midpoint;
              return;
            }

            if (gesture.type === 'pan' && e.touches.length === 1) {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
              const touch = e.touches[0];
              const totalDx = touch.clientX - gesture.startX;
              const totalDy = touch.clientY - gesture.startY;
              if (!gesture.moved && Math.hypot(totalDx, totalDy) < PAN_START_THRESHOLD) return;

              gesture.moved = true;
              if (tapStartRef.current) tapStartRef.current.moved = true;
              const current = zoomTransformRef.current;
              applyZoomTransform({
                scale: current.scale,
                x: current.x + touch.clientX - gesture.lastX,
                y: current.y + touch.clientY - gesture.lastY,
              });
              gesture.lastX = touch.clientX;
              gesture.lastY = touch.clientY;
            }
          }}
          onTouchEnd={(e) => {
            const tapStart = tapStartRef.current;
            const changedTouch = e.changedTouches?.[0];
            const isTapCandidate = Boolean(
              changedTouch &&
              tapStart &&
              !tapStart.moved &&
              Date.now() - tapStart.time <= 450 &&
              Math.hypot(changedTouch.clientX - tapStart.x, changedTouch.clientY - tapStart.y) <= TAP_MOVE_THRESHOLD
            );

            if (gestureRef.current || isDocumentZoomed || isTapCandidate) {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
            }

            if (e.touches.length === 0) {
              gestureRef.current = null;
              tapStartRef.current = null;
              if (zoomTransformRef.current.scale <= 1.01) resetZoom();
              if (isTapCandidate) registerTap(changedTouch.clientX, changedTouch.clientY);
            } else if (e.touches.length === 1 && zoomTransformRef.current.scale > 1.01) {
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
            if (gestureRef.current || isDocumentZoomed) {
              if (e.cancelable) e.preventDefault();
              e.stopPropagation();
            }
            gestureRef.current = null;
            tapStartRef.current = null;
            if (zoomTransformRef.current.scale <= 1.01) resetZoom();
          }}
          onDoubleClick={(e) => {
            if (status !== 'ready') return;
            e.preventDefault();
            e.stopPropagation();
            handleDoubleTapZoom(e.clientX, e.clientY);
          }}
          onWheel={(e) => {
            if (status !== 'ready') return;
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              e.stopPropagation();
              const current = zoomTransformRef.current;
              const nextScale = clamp(current.scale * (e.deltaY < 0 ? 1.12 : 0.88), MIN_DOCUMENT_ZOOM, MAX_DOCUMENT_ZOOM);
              zoomAt(e.clientX, e.clientY, nextScale);
              return;
            }
            if (zoomTransformRef.current.scale > 1.01) {
              e.preventDefault();
              e.stopPropagation();
              const current = zoomTransformRef.current;
              applyZoomTransform({
                scale: current.scale,
                x: current.x - e.deltaX,
                y: current.y - e.deltaY,
              });
            }
          }}
        >
          {status === 'loading' && !hasPageSkeletons && (
            <div style={styles.state}>
              <Loader2 size={24} className="document-preview-spinner" />
              <span style={styles.stateTitle}>Готовим предпросмотр</span>
              <span style={styles.stateText}>Документ откроется здесь после загрузки PDF-версии.</span>
            </div>
          )}
          <div
            ref={containerRef}
            style={{
              ...styles.pages,
              transform: `translate3d(${zoomTransform.x}px, ${zoomTransform.y}px, 0) scale(${zoomTransform.scale})`,
              transition: gestureRef.current ? 'none' : 'transform 0.24s cubic-bezier(0.32, 0.72, 0, 1)',
              cursor: isDocumentZoomed ? 'grab' : 'zoom-in',
              willChange: isDocumentZoomed ? 'transform' : undefined,
            }}
          />
          {status === 'unavailable' && !hasPageSkeletons && (
            <div style={styles.state}>
              <FileText size={28} />
              <span style={styles.stateTitle}>Предпросмотр недоступен</span>
              <span style={styles.stateText}>Оригинал можно скачать и открыть на устройстве.</span>
              <button type="button" style={styles.downloadButton} onClick={handleDownload}>Скачать оригинал</button>
            </div>
          )}
          {status === 'too_large' && !hasPageSkeletons && (
            <div style={styles.state}>
              <FileText size={28} />
              <span style={styles.stateTitle}>Документ слишком большой</span>
              <span style={styles.stateText}>В предпросмотре больше {MAX_PREVIEW_PAGES} страниц. Скачайте оригинал, чтобы открыть.</span>
              <button type="button" style={styles.downloadButton} onClick={handleDownload}>Скачать оригинал</button>
            </div>
          )}
          {status === 'failed' && !hasPageSkeletons && (
            <div style={styles.state}>
              <FileText size={28} />
              <span style={styles.stateTitle}>Не удалось открыть предпросмотр</span>
              <span style={styles.stateText}>Попробуйте скачать оригинал документа.</span>
              <button type="button" style={styles.downloadButton} onClick={handleDownload}>Скачать оригинал</button>
            </div>
          )}
        </div>
      </div>
    </EdgeSwipeBack>
  );

  return createPortal(content, documentRef().body);
}

const documentRef = () => window.document;

const ensureDocumentPreviewStyles = () => {
  const id = 'document-preview-modal-styles';
  if (documentRef().getElementById(id)) return;
  const style = documentRef().createElement('style');
  style.id = id;
  style.textContent = `
    @keyframes documentPreviewShimmer {
      0% { background-position: 120% 0; }
      100% { background-position: -120% 0; }
    }
    @keyframes documentPreviewSpin {
      to { transform: rotate(360deg); }
    }
    .document-preview-spinner {
      animation: documentPreviewSpin 0.85s linear infinite;
      transform-origin: center;
    }
    .document-preview-skeleton {
      background:
        linear-gradient(110deg, rgba(255,255,255,0.035) 8%, rgba(255,255,255,0.10) 18%, rgba(255,255,255,0.035) 33%),
        #151515;
      background-size: 220% 100%;
      animation: documentPreviewShimmer 1.15s linear infinite;
    }
    @keyframes documentViewerSlideInRight {
      from { transform: translate3d(100%, 0, 0); }
      to { transform: translate3d(0, 0, 0); }
    }
    @keyframes documentViewerSlideOutRight {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(100%, 0, 0); }
    }
  `;
  documentRef().head.appendChild(style);
};

const styles = {
  sheet: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#080808',
    color: theme.colors.text,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '-16px 0 34px rgba(0,0,0,0.22)',
  },
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 'calc(22px + var(--screen-bottom-offset, 0px))',
    zIndex: 2,
    minHeight: 54,
    padding: '7px 9px',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    border: `1px solid ${theme.colors.premium.border}`,
    borderRadius: 22,
    background: 'rgba(21,21,22,0.94)',
    boxShadow: '0 18px 50px rgba(0,0,0,0.48)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    flexShrink: 0,
    touchAction: 'none',
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: 'none',
    background: theme.colors.premium.border,
    color: theme.colors.text,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  fileBlock: {
    minWidth: 0,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fileIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.premium.primary,
    background: 'rgba(212,255,0,0.12)',
    flexShrink: 0,
  },
  titleWrap: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    marginTop: 2,
    color: theme.colors.premium.textMuted,
    fontSize: 12,
    fontWeight: 600,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: 'none',
    background: theme.colors.premium.border,
    color: theme.colors.text,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 12px calc(96px + var(--screen-bottom-offset, 0px))',
    background: '#080808',
    WebkitOverflowScrolling: 'touch',
    display: 'flex',
    flexDirection: 'column',
  },
  pages: {
    minHeight: 0,
  },
  state: {
    flex: 1,
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.premium.textMuted,
    textAlign: 'center',
    padding: '0 28px',
  },
  stateTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 800,
  },
  stateText: {
    maxWidth: 280,
    fontSize: 13,
    lineHeight: 1.4,
    color: theme.colors.premium.textMuted,
  },
  downloadButton: {
    border: 'none',
    borderRadius: theme.radius.lg,
    padding: '11px 16px',
    background: theme.colors.premium.primary,
    color: theme.colors.premium.primaryText,
    fontWeight: 800,
    cursor: 'pointer',
    marginTop: 4,
  },
};

export default DocumentViewerModal;
