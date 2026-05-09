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

function DocumentViewerModal({ document, onClose }) {
  const [status, setStatus] = useState('loading');
  const [pageCount, setPageCount] = useState(0);
  const [hasPageSkeletons, setHasPageSkeletons] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const containerRef = useRef(null);
  const objectUrlRef = useRef('');
  const closeTimerRef = useRef(null);
  const isOpen = Boolean(document);
  const showDevBackButton = import.meta.env.DEV;

  useBodyScrollLock(isOpen);

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
    };
  }, [isOpen, document?.id]);

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
      disabled={isExiting}
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

        <div style={styles.body}>
          {status === 'loading' && !hasPageSkeletons && (
            <div style={styles.state}>
              <Loader2 size={24} className="spin" />
              <span style={styles.stateTitle}>Готовим предпросмотр</span>
              <span style={styles.stateText}>Документ откроется здесь после загрузки PDF-версии.</span>
            </div>
          )}
          <div ref={containerRef} style={styles.pages} />
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
  },
  pages: {
    minHeight: 0,
  },
  state: {
    minHeight: 360,
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
