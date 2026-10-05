// Handed from the booking screen to the confirm screen in memory, not in the
// route: a route's params are the page URL on the web app, and a patient's home
// address does not belong in a URL (history, logs, a shared link).
let homeAddress: string | null = null;

export const setDraftHomeAddress = (v: string | null | undefined) => { homeAddress = v ?? null; };
export const draftHomeAddress = () => homeAddress;
