// Sending bytes to a presigned URL, and measuring them first.
//
// WHY THIS EXISTS, because the obvious code looks fine and is broken on device:
//
//   const blob = await (await fetch(uri)).blob();
//   await fetch(signedUrl, { method: 'PUT', headers: { 'content-type': type }, body: blob });
//
// The server presigns with `ContentType` baked INTO the signature, so the PUT
// has to arrive carrying exactly that header. On React Native, a Blob body wins
// over the header you set — the request goes out with the blob's own type — and
// a blob read from a `file://` uri on iOS commonly has an empty type. Storage
// then answers `SignatureDoesNotMatch`, `put.ok` is false, and the app says the
// upload failed with nothing else to go on.
//
// On the web the blob carries the right type, the signature matches, and it
// works. That is the whole of "it works in the browser and not on my phone":
// the avatar picker and every photo, video and voice note on a moment.
//
// So native uses `expo-file-system`'s uploadAsync with BINARY_CONTENT, which
// sends the file's bytes and exactly the headers it is given. The web keeps the
// blob path, where it is correct and where FileSystem has nothing to read.
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/** Bytes on disk. The server refuses an empty or oversized upload before it
 *  signs anything, so this has to be right before we ask. */
export async function byteSize(uri: string): Promise<number> {
  if (Platform.OS !== 'web') {
    // `size` comes back on an existing file; the option object this once took
    // (`{ size: true }`) is not part of the type and was never needed.
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : 0;
  }
  return (await (await fetch(uri)).blob()).size;
}

/**
 * PUT a local file to a presigned URL. True when storage accepted it.
 *
 * `headers` are the ones the server signed with; `contentType` is repeated
 * because the signature covers it and a mismatch is rejected rather than
 * corrected.
 */
export async function putFile(
  url: string,
  uri: string,
  contentType: string,
  headers: Record<string, string>,
): Promise<boolean> {
  if (Platform.OS !== 'web') {
    const res = await FileSystem.uploadAsync(url, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { ...headers, 'content-type': contentType },
    });
    if (res.status >= 200 && res.status < 300) return true;
    // Storage puts its reason in the body — SignatureDoesNotMatch, EntityTooLarge,
    // AccessDenied. Swallowing it is what left the last two reports as "it does
    // not work", so it travels with the failure.
    throw new Error(`storage ${res.status}: ${String(res.body ?? '').slice(0, 160)}`);
  }
  const blob = await (await fetch(uri)).blob();
  const put = await fetch(url, { method: 'PUT', headers: { ...headers, 'content-type': contentType }, body: blob });
  return put.ok;
}
