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
import { byteSize, putFile } from '@/src/upload/put-file';
import type { CropRect } from './AvatarCropper';

/** Wider than any avatar is drawn, so it survives a bigger frame later without
 *  being a full-resolution photograph in the bucket. */
const SIZE = 512;

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** Thrown when the OS refused the camera or the photo library. Distinct from a
 *  null return, which means the patient changed their mind. */
export class PermissionDenied extends Error {
  constructor(public readonly which: 'camera' | 'library') {
    super(`${which}_denied`);
  }
}

/**
 * Choose a photo. Null on cancel. Nothing is uploaded yet — the patient still
 * has to say which part of it is the face.
 *
 * THE PERMISSION IS ASKED FOR FIRST, and this is the whole bug.
 *
 * Launching the picker without it meant the OS raised its own permission dialog
 * on the first tap. The picker resolved canceled/empty underneath that dialog,
 * so this returned null — and the screen's rule was "null is cancel, say
 * nothing". First tap on a fresh install did nothing and explained nothing;
 * the second tap worked, because by then the permission existed. Reported from
 * TestFlight, Oct 2026: "the first time it doesn't work, the second time it
 * works".
 *
 * Both other pickers in this app — `moments/media-upload` and
 * `resources/file-upload-field` — already did this. The profile avatar was the
 * one path that never got a device pass.
 *
 * A REFUSAL THROWS rather than returning null, because the OS asks only once:
 * after a "Don't Allow" every later tap is refused in silence, and the patient
 * needs to be told that the switch is in Settings and not in this app.
 */
export async function pickImage(fromCamera: boolean): Promise<PickedImage | null> {
  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new PermissionDenied(fromCamera ? 'camera' : 'library');

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
  // WHICH STEP FAILED. This returned a bare null for five different failures —
  // crop, measure, presign, PUT — so "Photo did not upload. Try again." was the
  // only thing anyone could report, on a screen where the picture never appears
  // and there is nothing else to look at. Each step now throws with its own
  // name, and the screen shows it.
  const out = await ImageManipulator.manipulateAsync(
    source.uri,
    [{ crop }, { resize: { width: SIZE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  ).catch((e: unknown) => { throw new Error(`crop: ${String(e)}`); });

  const size = await byteSize(out.uri).catch((e: unknown) => { throw new Error(`size: ${String(e)}`); });
  if (!size) throw new Error('size: 0 bytes');

  const signed = await presignAvatar('image/jpeg', size);
  if (!signed) throw new Error(`presign refused (${size} bytes)`);

  const ok = await putFile(signed.url, out.uri, 'image/jpeg', signed.headers)
    .catch((e: unknown) => { throw new Error(`put threw: ${String(e)}`); });
  if (!ok) throw new Error('storage refused the upload');

  return { key: signed.key, localUri: out.uri };
}
