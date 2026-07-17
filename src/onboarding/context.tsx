// Shared state for the multi-step signup flow. Created once and read/written by
// each onboarding screen. `hasPractitioner` (Flow A vs Flow B) comes from the
// backend profile after auth, with a graceful solo default.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { fetchMe } from '../api/me';

export interface OnboardingData {
  firstName: string;
  lastName: string;
  birthday: string | null;
  hasPractitioner: boolean;
  practitionerName: string | null;
  mood: string | null;
  agreedToTerms: boolean;
}

const EMPTY: OnboardingData = {
  firstName: '',
  lastName: '',
  birthday: null,
  hasPractitioner: false,
  practitionerName: null,
  mood: null,
  agreedToTerms: false,
};

// Dev/preview override: EXPO_PUBLIC_FORCE_FLOW = 'a' (with practitioner) | 'b'
// (solo) forces the branch so both flows can be reviewed before the backend
// /api/mobile/me signal exists. Unset = use the real profile (defaults solo).
const FORCE = process.env.EXPO_PUBLIC_FORCE_FLOW;

interface OnboardingValue extends OnboardingData {
  /** True once the Flow A/B branch has been resolved (profile fetched or forced). */
  resolved: boolean;
  update: (patch: Partial<OnboardingData>) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [data, setData] = useState<OnboardingData>(EMPTY);
  const [resolved, setResolved] = useState(false);

  const update = useCallback((patch: Partial<OnboardingData>) => setData((d) => ({ ...d, ...patch })), []);
  const reset = useCallback(() => { setData(EMPTY); setResolved(false); }, []);

  // Resolve the Flow A/B branch + any pre-filled name once we enter onboarding.
  useEffect(() => {
    if (status !== 'onboarding') return;
    if (FORCE === 'a') { update({ hasPractitioner: true, practitionerName: 'Dr. Maya' }); setResolved(true); return; }
    if (FORCE === 'b') { update({ hasPractitioner: false }); setResolved(true); return; }
    let alive = true;
    fetchMe().then((me) => {
      if (!alive) return;
      if (me) {
        update({
          hasPractitioner: me.hasPractitioner,
          practitionerName: me.practitionerName,
          firstName: me.firstName ?? '',
          lastName: me.lastName ?? '',
        });
      }
      setResolved(true); // null (endpoint absent) → solo default, still resolved
    });
    return () => { alive = false; };
  }, [status, update]);

  const value = useMemo<OnboardingValue>(() => ({ ...data, resolved, update, reset }), [data, resolved, update, reset]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within <OnboardingProvider>');
  return ctx;
}
