export const TRANSCODE_ERROR = {
  UNSUPPORTED_BROWSER: 'UNSUPPORTED_BROWSER',
  CANNOT_FALLBACK_LARGE: 'CANNOT_FALLBACK_LARGE',
  FILE_READ: 'FILE_READ',
  CONTAINER: 'CONTAINER',
  VIDEO_CODEC: 'VIDEO_CODEC',
  AUDIO_CODEC: 'AUDIO_CODEC',
  OOM: 'OOM',
  OUTPUT_TOO_LARGE: 'OUTPUT_TOO_LARGE',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',
  FAILED: 'FAILED',
  FALLBACK_ORIGINAL: 'FALLBACK_ORIGINAL',
};

export class VideoTranscodeError extends Error {
  constructor(code, message, cause) {
    super(message || code);
    this.name = 'VideoTranscodeError';
    this.code = code;
    this.cause = cause;
  }
}

/** Тексты для toast (русский). */
export function getVideoTranscodeToastMessage(code) {
  switch (code) {
    case TRANSCODE_ERROR.UNSUPPORTED_BROWSER:
      return 'Сжатие видео в этом браузере недоступно. Попробуйте другой браузер или уменьшите файл до 100 МБ.';
    case TRANSCODE_ERROR.CANNOT_FALLBACK_LARGE:
      return 'Файл больше 100 МБ и не удалось сжать на устройстве. Попробуйте другое видео или другой браузер';
    case TRANSCODE_ERROR.FILE_READ:
      return 'Не удалось прочитать видео. Выберите другой файл';
    case TRANSCODE_ERROR.CONTAINER:
      return 'Этот формат не удалось обработать на устройстве';
    case TRANSCODE_ERROR.VIDEO_CODEC:
    case TRANSCODE_ERROR.AUDIO_CODEC:
      return 'Это видео не удалось перекодировать на устройстве';
    case TRANSCODE_ERROR.OOM:
      return 'Не хватило памяти для обработки видео. Попробуйте короткий ролик или другое видео';
    case TRANSCODE_ERROR.OUTPUT_TOO_LARGE:
      return 'После сжатия файл всё ещё слишком большой. Укоротите видео или выберите другое';
    case TRANSCODE_ERROR.TIMEOUT:
      return 'Обработка заняла слишком много времени. Попробуйте ещё раз или другое видео';
    case TRANSCODE_ERROR.ABORTED:
      return '';
    case TRANSCODE_ERROR.FALLBACK_ORIGINAL:
      return '';
    case TRANSCODE_ERROR.FAILED:
    default:
      return 'Не удалось обработать видео';
  }
}
