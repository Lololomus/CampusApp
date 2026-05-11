import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Download, File, FileSpreadsheet, FileText, FileType, Presentation } from 'lucide-react';

import { getDocumentDownloadUrl } from '../../api';
import theme from '../../theme';
import { formatDocumentSize, getDocumentTypeLabel } from '../../utils/documentValidation';
import { downloadFile as telegramDownloadFile } from '../../utils/telegram';
import { toast } from '../shared/Toast';

const DocumentViewerModal = lazy(() => import('./DocumentViewerModal'));

const getIcon = (ext) => {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === 'pdf') return FileType;
  if (['docx', 'odt', 'rtf', 'txt'].includes(normalized)) return FileText;
  if (['xlsx', 'ods'].includes(normalized)) return FileSpreadsheet;
  if (['pptx', 'odp'].includes(normalized)) return Presentation;
  return File;
};

const getAccent = (ext) => {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === 'pdf') return '#FF6B6B';
  if (['docx', 'odt', 'rtf', 'txt'].includes(normalized)) return '#4DA6FF';
  if (['xlsx', 'ods'].includes(normalized)) return '#32D74B';
  if (['pptx', 'odp'].includes(normalized)) return '#FF9F0A';
  return theme.colors.premium.primary;
};

function DocumentAttachmentList({ documents = [], compact = false }) {
  const [viewerDocument, setViewerDocument] = useState(null);
  const items = useMemo(
    () => (Array.isArray(documents) ? documents.filter(Boolean) : []),
    [documents],
  );
  if (!items.length) return null;

  const handleDownload = async (event, document) => {
    event.stopPropagation();
    try {
      const url = await getDocumentDownloadUrl(document.id);
      telegramDownloadFile(url, document.original_filename || 'document');
    } catch {
      toast.error('Не удалось скачать документ');
    }
  };

  return (
    <>
      <div style={{ ...styles.list, ...(compact ? styles.listCompact : {}) }}>
        {items.map((document) => {
          const Icon = getIcon(document.file_ext);
          const typeLabel = getDocumentTypeLabel(document.file_ext);
          const canPreview = document.has_preview && document.preview_status === 'ready';
          const canDownload = document.scan_status === 'clean' && Boolean(document.download_url);
          const isProcessing = document.scan_status === 'pending' || document.preview_status === 'pending';
          const accent = getAccent(document.file_ext);

          return (
            <button
              key={document.id}
              type="button"
              style={styles.item}
              onClick={(event) => {
                event.stopPropagation();
                setViewerDocument(document);
              }}
            >
              <span style={{ ...styles.iconWrap, color: accent, background: `${accent}1F` }}>
                <Icon size={20} />
              </span>
              <span style={styles.textWrap}>
                <span style={styles.name}>{document.original_filename}</span>
                <span style={styles.meta}>
                  <span style={styles.metaPart}>{typeLabel}</span>
                  <span style={styles.dot} />
                  <span style={styles.metaPart}>{formatDocumentSize(document.size_bytes)}</span>
                  {!canPreview ? (
                    <>
                      <span style={styles.dot} />
                      <span style={styles.unavailable}>
                        {isProcessing ? 'пост дорабатывается' : 'просмотр недоступен'}
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <span
                role="button"
                tabIndex={0}
                style={{ ...styles.download, ...(!canDownload ? styles.downloadDisabled : {}) }}
                onClick={(event) => {
                  if (!canDownload) {
                    event.stopPropagation();
                    return;
                  }
                  handleDownload(event, document);
                }}
                onKeyDown={(event) => {
                  if (canDownload && (event.key === 'Enter' || event.key === ' ')) handleDownload(event, document);
                }}
                aria-label="Скачать документ"
              >
                <Download size={17} />
              </span>
            </button>
          );
        })}
      </div>
      {viewerDocument ? (
        <Suspense fallback={null}>
          <DocumentViewerModal document={viewerDocument} onClose={() => setViewerDocument(null)} />
        </Suspense>
      ) : null}
    </>
  );
}

const styles = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '0 0 8px',
  },
  listCompact: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  item: {
    width: '100%',
    minHeight: 52,
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.premium.border}`,
    background: 'rgba(255,255,255,0.03)',
    color: theme.colors.text,
    padding: '8px 8px 8px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    WebkitTapHighlightColor: 'transparent',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    minWidth: 0,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    fontSize: 11,
    fontWeight: 600,
    color: theme.colors.premium.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metaPart: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.22)',
    flexShrink: 0,
  },
  unavailable: {
    color: theme.colors.premium.textMuted,
    flexShrink: 0,
  },
  download: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.lg,
    color: theme.colors.text,
    background: theme.colors.premium.border,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  downloadDisabled: {
    opacity: 0.35,
  },
};

export default DocumentAttachmentList;
