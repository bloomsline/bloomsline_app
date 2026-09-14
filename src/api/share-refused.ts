// A share the server refused for a reason worth saying, rather than "could not
// update sharing". Today the one reason: nobody is linked to share with (409). It
// read as a network error, and trying again could never work.
export class ShareRefused extends Error {
  constructor(public reason: 'no_practitioner') {
    super(reason);
    this.name = 'ShareRefused';
  }
}

/** Throw for a failed share response: refused when the server says why. */
export async function throwShareFailure(res: Response, what: string): Promise<never> {
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as { reason?: string } | null;
    if (body?.reason === 'no_practitioner') throw new ShareRefused('no_practitioner');
  }
  throw new Error(`${what} (${res.status})`);
}

/** Names of who can read a share now, as the server sent them. */
export const readersFrom = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
