const MAX_FILE_SIZE_MB = 20;

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'];

const FALLBACK_PREVIEW =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22 viewBox=%220 0 240 240%22%3E%3Crect width=%22240%22 height=%22240%22 rx=%2224%22 fill=%22%231C1C1E%22/%3E%3Cpath d=%22M66 154l34-40 26 30 16-18 32 28H66z%22 fill=%22%235A5A60%22/%3E%3Ccircle cx=%2290%22 cy=%2282%22 r=%2218%22 fill=%22%23727278%22/%3E%3C/svg%3E';

const getFileExtension = (file) => {
  const name = file?.name || '';
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const validateImageFile = (file) => {
  const extension = getFileExtension(file);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(`Недопустимый формат: .${extension || 'unknown'}`);
  }

  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Файл не является изображением');
  }

  const fileSizeMB = file.size / 1024 / 1024;
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`Файл слишком большой: ${fileSizeMB.toFixed(1)}MB (макс ${MAX_FILE_SIZE_MB}MB)`);
  }

  return true;
};

export const compressImage = async (file, onProgress) => {
  validateImageFile(file);
  if (typeof onProgress === 'function') onProgress(100);
  return file;
};

export const processImageFiles = async (files) => {
  const fileArray = Array.from(files);
  const results = [];
  const failures = [];

  for (const file of fileArray) {
    try {
      const processed = await compressImage(file);
      let preview = URL.createObjectURL(processed);
      const dimensions = await getImageDimensions(preview);
      const previewError = !dimensions;

      if (previewError) {
        URL.revokeObjectURL(preview);
        preview = FALLBACK_PREVIEW;
      }

      results.push({
        file: processed,
        preview,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        previewError,
      });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Пропускаем файл:', file.name, err.message);
      failures.push({
        name: file?.name || 'Файл',
        message: err?.message || 'не удалось обработать',
      });
    }
  }

  Object.defineProperty(results, 'failures', {
    value: failures,
    enumerable: false,
  });
  return results;
};

export const getImageProcessingFailures = (processed) => (
  Array.isArray(processed?.failures) ? processed.failures : []
);

export const formatImageProcessingWarning = (processed, attemptedCount) => {
  const failures = getImageProcessingFailures(processed);
  const skippedCount = Math.max(failures.length, Math.max(0, attemptedCount - processed.length));
  if (skippedCount === 0) return '';

  const details = failures
    .slice(0, 2)
    .map((item) => `${item.name}: ${item.message}`)
    .join('; ');
  const suffix = failures.length > 2 ? `; ещё ${failures.length - 2}` : '';
  const reason = details ? ` ${details}${suffix}` : '';

  return `Добавлено ${processed.length} из ${attemptedCount}. Не добавлено ${skippedCount}.${reason}`;
};

const getImageDimensions = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      img.src = '';
    };
    img.onerror = () => {
      resolve(null);
      img.src = '';
    };
    img.src = url;
  });
};

export const revokeObjectURLs = (urls) => {
  urls.forEach(url => {
    if (typeof url === 'string' && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
};
