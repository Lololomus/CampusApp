import { createFile, DataStream } from 'mp4box';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  MAX_VIDEO_ENCODE_SIDE,
  TARGET_AUDIO_BITRATE,
  TARGET_VIDEO_BITRATE,
  TRANSCODE_TIMEOUT_MS,
  VIDEO_OUTPUT_MAX_BYTES,
} from '../videoConstants';
import { hasAudioWebCodecs, pickAvcCodec } from './capabilities';
import { TRANSCODE_ERROR, VideoTranscodeError } from './transcodeErrors';

const DECODER_CONFIG_TAG = 4;
const DECODER_SPECIFIC_TAG = 5;

function matrixToRotation(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 6) return 0;
  const [a, b, , c, d] = matrix;
  const e = 0x10000 * 0.02;
  if (
    Math.abs(a - 0x10000) < e &&
    Math.abs(d - 0x10000) < e &&
    Math.abs(b) < e &&
    Math.abs(c) < e
  ) {
    return 0;
  }
  if (Math.abs(c - 0x10000) < e && Math.abs(b + 0x10000) < e) return 90;
  if (Math.abs(c + 0x10000) < e && Math.abs(b - 0x10000) < e) return 270;
  if (Math.abs(a + 0x10000) < e && Math.abs(d + 0x10000) < e) return 180;
  return 0;
}

function naturalSizeAfterRotation(codedWidth, codedHeight, rotation) {
  if (rotation === 90 || rotation === 270) return { w: codedHeight, h: codedWidth };
  return { w: codedWidth, h: codedHeight };
}

function computeEncodeDimensions(nw, nh, maxSide = MAX_VIDEO_ENCODE_SIDE) {
  let w = nw;
  let h = nh;
  if (Math.max(w, h) > maxSide) {
    if (nw >= nh) {
      w = maxSide;
      h = Math.round((nh * maxSide) / nw);
    } else {
      h = maxSide;
      w = Math.round((nw * maxSide) / nh);
    }
  }
  w = Math.max(2, w - (w % 2));
  h = Math.max(2, h - (h % 2));
  return { width: w, height: h };
}

function writeBoxDescription(box) {
  if (!box || typeof box.write !== 'function') return undefined;
  const ds = new DataStream();
  box.write(ds);
  const full = new Uint8Array(ds.buffer);
  if (full.byteLength <= 8) return undefined;
  return full.slice(8);
}

function getAacAudioDescription(entry) {
  const esd = entry?.esds?.esd;
  if (!esd || typeof esd.findDescriptor !== 'function') return undefined;
  const dcd = esd.findDescriptor(DECODER_CONFIG_TAG);
  if (!dcd || typeof dcd.findDescriptor !== 'function') return undefined;
  const dsi = dcd.findDescriptor(DECODER_SPECIFIC_TAG);
  if (!dsi?.data) return undefined;
  const raw = dsi.data;
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

function microsFromTs(ts, timescale) {
  return Math.round((ts * 1_000_000) / timescale);
}

/**
 * @param {File} file
 * @param {{ signal?: AbortSignal, onProgress?: (n: number) => void }} options
 * @returns {Promise<File>}
 */
export async function transcodeIsoBmffTo1080pMp4(file, options = {}) {
  const { signal, onProgress } = options;
  const report = typeof onProgress === 'function' ? onProgress : () => {};

  if (signal?.aborted) {
    throw new VideoTranscodeError(TRANSCODE_ERROR.ABORTED, 'aborted');
  }

  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (e) {
    throw new VideoTranscodeError(TRANSCODE_ERROR.FILE_READ, 'file read', e);
  }

  const abortOnSignal = () => {
    if (signal?.aborted) {
      throw new VideoTranscodeError(TRANSCODE_ERROR.ABORTED, 'aborted');
    }
  };

  const runInner = () =>
    new Promise((resolve, reject) => {
      const mp4boxfile = createFile();
      const buf = new Uint8Array(arrayBuffer);
      buf.fileStart = 0;

      mp4boxfile.onError = (e) => {
        reject(new VideoTranscodeError(TRANSCODE_ERROR.CONTAINER, 'mp4box error', e));
      };

      mp4boxfile.onReady = (info) => {
        void (async () => {
          try {
            abortOnSignal();
            const vMeta = info.videoTracks?.[0];
            if (!vMeta) {
              reject(new VideoTranscodeError(TRANSCODE_ERROR.CONTAINER, 'no video track'));
              return;
            }
            const aMeta = info.audioTracks?.[0];
            const videoTrackId = vMeta.id;
            const audioTrackId = aMeta?.id ?? null;

            const videoTrak = mp4boxfile.getTrackById(videoTrackId);
            const audioTrak = audioTrackId != null ? mp4boxfile.getTrackById(audioTrackId) : null;

            const videoEntry = videoTrak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
            if (!videoEntry) {
              reject(new VideoTranscodeError(TRANSCODE_ERROR.CONTAINER, 'no video stsd'));
              return;
            }

            let videoDescription = writeBoxDescription(videoEntry.avcC);
            if (!videoDescription) videoDescription = writeBoxDescription(videoEntry.hvcC);
            if (!videoDescription) videoDescription = writeBoxDescription(videoEntry.vpcC);
            if (!videoDescription) videoDescription = writeBoxDescription(videoEntry.av01);

            const rotation = matrixToRotation(vMeta.matrix);
            const codedW = vMeta.video?.width || 640;
            const codedH = vMeta.video?.height || 360;
            const { w: natW, h: natH } = naturalSizeAfterRotation(codedW, codedH, rotation);
            const { width: encW, height: encH } = computeEncodeDimensions(natW, natH);

            const timescale = vMeta.timescale || 1;
            const approxFps = Math.min(
              60,
              Math.max(
                1,
                Math.round(vMeta.nb_samples / (vMeta.samples_duration / timescale || 1)),
              ),
            );

            const avcCodec = await pickAvcCodec(encW, encH, TARGET_VIDEO_BITRATE);
            if (!avcCodec) {
              reject(new VideoTranscodeError(TRANSCODE_ERROR.VIDEO_CODEC, 'no avc encoder'));
              return;
            }

            const decoderCodec = vMeta.codec;
            if (!decoderCodec) {
              reject(new VideoTranscodeError(TRANSCODE_ERROR.VIDEO_CODEC, 'no decoder codec'));
              return;
            }

            const decConfig = {
              codec: decoderCodec,
              codedWidth: codedW,
              codedHeight: codedH,
              description: videoDescription,
            };
            const vSup = await VideoDecoder.isConfigSupported(decConfig);
            if (!vSup.supported) {
              reject(new VideoTranscodeError(TRANSCODE_ERROR.VIDEO_CODEC, 'decoder unsupported'));
              return;
            }

            let useAudio =
              Boolean(aMeta && audioTrak && hasAudioWebCodecs() && aMeta.codec?.startsWith('mp4a'));
            let audioEntry = null;
            let audioDesc = undefined;
            if (useAudio) {
              audioEntry = audioTrak.mdia.minf.stbl.stsd.entries[0];
              audioDesc = getAacAudioDescription(audioEntry);
              const aConfTry = {
                codec: aMeta.codec,
                numberOfChannels: aMeta.audio?.channel_count || 2,
                sampleRate: aMeta.audio?.sample_rate || 48000,
                description: audioDesc,
              };
              const aSup = await AudioDecoder.isConfigSupported(aConfTry);
              if (!aSup.supported) {
                useAudio = false;
              }
            }

            abortOnSignal();

            const target = new ArrayBufferTarget();
            const muxerOpts = {
              target,
              video: {
                codec: 'avc',
                width: encW,
                height: encH,
                frameRate: approxFps,
              },
              fastStart: 'in-memory',
              firstTimestampBehavior: useAudio ? 'cross-track-offset' : 'offset',
            };
            if (useAudio) {
              muxerOpts.audio = {
                codec: 'aac',
                numberOfChannels: aMeta.audio?.channel_count || 2,
                sampleRate: aMeta.audio?.sample_rate || 48000,
              };
            }
            const muxer = new Muxer(muxerOpts);

            const canvas = new OffscreenCanvas(encW, encH);
            const ctx = canvas.getContext('2d', { alpha: false });

            function drawScaledFrame(frame) {
              const cw = frame.codedWidth;
              const ch = frame.codedHeight;
              const nw = rotation === 90 || rotation === 270 ? ch : cw;
              const nh = rotation === 90 || rotation === 270 ? cw : ch;
              const scale = Math.min(encW / nw, encH / nh);
              const dw = cw * scale;
              const dh = ch * scale;
              ctx.fillStyle = '#000';
              ctx.fillRect(0, 0, encW, encH);
              ctx.save();
              ctx.translate(encW / 2, encH / 2);
              ctx.rotate((rotation * Math.PI) / 180);
              ctx.drawImage(frame, -dw / 2, -dh / 2, dw, dh);
              ctx.restore();
            }

            const videoFramesTotal = Math.max(1, vMeta.nb_samples);
            let videoFramesSeen = 0;
            let videoFeedDone = false;
            let videoDecodePending = 0;
            let audioFeedDone = !useAudio;
            let audioDecodePending = 0;
            let audioConfigured = false;
            let audioMuxBroken = false;
            let videoEncodeClosed = false;
            let audioEncodeClosed = !useAudio;

            const videoEncoder = new VideoEncoder({
              output: (chunk, meta) => {
                muxer.addVideoChunk(chunk, meta);
                chunk.close();
              },
              error: (e) => {
                reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'video encoder', e));
              },
            });
            videoEncoder.configure({
              codec: avcCodec,
              width: encW,
              height: encH,
              bitrate: TARGET_VIDEO_BITRATE,
              framerate: approxFps,
              hardwareAcceleration: 'prefer-hardware',
              latencyMode: 'quality',
            });

            const videoDecoder = new VideoDecoder({
              output: (frame) => {
                videoDecodePending -= 1;
                try {
                  drawScaledFrame(frame);
                  const vf = new VideoFrame(canvas, {
                    timestamp: frame.timestamp,
                    duration: frame.duration ?? undefined,
                  });
                  const keyInt = Math.max(1, approxFps * 2);
                  videoEncoder.encode(vf, { keyFrame: videoFramesSeen % keyInt === 0 });
                  vf.close();
                  videoFramesSeen += 1;
                  report(Math.min(99, Math.round((videoFramesSeen / videoFramesTotal) * 100)));
                } catch (e) {
                  reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'encode frame', e));
                  return;
                } finally {
                  frame.close();
                }
                if (videoFeedDone && videoDecodePending === 0) void closeVideoEncoders();
              },
              error: (e) => {
                reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'video decoder', e));
              },
            });
            videoDecoder.configure(decConfig);

            /** @type {AudioDecoder | undefined} */
            let audioDecoder;
            /** @type {AudioEncoder | undefined} */
            let audioEncoder;

            if (useAudio) {
              const aConf = {
                codec: aMeta.codec,
                numberOfChannels: aMeta.audio?.channel_count || 2,
                sampleRate: aMeta.audio?.sample_rate || 48000,
                description: audioDesc,
              };
              audioEncoder = new AudioEncoder({
                output: (chunk, meta) => {
                  try {
                    muxer.addAudioChunk(chunk, meta);
                  } catch (err) {
                    audioMuxBroken = true;
                    reject(new VideoTranscodeError(TRANSCODE_ERROR.FALLBACK_ORIGINAL, 'audio mux', err));
                  }
                  chunk.close();
                },
                error: (err) => {
                  audioMuxBroken = true;
                  reject(new VideoTranscodeError(TRANSCODE_ERROR.FALLBACK_ORIGINAL, 'audio encoder', err));
                },
              });

              audioDecoder = new AudioDecoder({
                output: (data) => {
                  audioDecodePending -= 1;
                  try {
                    if (!audioConfigured) {
                      audioEncoder.configure({
                        codec: 'mp4a.40.2',
                        bitrate: TARGET_AUDIO_BITRATE,
                        sampleRate: data.sampleRate,
                        numberOfChannels: data.numberOfChannels,
                      });
                      audioConfigured = true;
                    }
                    audioEncoder.encode(data);
                  } catch (err) {
                    audioMuxBroken = true;
                    reject(new VideoTranscodeError(TRANSCODE_ERROR.FALLBACK_ORIGINAL, 'audio encode', err));
                    return;
                  } finally {
                    data.close();
                  }
                  if (audioFeedDone && audioDecodePending === 0 && !audioMuxBroken) void closeAudioEncoders();
                },
                error: (err) => {
                  audioMuxBroken = true;
                  reject(new VideoTranscodeError(TRANSCODE_ERROR.FALLBACK_ORIGINAL, 'audio decoder', err));
                },
              });
              try {
                audioDecoder.configure(aConf);
              } catch {
                reject(new VideoTranscodeError(TRANSCODE_ERROR.FALLBACK_ORIGINAL, 'audio configure'));
                return;
              }
            }

            async function closeVideoEncoders() {
              if (videoEncodeClosed) return;
              try {
                await videoDecoder.flush();
                await videoEncoder.flush();
                videoDecoder.close();
                videoEncoder.close();
                videoEncodeClosed = true;
                await attemptMuxerFinalize();
              } catch (e) {
                reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'video flush', e));
              }
            }

            async function closeAudioEncoders() {
              if (!useAudio || audioEncodeClosed || !audioDecoder || !audioEncoder) return;
              try {
                await audioDecoder.flush();
                await audioEncoder.flush();
                audioDecoder.close();
                audioEncoder.close();
                audioEncodeClosed = true;
                await attemptMuxerFinalize();
              } catch {
                reject(new VideoTranscodeError(TRANSCODE_ERROR.FALLBACK_ORIGINAL, 'audio flush'));
              }
            }

            async function attemptMuxerFinalize() {
              if (!videoEncodeClosed || !audioEncodeClosed) return;
              if (audioMuxBroken) {
                reject(new VideoTranscodeError(TRANSCODE_ERROR.FALLBACK_ORIGINAL, 'audio'));
                return;
              }
              try {
                muxer.finalize();
                const out = target.buffer;
                if (!out || out.byteLength === 0) {
                  reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'empty output'));
                  return;
                }
                if (out.byteLength > VIDEO_OUTPUT_MAX_BYTES) {
                  reject(new VideoTranscodeError(TRANSCODE_ERROR.OUTPUT_TOO_LARGE, 'output too large'));
                  return;
                }
                report(100);
                const baseName = (file.name || 'video').replace(/\.[^.]+$/, '');
                resolve(new File([out], `${baseName}.mp4`, { type: 'video/mp4' }));
              } catch (e) {
                if (e instanceof VideoTranscodeError) reject(e);
                else reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'finalize', e));
              }
            }

            mp4boxfile.onSamples = (tid, _user, samples) => {
              try {
                if (tid === videoTrackId) {
                  for (const s of samples) {
                    const ts = microsFromTs(s.cts, s.timescale);
                    const dur =
                      s.duration != null ? microsFromTs(s.duration, s.timescale) : undefined;
                    const chunk = new EncodedVideoChunk({
                      type: s.is_sync ? 'key' : 'delta',
                      timestamp: ts,
                      duration: dur,
                      data: s.data,
                    });
                    videoDecodePending += 1;
                    videoDecoder.decode(chunk);
                  }
                  const lastNum = samples[samples.length - 1].number + 1;
                  mp4boxfile.releaseUsedSamples(tid, lastNum);
                  if (samples[samples.length - 1].number >= videoTrak.samples.length - 1) {
                    videoFeedDone = true;
                    if (videoDecodePending === 0) void closeVideoEncoders();
                  }
                } else if (useAudio && tid === audioTrackId && audioDecoder) {
                  for (const s of samples) {
                    const ts = microsFromTs(s.cts, s.timescale);
                    const dur =
                      s.duration != null ? microsFromTs(s.duration, s.timescale) : undefined;
                    const chunk = new EncodedAudioChunk({
                      type: 'key',
                      timestamp: ts,
                      duration: dur,
                      data: s.data,
                    });
                    audioDecodePending += 1;
                    audioDecoder.decode(chunk);
                  }
                  const lastNum = samples[samples.length - 1].number + 1;
                  mp4boxfile.releaseUsedSamples(tid, lastNum);
                  if (samples[samples.length - 1].number >= audioTrak.samples.length - 1) {
                    audioFeedDone = true;
                    if (audioDecodePending === 0) void closeAudioEncoders();
                  }
                }
              } catch (e) {
                reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'onSamples', e));
              }
            };

            mp4boxfile.setExtractionOptions(videoTrackId, {}, { nbSamples: 24 });
            if (useAudio && audioTrackId != null) {
              mp4boxfile.setExtractionOptions(audioTrackId, {}, { nbSamples: 48 });
            }
            mp4boxfile.start();
            mp4boxfile.flush();
          } catch (e) {
            if (e instanceof VideoTranscodeError) reject(e);
            else reject(new VideoTranscodeError(TRANSCODE_ERROR.FAILED, 'init', e));
          }
        })();
      };

      mp4boxfile.appendBuffer(buf);
    });

  try {
    const result = await Promise.race([
      runInner(),
      new Promise((_, reject) => {
        setTimeout(
          () => reject(new VideoTranscodeError(TRANSCODE_ERROR.TIMEOUT, 'timeout')),
          TRANSCODE_TIMEOUT_MS,
        );
      }),
    ]);
    abortOnSignal();
    return result;
  } catch (e) {
    abortOnSignal();
    if (e instanceof VideoTranscodeError) throw e;
    const msg = String(e?.message || e || '');
    if (msg.includes('memory') || msg.includes('Memory') || msg.includes('QuotaExceeded')) {
      throw new VideoTranscodeError(TRANSCODE_ERROR.OOM, 'oom', e);
    }
    throw new VideoTranscodeError(TRANSCODE_ERROR.FAILED, msg, e);
  }
}
