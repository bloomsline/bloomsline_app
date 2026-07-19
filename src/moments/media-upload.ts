// Media capture for Moments. Photo + video come from the library picker (works
// on web AND native); voice is recorded on-device (native). Everything is
// compressed/thumbnailed on-device where possible, then uploaded straight to
// object storage via presigned PUTs — the app server never touches the bytes.
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { presignMedia, type MomentMediaInput } from '@/src/api/moments';

const MAX_MAIN_WIDTH = 1600;
const THUMB_WIDTH = 400;
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export type PreparedMedia =
  | { kind: 'image'; uri: string; thumbUri: string; width: number; height: number; size: number; thumbSize: number }
  | { kind: 'video'; uri: string; mime: string; thumbUri: string | null; width: number; height: number; size: number; thumbSize: number; durationSeconds: number }
  | { kind: 'audio'; uri: string; mime: string; size: number; durationSeconds: number };

async function byteSize(uri: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  return blob.size;
}

async function jpegThumb(uri: string): Promise<{ uri: string; size: number }> {
  const t = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: THUMB_WIDTH } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
  return { uri: t.uri, size: await byteSize(t.uri) };
}

/** Pick a photo OR video from the library; prepare it (compress/poster). null if cancelled. */
export async function pickMedia(): Promise<PreparedMedia | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 1, allowsMultipleSelection: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];

  if (a.type === 'video') {
    const mime = a.mimeType && VIDEO_MIMES.has(a.mimeType) ? a.mimeType : 'video/mp4';
    const size = a.fileSize ?? (await byteSize(a.uri));
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

async function putOne(uri: string, contentType: string, sizeBytes: number, thumbnail: boolean): Promise<string> {
  const { key, url, headers } = await presignMedia({ contentType, sizeBytes, thumbnail });
  const blob = await (await fetch(uri)).blob();
  const put = await fetch(url, { method: 'PUT', headers: { ...headers, 'content-type': contentType }, body: blob });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
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
