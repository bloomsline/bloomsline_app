// Counting the answer to the statistics question, including the noes.
//
// This is NOT analytics and never touches PostHog. It is one request to our own
// server carrying four facts about nobody: the app, the language, whether this
// was a first answer or a change of mind, and yes or no. The server keeps a
// daily count and nothing else — no account, no device id, no IP, no time of
// day (see the care app's `api/consent-tally`).
//
// It runs on a REFUSAL too, which is the whole point: a refusal sends nothing
// to PostHog, so without this the share of people who decline would be
// permanently unknowable, and a question nobody can measure is a question
// nobody can improve. This single request is the only thing that leaves the
// phone when someone says no, and nothing follows it.
import { API_URL } from '@/src/config';

export function countConsentAnswer(input: { kind: 'first' | 'change'; granted: boolean; locale: string }): void {
  try {
    void fetch(`${API_URL.replace(/\/$/, '')}/api/consent-tally`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surface: 'app', ...input }),
    }).catch(() => {});
  } catch {
    // A counter is never worth an error in front of somebody answering a
    // question about privacy.
  }
}
