import type { ImageSourcePropType } from 'react-native';

// Photography for the editorial onboarding. These are calm, on-theme stock
// photos (Unsplash, free license) used as tasteful placeholders "for the
// moment" — swap any slot for real Bloomsline photography by replacing the file
// in assets/onboarding/ (same name) or pointing the require elsewhere.
export const ONBOARDING_IMAGES: Record<string, ImageSourcePropType | undefined> = {
  splash: require('../../../assets/onboarding/splash.jpg'), // e1 — misty sunrise lake, a canoe at rest
  card1: require('../../../assets/onboarding/card1.jpg'), // e2 — journaling quietly, a space of one's own
  card2: require('../../../assets/onboarding/card2.jpg'), // e2b — a hand writing by a plant-filled window
  card3: require('../../../assets/onboarding/card3.jpg'), // e3 — two people holding each other, outdoors
  card4: require('../../../assets/onboarding/card4.jpg'), // e3b — gentle movement / nature
  about: require('../../../assets/onboarding/about.jpg'), // e4 — soft window light, out of focus
  privacy: require('../../../assets/onboarding/privacy.jpg'), // e4b — light through a window, calm interior
  final: require('../../../assets/onboarding/final.jpg'), // e5 — open, hopeful morning light
};
