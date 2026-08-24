// Choosing and uploading the patient's own picture.
//
// Separate from `moments/media-upload` on purpose: that module prepares a
// moment's media — several kinds, thumbnails, durations — and an avatar is one
// square image with none of that. Sharing it would mean carrying the moment
// vocabulary into a place that has no moments in it.
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { presignAvatar } from '@/src/api/me';

/** Wider than any avatar is drawn, so it survives a bigger frame later without
 *  being a full-resolution photograph in the bucket. */
const SIZE = 512;

async function byteSize(uri: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  return blob.size;
}

/**
 * Pick a picture, shrink it, upload it, and hand back the storage key.
 *
 * Null on cancel or on any failure — the caller keeps the picture they had, and
 * says so rather than showing a half-changed profile.
 *
 * The image is squared and re-encoded before it leaves the device: an avatar is
 * always drawn in a circle, so cropping here is what the patient will actually
 * see, and it means a 12MP phone photo is not sent over their data to be
 * displayed at 52px.
 */
export async function pickAndUploadAvatar(fromCamera: boolean): Promise<string | null> {
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (res.canceled || !res.assets?.[0]) return null;

  const shrunk = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width: SIZE, height: SIZE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  const size = await byteSize(shrunk.uri);

  const signed = await presignAvatar('image/jpeg', size);
  if (!signed) return null;

  const blob = await (await fetch(shrunk.uri)).blob();
  const put = await fetch(signed.url, { method: 'PUT', headers: { ...signed.headers, 'content-type': 'image/jpeg' }, body: blob });
  if (!put.ok) return null;

  return signed.key;
}
