// Opening a PDF, on three platforms that need different machinery for it.
//
// Lifted out of `resources/blocks.tsx`, where it was worked out the first time
// and then needed again by the documents tab. Two copies of this would drift,
// and the Android half in particular is the kind of thing that gets "simplified"
// back into a bug by someone who only tested on iOS.
//
// iOS: `openBrowserAsync` is an SFSafariViewController — an in-app sheet that
//   renders the PDF and dismisses straight back onto the screen behind it.
//   Its own toolbar carries share and save, so there is no separate download
//   button to build.
//
// ANDROID looks like iOS and is not. `openBrowserAsync` there is a Chrome
//   Custom Tab, which does not render PDFs at all: it downloads the file or
//   shows a blank page. So the url goes to the system, which has something that
//   can actually open one — and falls back to the browser if nothing does,
//   rather than to nothing at all.
//
// WEB: `openBrowserAsync` falls through to `window.open`, which is fine for a
//   document opened from a list. A screen the patient was halfway through needs
//   a real modal instead; `resources/blocks.tsx` has one for exactly that.
import { Platform, Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/** Open a PDF url the best way this platform can. Resolves when it is open (or
 *  has been handed off), never rejects — nothing useful can be done with a
 *  failure here that the fallbacks have not already tried. */
export async function openPdf(url: string): Promise<void> {
  if (Platform.OS === 'android') {
    await Linking.openURL(url).catch(() => WebBrowser.openBrowserAsync(url).then(() => undefined));
    return;
  }
  await WebBrowser.openBrowserAsync(url).catch(() => undefined);
}
