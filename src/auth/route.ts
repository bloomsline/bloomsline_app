// The home route for each session status. One place so every gate agrees.
export function hrefForStatus(status: string): string {
  if (status === 'practitioner') return '/(practitioner)/home';
  // Authed patients route through the index gate ('/'), which reads the stored
  // landing preference and sends them to THEIR chosen home tab (My Care or
  // Moments) — not a hardcoded one. index.tsx never calls this for 'authed', so
  // there is no redirect loop.
  if (status === 'authed') return '/';
  if (status === 'onboarding') return '/(onboarding)/start';
  return '/(auth)/welcome';
}
