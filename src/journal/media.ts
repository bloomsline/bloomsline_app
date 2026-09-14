// Journal media: pick an image/video (or accept a recorded voice uri) and upload
// it straight to object storage via the journal presign — same proven path as
// Moments. Voice is recorded in the editor (expo-audio) and passed here as a uri.
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { apiFetch } from '../auth/api';
import { byteSize, putFile } from '@/src/upload/put-file';

const MAIN_WIDTH = 1600;
const THUMB_WIDTH = 400;

export interface PickedImage { kind: 'image'; uri: string; mime: string; width: number; height: number }
export interface PickedVideo { kind: 'video'; uri: string; mime: string; width: number; height: number; durationSeconds: number; thumbUri: string | null }

export async function pickImage(): Promise<PickedImage | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const width = Math.min(a.width ?? MAIN_WIDTH, MAIN_WIDTH);
  const m = await ImageManipulator.manipulateAsync(a.uri, [{ resize: { width } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
  return { kind: 'image', uri: m.uri, mime: 'image/jpeg', width: m.width, height: m.height };
}

export async function pickVideo(): Promise<PickedVideo | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'], quality: 1, allowsMultipleSelection: false,
    // iOS re-encodes to 720p, which keeps most clips well under the limit.
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const mime = a.mimeType && /mp4|webm|quicktime/i.test(a.mimeType) ? a.mimeType : 'video/mp4';
  // Refused when picked, with a reason, rather than failing its upload later
  // (the server's journal ceiling is 100 MB).
  if ((a.fileSize ?? (await byteSize(a.uri))) > 100 * 1024 * 1024) throw new Error('too_large');
  let thumbUri: string | null = null;
  try {
    const poster = await VideoThumbnails.getThumbnailAsync(a.uri, { time: 0 });
    const t = await ImageManipulator.manipulateAsync(poster.uri, [{ resize: { width: THUMB_WIDTH } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
    thumbUri = t.uri;
  } catch {
    // web / codec without thumbnail support — the block renders without a poster
  }
  return { kind: 'video', uri: a.uri, mime, width: a.width ?? 0, height: a.height ?? 0, durationSeconds: a.duration ? Math.round(a.duration / 1000) : 0, thumbUri };
}

async function putOne(uri: string, contentType: string, thumbnail = false): Promise<string | null> {
  // See `upload/put-file`. Reading a file:// uri into a Blob and PUTting it
  // sends the BLOB's content type, which on native is empty and does not match
  // what the url was signed with — so storage refused every journal photo,
  // video and voice note on a phone, and the block said "Upload failed".
  const sizeBytes = await byteSize(uri);
  const res = await apiFetch('/api/mobile/journal/media', {
    method: 'POST',
    body: JSON.stringify({ fileName: 'media', contentType, sizeBytes, thumbnail }),
  });
  if (!res.ok) return null;
  const { key, url, headers } = (await res.json()) as { key?: string; url?: string; headers?: Record<string, string> };
  if (!key || !url) return null;
  return (await putFile(url, uri, contentType, headers ?? {})) ? key : null;
}

export async function uploadImage(img: PickedImage): Promise<{ storageKey: string; mime: string; width: number; height: number } | null> {
  const key = await putOne(img.uri, img.mime);
  return key ? { storageKey: key, mime: img.mime, width: img.width, height: img.height } : null;
}

export async function uploadVideo(v: PickedVideo): Promise<{ storageKey: string; thumbnailKey: string | null; mime: string; durationSeconds: number } | null> {
  const key = await putOne(v.uri, v.mime);
  if (!key) return null;
  // The poster is a nicety. A failed poster upload used to reject the whole
  // thing, so a video that had uploaded fine showed "Upload failed" and Retry
  // sent all of it again.
  const thumbnailKey = v.thumbUri ? await putOne(v.thumbUri, 'image/jpeg', true).catch(() => null) : null;
  return { storageKey: key, thumbnailKey, mime: v.mime, durationSeconds: v.durationSeconds };
}

export async function uploadVoice(uri: string, mime: string, durationSeconds: number): Promise<{ storageKey: string; mime: string; durationSeconds: number } | null> {
  const key = await putOne(uri, mime);
  return key ? { storageKey: key, mime, durationSeconds } : null;
}
