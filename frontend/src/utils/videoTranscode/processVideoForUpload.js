import { VIDEO_OUTPUT_MAX_BYTES } from '../videoConstants';
import {
  isClientVideoTranscodeSupported,
  isIsoBmffVideoFile,
  shouldRunClientVideoTranscode,
} from './capabilities';
import { transcodeIsoBmffTo1080pMp4 } from './transcodeIsoBmff';
import { TRANSCODE_ERROR, VideoTranscodeError } from './transcodeErrors';

/**
 * @param {File} file
 * @param {{ width: number, height: number }} displayDimensions
 * @param {{ signal?: AbortSignal, onProgress?: (n: number) => void }} [options]
 * @returns {Promise<{ file: File, transcoded: boolean, fallbackOriginal?: boolean }>}
 */
export async function processVideoFileForUpload(file, displayDimensions, options = {}) {
  const eligible =
    isIsoBmffVideoFile(file) &&
    isClientVideoTranscodeSupported() &&
    shouldRunClientVideoTranscode(file, displayDimensions);

  if (!eligible) {
    return { file, transcoded: false };
  }

  try {
    const out = await transcodeIsoBmffTo1080pMp4(file, options);
    return { file: out, transcoded: true };
  } catch (e) {
    if (e instanceof VideoTranscodeError && e.code === TRANSCODE_ERROR.FALLBACK_ORIGINAL) {
      if (file.size > VIDEO_OUTPUT_MAX_BYTES) {
        throw new VideoTranscodeError(
          TRANSCODE_ERROR.CANNOT_FALLBACK_LARGE,
          'original too large',
        );
      }
      return { file, transcoded: false, fallbackOriginal: true };
    }
    throw e;
  }
}
