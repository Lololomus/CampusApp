import { getDocumentsConfig } from '../api';

export const MAX_DOCUMENTS_PER_POST = 3;
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

export const DOCUMENT_ACCEPT = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.rtf',
  '.txt',
].join(',');

export const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'xlsx',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'txt',
]);

const FALLBACK_CONFIG = Object.freeze({
  max_size_bytes: MAX_DOCUMENT_SIZE_BYTES,
  max_per_post: MAX_DOCUMENTS_PER_POST,
  allowed_extensions: Array.from(DOCUMENT_EXTENSIONS),
});

let cachedConfig = FALLBACK_CONFIG;
let configFetchStarted = false;

function applyConfig(raw) {
  if (!raw || typeof raw !== 'object') return FALLBACK_CONFIG;
  const maxSize = Number(raw.max_size_bytes);
  const maxPerPost = Number(raw.max_per_post);
  const allowed = Array.isArray(raw.allowed_extensions)
    ? raw.allowed_extensions
        .map((ext) => String(ext || '').toLowerCase().replace(/^\./, ''))
        .filter(Boolean)
    : null;
  cachedConfig = Object.freeze({
    max_size_bytes: Number.isFinite(maxSize) && maxSize > 0 ? maxSize : FALLBACK_CONFIG.max_size_bytes,
    max_per_post: Number.isFinite(maxPerPost) && maxPerPost > 0 ? maxPerPost : FALLBACK_CONFIG.max_per_post,
    allowed_extensions: allowed && allowed.length > 0 ? allowed : FALLBACK_CONFIG.allowed_extensions,
  });
  return cachedConfig;
}

export function ensureDocumentsConfigLoaded() {
  if (configFetchStarted) return cachedConfig;
  configFetchStarted = true;
  getDocumentsConfig()
    .then(applyConfig)
    .catch(() => {
      configFetchStarted = false;
    });
  return cachedConfig;
}

export function getCachedDocumentsConfig() {
  return cachedConfig;
}

export const getDocumentExtension = (name = '') => {
  const value = String(name || '').toLowerCase();
  const index = value.lastIndexOf('.');
  return index >= 0 ? value.slice(index + 1) : '';
};

export const formatDocumentSize = (bytes = 0) => {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
};

export const getDocumentTypeLabel = (ext = '') => {
  const normalized = String(ext || '').toLowerCase().replace(/^\./, '');
  if (normalized === 'pdf') return 'PDF';
  if (['docx', 'odt', 'rtf', 'txt'].includes(normalized)) return normalized === 'txt' ? 'Текст' : 'Word';
  if (['xlsx', 'ods'].includes(normalized)) return 'Excel';
  if (['pptx', 'odp'].includes(normalized)) return 'PowerPoint';
  return 'Документ';
};

export const validateDocumentFile = (file) => {
  if (!file) return { valid: false, error: 'Файл не выбран' };
  ensureDocumentsConfigLoaded();
  const config = cachedConfig;
  const ext = getDocumentExtension(file.name);
  const allowed = new Set(config.allowed_extensions);
  if (!allowed.has(ext)) {
    return { valid: false, error: 'Этот формат документа не поддерживается' };
  }
  if (file.size > config.max_size_bytes) {
    const limitMb = Math.round(config.max_size_bytes / (1024 * 1024));
    return { valid: false, error: `Документ слишком большой. Максимум ${limitMb} МБ` };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'Документ пустой' };
  }
  return { valid: true };
};
