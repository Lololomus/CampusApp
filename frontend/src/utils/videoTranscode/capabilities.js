import {
  MAX_VIDEO_ENCODE_SIDE,
  TARGET_VIDEO_BITRATE,
  VIDEO_OUTPUT_MAX_BYTES,
  VIDEO_TRANSCODE_SIZE_THRESHOLD_BYTES,
} from '../videoConstants';

const SUPPORTED_ISO_EXTENSIONS = new Set(['mp4', 'mov']);

export function getFileExtension(fileName = '') {
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

/** WebM: клиентский транскод v1 не делаем — только сервер. */
export function isIsoBmffVideoFile(file) {
  if (!file) return false;
  const ext = getFileExtension(file.name);
  const mime = String(file.type || '').toLowerCase();
  if (mime === 'video/webm') return false;
  return SUPPORTED_ISO_EXTENSIONS.has(ext) || mime === 'video/mp4' || mime === 'video/quicktime';
}

function hasOffscreenCanvas() {
  return typeof OffscreenCanvas !== 'undefined';
}

export function isClientVideoTranscodeSupported() {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return false;
  if (typeof VideoFrame === 'undefined') return false;
  if (!hasOffscreenCanvas()) return false;
  if (typeof EncodedVideoChunk === 'undefined' || typeof EncodedAudioChunk === 'undefined') return false;
  try {
    const ok = VideoEncoder.isTypeSupported({
      codec: 'avc1.42E01E',
      width: 640,
      height: 360,
      bitrate: 1_000_000,
      framerate: 30,
    });
    return Boolean(ok);
  } catch {
    return false;
  }
}

export function hasAudioWebCodecs() {
  return typeof AudioEncoder !== 'undefined' && typeof AudioDecoder !== 'undefined';
}

/**
 * Нужен ли клиентский транскод (эвристика). WebM — false.
 * @param {{ width: number, height: number }} displayDimensions — уже с учётом отображения (videoWidth/Height).
 */
export function shouldRunClientVideoTranscode(file, displayDimensions) {
  if (!file || !isIsoBmffVideoFile(file)) return false;
  if (!isClientVideoTranscodeSupported()) return false;
  if (file.size > VIDEO_OUTPUT_MAX_BYTES) return true;
  const w = Number(displayDimensions?.width) || 0;
  const h = Number(displayDimensions?.height) || 0;
  if (w > 0 && h > 0 && Math.max(w, h) > MAX_VIDEO_ENCODE_SIDE) return true;
  if (file.size > VIDEO_TRANSCODE_SIZE_THRESHOLD_BYTES) return true;
  return false;
}

export function pickAvcCodec(width, height, bitrate) {
  const candidates = ['avc1.640028', 'avc1.4d4028', 'avc1.42E01E'];
  for (const codec of candidates) {
    try {
      if (
        VideoEncoder.isTypeSupported({
          codec,
          width,
          height,
          bitrate: bitrate || TARGET_VIDEO_BITRATE,
          framerate: 30,
        })
      ) {
        return codec;
      }
    } catch {
      /* continue */
    }
  }
  return null;
}
