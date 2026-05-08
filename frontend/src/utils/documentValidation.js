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
  const ext = getDocumentExtension(file.name);
  if (!DOCUMENT_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Этот формат документа не поддерживается' };
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { valid: false, error: 'Документ слишком большой. Максимум 25 МБ' };
  }
  if (file.size <= 0) {
    return { valid: false, error: 'Документ пустой' };
  }
  return { valid: true };
};
