/** Лимиты и пороги для видео (посты + маркет + валидация транскода). */

export const VIDEO_OUTPUT_MAX_BYTES = 100 * 1024 * 1024;
/** Сырой файл до клиентского транскода (MP4/MOV с WebCodecs). WebM — только OUTPUT_MAX. */
export const VIDEO_INPUT_MAX_BYTES = 400 * 1024 * 1024;
export const VIDEO_MAX_DURATION_SECONDS = 60;

export const MAX_VIDEO_ENCODE_SIDE = 1080;
/** Ниже этого размера и при разрешении ≤1080 клиентский транскод можно не запускать. */
export const VIDEO_TRANSCODE_SIZE_THRESHOLD_BYTES = 12 * 1024 * 1024;

export const TARGET_VIDEO_BITRATE = 4_000_000;
export const TARGET_AUDIO_BITRATE = 128_000;

export const TRANSCODE_TIMEOUT_MS = 5 * 60 * 1000;
