// The one file that touches the PostHog SDK.
//
// Everything else in the app calls `track('moment_created', { kind })` and can
// stay ignorant of consent, of whether analytics is configured at all, and of
// the SDK's shape. Nothing here throws: a statistics call must never be able to
// break a screen.
//
// THE FIVE DECISIONS, all of them here rather than in a settings page someone
// can change without reading this:
//
//   1. ANONYMOUS. `personProfiles: 'never'` — PostHog will not create a person
//      for anyone, and `identify()` is a no-op even if some future code calls
//      it. Events carry a random per-install id and nothing else. The care web
//      app identifies practitioners by id and name; this app holds patients'
//      own words, so it identifies nobody. The cost is that we count installs
//      rather than people, which is the right trade for a mental health app.
//
//   2. NOTHING BEFORE CONSENT — not even a handshake. The SDK is not BUILT
//      until someone says yes. `defaultOptIn: false` alone was not enough: an
//      opted-out client still fetches its remote config on construction, which
//      showed up in testing as two requests leaving the app before the question
//      had been answered. They carried no personal data, but "we send nothing
//      until you agree" has to be true as written. `defaultOptIn: false` stays
//      as the second lock.
//
//   3. NO AUTOCAPTURE, NO REPLAY. There is no PostHogProvider wrapping the app
//      and `enableSessionReplay` stays off, so no tap, no screenshot and no
//      text ever reaches the SDK. Screens are sent by hand, by name, from
//      `provider.tsx`.
//
//   4. NO GEOIP. `disableGeoip: true` — the web app keeps country for its
//      marketing site; a patient's town is not something this app needs to
//      know.
//
//   5. A SHORT MEMORY WHILE THE QUESTION IS OPEN. Until someone answers, events
//      wait in MEMORY — never on disk, never sent — and are replayed if they
//      say yes and dropped the moment they say no or close the app. Without it
//      the one funnel worth measuring, an invited patient's first ten minutes,
//      could never be measured at all: the question is asked after onboarding,
//      because asking during it is an interruption at the worst moment.
//
//   6. A LAST FILTER AT THE DOOR. `before_send` runs every outgoing event
//      through `safeProperties` again. The call sites are already careful; this
//      is what catches the careless one that has not been written yet.
import { Platform } from 'react-native';
import PostHog from 'posthog-react-native';
import type { PostHogEventProperties } from '@posthog/core';
import { API_URL, POSTHOG_KEY } from '@/src/config';
import { analyticsAllowed, consentState } from './consent';
import { safeProperties, type AnalyticsEvent, type AnalyticsProps } from './events';
import { screenName } from './screens';

/**
 * Where events go: our own domain, which forwards to PostHog's EU region
 * (`next.config.ts` in the care app rewrites `/ingest/*`).
 *
 * The phone therefore never opens a connection to a third party — the same
 * property the website protects by proxying, and the reason the privacy policy
 * can say so plainly. It also means one host to allow, and one to change.
 */
const HOST = `${API_URL.replace(/\/$/, '')}/ingest`;

/**
 * Where the SDK keeps its queue and its per-install id.
 *
 * On a phone it finds `expo-file-system` on its own. On the WEB build there is
 * none — it looks for expo-file-system or async-storage, finds neither, and
 * throws "No storage available" at construction, which silently meant no
 * analytics at all on app.bloomsline.com. localStorage is the web's answer, and
 * it is wrapped because touching it THROWS in private browsing and wherever
 * site data is blocked (the same reason `src/storage.ts` wraps it).
 */
const webStorage = Platform.OS === 'web'
  ? {
      getItem: (key: string) => { try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; } },
      setItem: (key: string, value: string) => { try { globalThis.localStorage?.setItem(key, value); } catch { /* private browsing */ } },
    }
  : undefined;

let client: PostHog | null = null;
/** Properties sent with every event: never a person, only what the numbers must
 *  be split by to mean anything. */
let superProps: AnalyticsProps = {};

/** Events from before the question was answered. Memory only, and small: this
 *  is a few minutes of onboarding, not a log. */
const pending: { kind: 'event'; name: AnalyticsEvent; props?: AnalyticsProps }[] = [];
const PENDING_MAX = 40;
/** True once the question has an answer, either way. */
function answered(): boolean {
  return consentState() !== 'unset';
}

/** Analytics is off entirely unless a key is configured, the same gate the auth
 *  providers use. A build with no key behaves exactly like a refusal. */
export function analyticsConfigured(): boolean {
  return POSTHOG_KEY.length > 0;
}

/**
 * Build the client, if there is anything to build for.
 *
 * Self-guarding: no key, or no yes, and nothing happens. Called at startup for
 * a device that has already agreed, and again the moment someone agrees.
 */
export function startAnalytics(): void {
  if (client || !analyticsConfigured() || !analyticsAllowed()) return;
  try {
    client = new PostHog(POSTHOG_KEY, {
      host: HOST,
      customStorage: webStorage,
      defaultOptIn: false,
      personProfiles: 'never',
      disableGeoip: true,
      // App opened / backgrounded / installed / updated. Generic, useful for
      // reading retention, and none of it describes a person.
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      disableSurveys: true,
      // No flags and no push registration in this app: fewer requests, and
      // nothing that needs an identified person.
      preloadFeatureFlags: false,
      disableRemoteFeatureFlags: true,
      capturePushNotificationSubscriptions: false,
      capturePushNotificationOpened: false,
      before_send: (event) => {
        if (!event) return null;
        const properties = event.properties ?? {};
        const own: AnalyticsProps = {};
        const kept: PostHogEventProperties = {};
        for (const [key, value] of Object.entries(properties)) {
          // PostHog's own `$` properties are the SDK's (screen name, app
          // version, device model). Ours are the ones a call site wrote, and
          // they are the ones that can be wrong.
          if (key.startsWith('$')) kept[key] = value;
          else own[key] = value as AnalyticsProps[string];
        }
        const { props, dropped } = safeProperties(own);
        if (__DEV__ && dropped.length > 0) {
          console.warn(`[analytics] "${event.event}": dropped unsafe properties: ${dropped.join(', ')}`);
        }
        return { ...event, properties: { ...kept, ...props } };
      },
    });
    void client.optIn();
  } catch (e) {
    // A broken analytics setup is not a broken app. Said out loud in
    // development, where it is a mistake to fix, and silent in production,
    // where it is a statistic nobody gets.
    if (__DEV__) console.warn('[analytics] could not start', e);
    client = null;
  }
}

/** Agreeing, or changing your mind, after the client exists. */
export function applyConsent(granted: boolean): void {
  if (!granted) {
    // Nothing waiting is sent, and nothing about this device is kept: a refusal
    // that leaves an id behind is not a refusal.
    pending.length = 0;
    try {
      if (client) { void client.optOut(); client.reset(); void client.optOut(); }
    } catch { /* ignore */ }
    return;
  }
  // First yes on this device: this is where the client comes into existence.
  startAnalytics();
  if (!client) return;
  try {
    void client.optIn();
    // The steps taken while the question was open, sent now that it has an
    // answer. They never touched the disk and never left the phone before this.
    const held = pending.splice(0, pending.length);
    for (const item of held) client.capture(item.name, { ...superProps, ...safeProperties(item.props).props });
  } catch { /* ignore */ }
}

/**
 * Properties attached to every event from now on.
 *
 * Used for `role` (patient or practitioner) and `locale`, which is what makes
 * the numbers readable without describing anyone. Goes through the same filter
 * as everything else.
 */
export function setSuperProperties(props: AnalyticsProps): void {
  superProps = safeProperties(props).props;
}

/**
 * One named event.
 *
 * Silent when analytics is unconfigured or refused. While the question is still
 * open the event waits in memory (see the note at the top) instead of being
 * thrown away.
 */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (!analyticsConfigured()) return;
  if (!analyticsAllowed()) {
    if (!answered() && pending.length < PENDING_MAX) pending.push({ kind: 'event', name: event, props });
    return;
  }
  if (!client) return;
  try {
    const { props: safe, dropped } = safeProperties(props);
    if (__DEV__ && dropped.length > 0) {
      console.warn(`[analytics] "${event}": dropped unsafe properties: ${dropped.join(', ')}`);
    }
    client.capture(event, { ...superProps, ...safe });
  } catch {
    // ignore
  }
}

/**
 * A screen view, by route.
 *
 * Sent as PostHog's own `$screen` so its product analytics understands it, with
 * the path cleaned of ids and tokens first (see screens.ts).
 */
export function trackScreen(pathname: string): void {
  if (!client || !analyticsAllowed()) return;
  try {
    client.screen(screenName(pathname), { ...superProps });
  } catch {
    // ignore
  }
}

/**
 * Sign-out: forget the per-install id and start a new one.
 *
 * `reset()` also clears the SDK's own opt-in flag, so consent — which lives in
 * our storage, not PostHog's — is applied again straight after. Without that,
 * signing out would silently turn analytics off until the next app launch.
 */
export function resetAnalytics(): void {
  pending.length = 0;
  if (!client) return;
  try {
    client.reset();
    superProps = {};
    if (analyticsAllowed()) void client.optIn();
    else void client.optOut();
  } catch {
    // ignore
  }
}

/** Send whatever is queued. Used when the answer matters immediately, such as
 *  right after consent is given. */
export function flushAnalytics(): void {
  if (!client) return;
  void client.flush().catch(() => {});
}
