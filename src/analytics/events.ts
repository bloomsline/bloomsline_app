// What the app is allowed to send to analytics, and what it is never allowed to
// send with it.
//
// This file is the whole privacy argument in one place, and it is deliberately
// PURE TypeScript — no React, no react-native — so `npm test` can run it and
// so nothing here can quietly grow a dependency on app state.
//
// TWO RULES, both enforced here rather than remembered:
//
//   1. Event names are a closed union. There is no free-text `track('...')` in
//      this codebase; adding an event means adding it to this list, which is
//      the moment someone can ask whether it should exist.
//
//   2. Properties are FILTERED, not trusted. `safeProperties` drops anything
//      that looks like a person or like something a patient wrote, even when
//      the call site is correct today. The care app learned this the hard way:
//      v1 ran PostHog autocapture over the practitioner app, its own security
//      audit logged "PostHog autocapture text-masking", and the fix shipped as
//      "PostHog PII scrubbing". Scrubbing is the wrong end of the problem. This
//      app is worse ground still: everything in it is a patient's own words.
//
// The counts are the point, never the content: that a moment was written, not
// what it said.

/**
 * Every event this app may send. Screen views are not here — they go through
 * PostHog's own `$screen` (see client.ts) so its product analytics understands
 * them.
 */
export type AnalyticsEvent =
  // Getting in. `method` is how someone signed in, never who they are.
  | 'sign_in_started'
  | 'sign_in_completed'
  | 'sign_in_failed'
  | 'invite_opened'
  // Onboarding, step by step, because this is where an invited patient is most
  // likely to fall out and we cannot see it any other way.
  | 'onboarding_profile_saved'
  | 'onboarding_terms_agreed'
  | 'onboarding_completed'
  | 'moments_intro_completed'
  // What a patient does with the app.
  | 'moment_created'
  | 'moment_shared'
  | 'moment_unshared'
  | 'moment_deleted'
  | 'journal_page_created'
  | 'journal_shared'
  | 'journal_unshared'
  | 'worksheet_submitted'
  | 'library_activity_completed'
  | 'session_booked'
  | 'session_cancelled'
  | 'account_deletion_requested'
  // The practitioner side of the same app.
  | 'practitioner_note_saved'
  | 'practitioner_session_closed'
  | 'practitioner_patient_added'
  | 'practitioner_resource_shared'
  | 'practitioner_session_booked'
  | 'practitioner_request_decided'
  // Consent itself. Recorded on the way IN (granting) only — a refusal cannot
  // be recorded, because a refusal means nothing is sent.
  | 'analytics_consent_granted';

/** Properties are small, closed values: a kind, a count, a yes or no. */
export type AnalyticsProps = Record<string, string | number | boolean | null>;

/**
 * Substrings that make a property name unsendable.
 *
 * Matched against the LOWER-CASED key, so `firstName`, `first_name` and
 * `patientName` all go. Copied from the care app's list and extended for this
 * app's own vocabulary (moment, journal, entry, title, caption, transcript).
 */
const FORBIDDEN = [
  'email', 'mail', 'name', 'phone', 'tel', 'address', 'postcode', 'zip',
  'dob', 'birth', 'age', 'note', 'content', 'body', 'text', 'message',
  'diagnosis', 'condition', 'medication', 'reason', 'comment', 'answer',
  'token', 'secret', 'password', 'signature', 'ip', 'caption', 'title',
  'transcript', 'entry', 'journal', 'moment', 'query', 'search', 'url',
];

/** A property value longer than this is prose, whatever it is called. */
const MAX_STRING = 64;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * Keep only what is safe to send.
 *
 * Unsafe properties are DROPPED, never thrown: an event losing a property is a
 * worse dashboard, an exception here would be a crash in a patient's app in the
 * middle of writing something. The dropped keys are returned so the caller can
 * complain in development, where a mistake is cheap to fix.
 */
export function safeProperties(props: AnalyticsProps | undefined): { props: AnalyticsProps; dropped: string[] } {
  const out: AnalyticsProps = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(props ?? {})) {
    const lower = key.toLowerCase();
    if (FORBIDDEN.some((bad) => lower.includes(bad))) { dropped.push(key); continue; }
    if (value === null || typeof value === 'number' || typeof value === 'boolean') { out[key] = value; continue; }
    if (typeof value === 'string') {
      // A long string is prose even under an innocent key, and an address is an
      // address wherever it is found.
      if (value.length > MAX_STRING || EMAIL.test(value)) { dropped.push(key); continue; }
      out[key] = value;
      continue;
    }
    dropped.push(key);
  }
  return { props: out, dropped };
}
