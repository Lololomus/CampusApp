import { TARGET_VIDEO_BITRATE, VIDEO_INPUT_MAX_BYTES, VIDEO_OUTPUT_MAX_BYTES } from '../videoConstants';

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

export async function isClientVideoTranscodeSupported() {
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') return false;
  if (typeof VideoFrame === 'undefined') return false;
  if (!hasOffscreenCanvas()) return false;
  if (typeof EncodedVideoChunk === 'undefined' || typeof EncodedAudioChunk === 'undefined') return false;
  try {
    const ok = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01E',
      width: 640,
      height: 360,
      bitrate: 1_000_000,
      framerate: 30,
    });
    return Boolean(ok?.supported);
  } catch {
    return false;
  }
}

export function hasAudioWebCodecs() {
  return typeof AudioEncoder !== 'undefined' && typeof AudioDecoder !== 'undefined';
}

/**
 * Клиентский транскод только если файл уже не проходит лимит «на выход» (100 МБ), но ещё в допустимом сыром лимите (400 МБ).
 * Иначе грузим как есть (до 100 МБ) — сервер при необходимости дожимает.
 */
export async function shouldRunClientVideoTranscode(file) {
  if (!file || !isIsoBmffVideoFile(file)) return false;
  if (!(await isClientVideoTranscodeSupported())) return false;
  if (file.size <= VIDEO_OUTPUT_MAX_BYTES) return false;
  if (file.size > VIDEO_INPUT_MAX_BYTES) return false;
  return true;
}

export async function pickAvcCodec(width, height, bitrate) {
  const candidates = ['avc1.640028', 'avc1.4d4028', 'avc1.42E01E'];
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate: bitrate || TARGET_VIDEO_BITRATE,
          framerate: 30,
        });
      if (support?.supported) {
        return codec;
      }
    } catch {
      /* continue */
    }
  }
  return null;
}
