// The home route for each session status. One place so every gate agrees.
export function hrefForStatus(status: string): string {
  if (status === 'practitioner') return '/(practitioner)/home';
  if (status === 'authed') return '/(app)/home';
  if (status === 'onboarding') return '/(onboarding)/start';
  return '/(auth)/welcome';
}
