const DATA_OR_BLOB_PREFIX = /^(data:|blob:)/i;
const HTTP_PREFIX = /^https?:\/\//i;

const normalizeSlashes = (value) => String(value ?? '').trim().replace(/\\/g, '/');

const normalizeUploadsPath = (value) => {
  if (!value) return '';
  if (value.startsWith('/uploads/')) return value;
  if (value.startsWith('uploads/')) return `/${value}`;
  return '';
};

const extractUploadsPathFromAbsolute = (value) => {
  try {
    const parsed = new URL(value);
    const path = normalizeSlashes(parsed.pathname);
    const markerIndex = path.indexOf('/uploads/');
    if (markerIndex >= 0) {
      return path.slice(markerIndex);
    }
  } catch {
    return '';
  }
  return '';
};

export const resolveImageUrl = (value, kind = 'images') => {
  const raw = normalizeSlashes(value);
  if (!raw) return '';

  if (DATA_OR_BLOB_PREFIX.test(raw)) return raw;

  const uploadsPath = normalizeUploadsPath(raw);
  if (uploadsPath) return uploadsPath;

  if (HTTP_PREFIX.test(raw)) {
    const legacyUploadsPath = extractUploadsPathFromAbsolute(raw);
    return legacyUploadsPath || raw;
  }

  const withoutHash = raw.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  const filename = withoutQuery.split('/').pop();
  if (!filename) return '';

  const folder = kind === 'avatars' ? 'avatars' : 'images';
  return `/uploads/${folder}/${filename}`;
};
