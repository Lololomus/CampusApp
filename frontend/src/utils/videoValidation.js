const SUPPORTED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];
const VIDEO_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const VIDEO_MAX_DURATION_SECONDS = 60;

const getFileExtension = (fileName = '') => {
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
};

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

export const validateVideoFile = async (file) => {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  const mimeType = String(file.type || '').toLowerCase();
  const extension = getFileExtension(file.name);
  const allowedByMime = SUPPORTED_VIDEO_MIME_TYPES.includes(mimeType);
  const allowedByExtension = SUPPORTED_VIDEO_EXTENSIONS.includes(extension);

  if (!allowedByMime && !allowedByExtension) {
    return { valid: false, error: 'Only MP4, MOV, and WEBM are supported' };
  }

  if (file.size > VIDEO_MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'Video must be 100 MB or smaller' };
  }

  let durationSeconds;
  try {
    durationSeconds = await loadVideoDuration(file);
  } catch {
    return { valid: false, error: 'Unable to read video. Please choose a different file' };
  }

  if (durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
    return {
      valid: false,
      error: `Video is too long (${durationSeconds.toFixed(1)}s). Maximum is ${VIDEO_MAX_DURATION_SECONDS}s`,
    };
  }

  return { valid: true, durationSeconds };
};
