// Mood system — ported from the v1 Bloomsline mobile app (lib/theme.ts) so v2
// looks and behaves identically. Each mood has its own COLOR (drives the
// timeline orbs), a lucide ICON, and a 0..100 valence SCORE (drives the
// Emotional Flow curve height). Legacy keys are kept so moments created against
// the v2 backend's older vocab (joyful/tender/restless/uncertain) still render.
//
// The v2 backend sanitizes moods permissively (keeps unknown ids), so this
// richer client set stores cleanly without a backend change.
import {
  Leaf, Heart, Sun, HeartHandshake, Trophy, Sparkles, Laugh, Zap, Moon, Wind,
  CloudDrizzle, UserX, Tornado, CloudRain, Flame, Ghost, TreePalm, type LucideIcon,
} from 'lucide-react-native';

export const MOOD_SCORES: Record<string, number> = {
  calm: 72, grateful: 90, inspired: 88, loved: 82, proud: 85, hopeful: 75,
  funny: 80, peaceful: 78, playful: 83, anxious: 38, overwhelmed: 35, tired: 42,
  heavy: 32, sad: 28, angry: 30, lonely: 25, fear: 26,
  // legacy keys (older v2 moments)
  joyful: 95, tender: 55, restless: 48, uncertain: 45,
};

export const MOOD_COLORS: Record<string, string> = {
  calm: '#4A9A86', grateful: '#10B981', inspired: '#8B5CF6', loved: '#F43F5E',
  proud: '#EC4899', hopeful: '#F97316', funny: '#FBBF24', playful: '#F59E0B',
  anxious: '#3B82F6', overwhelmed: '#EF4444', tired: '#64748B', heavy: '#475569',
  sad: '#6B7280', angry: '#DC2626', lonely: '#7C3AED', fear: '#4F46E5',
  // legacy keys
  joyful: '#F59E0B', peaceful: '#06B6D4', tender: '#A78BFA', restless: '#EAB308', uncertain: '#94A3B8',
};

export interface MoodDef {
  key: string;
  Icon: LucideIcon;
  label: string;
  color: string;
  valence: number;
}

// Ordered exactly as v1: positive (gentle → energetic), then difficult (mild → intense).
export const MOODS: MoodDef[] = [
  { key: 'peaceful', Icon: TreePalm, label: 'Peaceful', color: '#06B6D4', valence: 78 },
  { key: 'calm', Icon: Leaf, label: 'Calm', color: '#4A9A86', valence: 72 },
  { key: 'grateful', Icon: Heart, label: 'Grateful', color: '#10B981', valence: 90 },
  { key: 'hopeful', Icon: Sun, label: 'Hopeful', color: '#F97316', valence: 75 },
  { key: 'loved', Icon: HeartHandshake, label: 'Loved', color: '#F43F5E', valence: 82 },
  { key: 'proud', Icon: Trophy, label: 'Proud', color: '#EC4899', valence: 85 },
  { key: 'inspired', Icon: Sparkles, label: 'Inspired', color: '#8B5CF6', valence: 88 },
  { key: 'funny', Icon: Laugh, label: 'Funny', color: '#FBBF24', valence: 80 },
  { key: 'playful', Icon: Zap, label: 'Playful', color: '#F59E0B', valence: 83 },
  { key: 'tired', Icon: Moon, label: 'Tired', color: '#64748B', valence: 42 },
  { key: 'anxious', Icon: Wind, label: 'Anxious', color: '#3B82F6', valence: 38 },
  { key: 'sad', Icon: CloudDrizzle, label: 'Sad', color: '#6B7280', valence: 28 },
  { key: 'lonely', Icon: UserX, label: 'Lonely', color: '#7C3AED', valence: 25 },
  { key: 'overwhelmed', Icon: Tornado, label: 'Overwhelmed', color: '#EF4444', valence: 35 },
  { key: 'heavy', Icon: CloudRain, label: 'Heavy', color: '#475569', valence: 32 },
  { key: 'angry', Icon: Flame, label: 'Angry', color: '#DC2626', valence: 30 },
  { key: 'fear', Icon: Ghost, label: 'Fearful', color: '#4F46E5', valence: 26 },
];

const MOOD_MAP = new Map(MOODS.map((m) => [m.key, m]));

export const moodColor = (key: string): string => MOOD_COLORS[key] ?? '#666';
export const moodDef = (key: string): MoodDef | undefined => MOOD_MAP.get(key);
export const moodLabel = (key: string): string => MOOD_MAP.get(key)?.label ?? key;
