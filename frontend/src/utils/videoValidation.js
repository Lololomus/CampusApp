import {
  VIDEO_INPUT_MAX_BYTES,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_OUTPUT_MAX_BYTES,
} from './videoConstants';
import {
  getFileExtension,
  isClientVideoTranscodeSupported,
  isIsoBmffVideoFile,
  shouldRunClientVideoTranscode,
} from './videoTranscode/capabilities';

const SUPPORTED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];

export const isVideoFileCandidate = (file) => {
  if (!file) return false;
  const mimeType = String(file.type || '').toLowerCase();
  const ext = getFileExtension(file.name);
  return mimeType.startsWith('video/') || SUPPORTED_VIDEO_EXTENSIONS.includes(ext);
};

const loadVideoDuration = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('Unable to read video duration'));
        return;
      }
      resolve(duration);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Unable to read video file'));
    };

    video.src = objectUrl;
  });

/** Размеры отображения (как в плеере; часто уже с учётом ориентации). */
const loadVideoDisplayDimensions = (file) =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const done = (w, h) => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve({ width: w, height: h });
    };
    video.onloadedmetadata = () => {
      const w = Number(video.videoWidth) || 0;
      const h = Number(video.videoHeight) || 0;
      done(w, h);
    };
    video.onerror = () => done(0, 0);
    video.src = objectUrl;
  });

export const validateVideoFile = async (file) => {
  if (!file) {
    return { valid: false, error: 'Файл не выбран' };
  }

  const mimeType = String(file.type || '').toLowerCase();
  const extension = getFileExtension(file.name);
  const allowedByMime = SUPPORTED_VIDEO_MIME_TYPES.includes(mimeType);
  const allowedByExtension = SUPPORTED_VIDEO_EXTENSIONS.includes(extension);

  if (!allowedByMime && !allowedByExtension) {
    return { valid: false, error: 'Допустимы только MP4, MOV и WebM' };
  }

  if (file.size > VIDEO_INPUT_MAX_BYTES) {
    return {
      valid: false,
      error: `Видео слишком большое (макс. ${Math.floor(VIDEO_INPUT_MAX_BYTES / (1024 * 1024))} МБ до обработки)`,
    };
  }

  let durationSeconds;
  try {
    durationSeconds = await loadVideoDuration(file);
  } catch {
    return { valid: false, error: 'Не удалось прочитать видео. Выберите другой файл' };
  }

  if (durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    return {
      valid: false,
      error: `Видео слишком длинное (${durationSeconds.toFixed(1)} с). Максимум ${VIDEO_MAX_DURATION_SECONDS} с`,
    };
  }

  const displayDimensions = await loadVideoDisplayDimensions(file);
  const transcodeCandidate =
    isIsoBmffVideoFile(file) &&
    isClientVideoTranscodeSupported() &&
    shouldRunClientVideoTranscode(file);

  if (file.size > VIDEO_OUTPUT_MAX_BYTES) {
    const canLargeInput = isIsoBmffVideoFile(file) && isClientVideoTranscodeSupported();
    if (!canLargeInput) {
      return {
        valid: false,
        error:
          'Файл больше 100 МБ. Откройте приложение в браузере с поддержкой сжатия (например Chrome) или уменьшите видео',
      };
    }
  }

  const isWebm = extension === 'webm' || mimeType === 'video/webm';
  if (isWebm && file.size > VIDEO_OUTPUT_MAX_BYTES) {
    return {
      valid: false,
      error: 'WebM больше 100 МБ не поддерживается. Конвертируйте в MP4 или уменьшите файл',
    };
  }

  return {
    valid: true,
    durationSeconds,
    displayDimensions,
    willTranscode: Boolean(transcodeCandidate),
  };
};

export { getFileExtension as getVideoFileExtension };
