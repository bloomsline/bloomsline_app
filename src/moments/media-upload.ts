// Media capture for Moments. Photo + video come from the library picker (works
// on web AND native); voice is recorded on-device (native). Everything is
// compressed/thumbnailed on-device where possible, then uploaded straight to
// object storage via presigned PUTs — the app server never touches the bytes.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { byteSize, putFile } from '@/src/upload/put-file';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { presignMedia, type MomentMediaInput } from '@/src/api/moments';

const MAX_MAIN_WIDTH = 1600;
/** The server's ceiling for one file (lib/moments/media.ts MEDIA_MAX_BYTES). */
export const MEDIA_MAX_BYTES = 100 * 1024 * 1024;

/** A file refused before it is sent, with the reason a person can act on. */
export class MediaError extends Error {
  constructor(public readonly reason: 'too_large' | 'camera_denied') { super(reason); }
}
const THUMB_WIDTH = 400;
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export type PreparedMedia =
  | { kind: 'image'; uri: string; thumbUri: string; width: number; height: number; size: number; thumbSize: number }
  | { kind: 'video'; uri: string; mime: string; thumbUri: string | null; width: number; height: number; size: number; thumbSize: number; durationSeconds: number }
  | { kind: 'audio'; uri: string; mime: string; size: number; durationSeconds: number };

async function jpegThumb(uri: string): Promise<{ uri: string; size: number }> {
  const t = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: THUMB_WIDTH } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: t.uri, size: await byteSize(t.uri) };
}

/** Prepare a picked/captured asset: compress an image, poster a video. */
async function prepare(a: ImagePicker.ImagePickerAsset): Promise<PreparedMedia> {

  if (a.type === 'video') {
    const mime = a.mimeType && VIDEO_MIMES.has(a.mimeType) ? a.mimeType : 'video/mp4';
    const size = a.fileSize ?? (await byteSize(a.uri));
    // Said HERE, when it is picked, rather than after the patient has written
    // the note and chosen their feelings and pressed Create — which is where a
    // too-large video used to fail, as "Could not save", every time.
    if (size > MEDIA_MAX_BYTES) throw new MediaError('too_large');
    let thumbUri: string | null = null;
    let thumbSize = 0;
    try {
      const poster = await VideoThumbnails.getThumbnailAsync(a.uri, { time: 0 });
      const t = await jpegThumb(poster.uri);
      thumbUri = t.uri;
      thumbSize = t.size;
    } catch {
      // web / codec without thumbnail support — fine, the moment renders without a poster
    }
    return { kind: 'video', uri: a.uri, mime, thumbUri, width: a.width ?? 0, height: a.height ?? 0, size, thumbSize, durationSeconds: a.duration ? Math.round(a.duration / 1000) : 0 };
  }

  // image
  const targetWidth = Math.min(a.width ?? MAX_MAIN_WIDTH, MAX_MAIN_WIDTH);
  const main = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width: targetWidth } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  const thumb = await jpegThumb(a.uri);
  return { kind: 'image', uri: main.uri, thumbUri: thumb.uri, width: main.width, height: main.height, size: await byteSize(main.uri), thumbSize: thumb.size };
}

/** Choose a photo or video from the library. null if cancelled. */
export async function pickMedia(): Promise<PreparedMedia | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'], quality: 1, allowsMultipleSelection: false,
    // iOS re-encodes a chosen video to 720p, which keeps most clips well under
    // the size limit. Android has no such option; the size check covers it.
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return prepare(res.assets[0]);
}

/**
 * Take a photo, or record a video, with the camera.
 *
 * null when the person cancels. A refused permission THROWS MediaError: the OS
 * asks only once, so every later tap was refused in silence and "Take a photo"
 * simply did nothing, with no hint that the camera was switched off in Settings.
 */
export async function captureMedia(mode: 'photo' | 'video'): Promise<PreparedMedia | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new MediaError('camera_denied');
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: mode === 'video' ? ['videos'] : ['images'],
    quality: 1,
    // Recorded at 720p on iOS, for the same size reason as the library.
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return prepare(res.assets[0]);
}

/**
 * Can this device hold a camera up to something?
 *
 * This used to be `Platform.OS !== 'web'`, which was simply wrong: patients use
 * the web app on their phones, and `launchCameraAsync` IS implemented on web —
 * it sets `capture` on the file input, which opens the camera on iOS Safari and
 * Android Chrome. So "Take a photo" was hidden from exactly the people who
 * could use it, and the sheet offered only the photo library.
 *
 * A coarse pointer is the proxy for a hand-held device. On a desktop browser
 * `capture` is ignored and the row would just re-open the file browser, which
 * is a second door to the row below it — so desktop keeps the library only.
 */
export const cameraAvailable =
  Platform.OS !== 'web' ||
  (typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(pointer: coarse)').matches);

async function putOne(uri: string, contentType: string, sizeBytes: number, thumbnail: boolean): Promise<string> {
  const { key, url, headers } = await presignMedia({ contentType, sizeBytes, thumbnail });
  // See `upload/put-file`: a Blob body sends the blob's OWN content type on
  // native, which does not match what the URL was signed with, and storage
  // refuses it. Every photo, video and voice note on a moment went through
  // that path.
  if (!(await putFile(url, uri, contentType, headers))) throw new Error('Upload failed');
  return key;
}

/** Upload a prepared media item (+ its thumbnail) → the moment-media descriptor. */
export async function uploadMedia(p: PreparedMedia): Promise<MomentMediaInput> {
  if (p.kind === 'image') {
    const storageKey = await putOne(p.uri, 'image/jpeg', p.size, false);
    const thumbnailKey = await putOne(p.thumbUri, 'image/jpeg', p.thumbSize, true);
    return { kind: 'image', storageKey, thumbnailKey, mimeType: 'image/jpeg', width: p.width, height: p.height, fileSizeBytes: p.size };
  }
  if (p.kind === 'video') {
    const storageKey = await putOne(p.uri, p.mime, p.size, false);
    const thumbnailKey = p.thumbUri ? await putOne(p.thumbUri, 'image/jpeg', p.thumbSize, true) : null;
    return { kind: 'video', storageKey, thumbnailKey, mimeType: p.mime, width: p.width, height: p.height, durationSeconds: p.durationSeconds, fileSizeBytes: p.size };
  }
  const storageKey = await putOne(p.uri, p.mime, p.size, false);
  return { kind: 'audio', storageKey, mimeType: p.mime, durationSeconds: p.durationSeconds, fileSizeBytes: p.size };
}
