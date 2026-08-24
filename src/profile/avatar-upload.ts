// Choosing and uploading the patient's own picture.
//
// Separate from `moments/media-upload` on purpose: that module prepares a
// moment's media — several kinds, thumbnails, durations — and an avatar is one
// square image with none of that.
//
// Picking and uploading are two calls, not one, because the crop happens
// between them. Doing it in a single step meant the photograph was resized to
// 512×512 the instant it was chosen, which forces both dimensions and squashed
// every portrait sideways.
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { presignAvatar } from '@/src/api/me';
import type { CropRect } from './AvatarCropper';

/** Wider than any avatar is drawn, so it survives a bigger frame later without
 *  being a full-resolution photograph in the bucket. */
const SIZE = 512;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

async function byteSize(uri: string): Promise<number> {
  const blob = await (await fetch(uri)).blob();
  return blob.size;
}

/** Choose a photo. Null on cancel. Nothing is uploaded yet — the patient still
 *  has to say which part of it is the face. */
export async function pickImage(fromCamera: boolean): Promise<PickedImage | null> {
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  const a = res.canceled ? null : res.assets?.[0];
  if (!a?.uri || !a.width || !a.height) return null;
  return { uri: a.uri, width: a.width, height: a.height };
}

/**
 * Crop to the chosen square, shrink, upload — and hand back the local uri to
 * show immediately, alongside the storage key to save.
 *
 * The local uri matters: a key is not something an `<Image>` can load, and the
 * signed url does not exist until the server is asked for the profile again. In
 * between there has to be something to look at, or choosing a photo appears to
 * do nothing at all.
 *
 * `resize` takes WIDTH only. After a square crop that keeps it square, and it
 * cannot distort whatever it is handed — which is the mistake being fixed.
 */
export async function uploadAvatar(source: PickedImage, crop: CropRect): Promise<{ key: string; localUri: string } | null> {
  const out = await ImageManipulator.manipulateAsync(
    source.uri,
    [{ crop }, { resize: { width: SIZE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  const size = await byteSize(out.uri);

  const signed = await presignAvatar('image/jpeg', size);
  if (!signed) return null;

  const blob = await (await fetch(out.uri)).blob();
  const put = await fetch(signed.url, { method: 'PUT', headers: { ...signed.headers, 'content-type': 'image/jpeg' }, body: blob });
  if (!put.ok) return null;

  return { key: signed.key, localUri: out.uri };
}
