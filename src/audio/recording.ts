// How voice notes are recorded, in one place for Moments and the journal.
//
// On the web the recorder asked for WebM, which is what Chrome makes by default
// and what the iPhone app cannot play: a voice note recorded in a browser showed
// "—" in the iOS app, and tapping play did nothing. Safari only ever made MP4,
// which it then uploaded LABELLED as WebM. Browsers that can record MP4 (Safari,
// and current Chrome) now do, so the note plays everywhere, and the label is
// read from the recording itself rather than assumed.
import { Platform } from 'react-native';
import { RecordingPresets, type RecordingOptions } from 'expo-audio';

/** The formats worth asking a browser for, best-travelled first. */
const WEB_PREFERENCE = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];

function webMimeType(): string {
  const MR = (globalThis as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder;
  if (!MR?.isTypeSupported) return 'audio/webm';
  return WEB_PREFERENCE.find((t) => MR.isTypeSupported!(t)) ?? 'audio/webm';
}

export const VOICE_RECORDING: RecordingOptions =
  Platform.OS === 'web'
    ? { ...RecordingPresets.HIGH_QUALITY, web: { ...RecordingPresets.HIGH_QUALITY.web, mimeType: webMimeType() } }
    : RecordingPresets.HIGH_QUALITY;

/** The content type a finished recording actually is, without codec detail (the
 *  server's allowlist is by container). Native records AAC in MP4. */
export async function recordedMime(uri: string): Promise<string> {
  if (Platform.OS !== 'web') return 'audio/mp4';
  try {
    const type = (await (await fetch(uri)).blob()).type.split(';')[0].trim();
    if (type === 'audio/mp4' || type === 'audio/webm' || type === 'audio/ogg' || type === 'audio/wav') return type;
    if (type === 'video/mp4') return 'audio/mp4';
    if (type === 'video/webm') return 'audio/webm';
  } catch {
    // The recording is still there; fall back to what was asked for.
  }
  return webMimeType().split(';')[0];
}
