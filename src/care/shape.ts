// What the app shows for the care profile on screen (guardian plan, phase 6).
//
// One account can be several people's way in: a patient's own care, a child's
// care as their guardian, or a child's own account. The server enforces every
// rule (it refuses a child's booking, gives a guardian none of the child's
// writing); this decides what the app OFFERS, so a button is never shown that
// the server will refuse, and the screen says why something is not there.
//
// Pure, with no React Native import, so `scripts/shape.test.mjs` runs it in Node.

export interface CareProfile {
  /** The member id of the chart (or, on a server from before roles, the practitioner id). */
  key: string;
  practitionerId: string;
  practitionerName: string | null;
  photoUrl: string | null;
  role: 'patient' | 'guardian';
  /** A patient link on a minor's chart: the person signed in is the child. */
  child: boolean;
  /** On a guardian link, whose care it is. */
  childFirstName: string | null;
}

export type AppShape = 'patient' | 'child' | 'guardian' | 'none';

export function shapeOf(profile: CareProfile | null | undefined): AppShape {
  if (!profile) return 'none';
  if (profile.role === 'guardian') return 'guardian';
  return profile.child ? 'child' : 'patient';
}

export type Feature =
  | 'book'            // book a session
  | 'changeSessions'  // cancel / reschedule
  | 'share'           // share a moment or a journal page with the practitioner
  | 'fromPractitioner'// exercises, to-dos and the practitioner's library
  | 'documents'       // documents to sign and signed copies
  | 'sessions';       // see upcoming and past sessions

const ALLOWED: Record<AppShape, readonly Feature[]> = {
  patient: ['book', 'changeSessions', 'share', 'fromPractitioner', 'documents', 'sessions'],
  // The child sees their sessions and does their exercises, and shares what they
  // choose; the parent books, and the documents are the parent's.
  child: ['share', 'fromPractitioner', 'sessions'],
  // The guardian books and handles documents for the child. The child's own
  // writing and exercises are not theirs, and their own space shares with no one.
  guardian: ['book', 'changeSessions', 'documents', 'sessions'],
  none: [],
};

/** Whether the profile on screen offers a feature. The practitioner's own
 *  settings (may patients book at all?) still apply on top of this. */
export function can(shape: AppShape, feature: Feature): boolean {
  return ALLOWED[shape].includes(feature);
}

/** How a profile is named in the switcher: the practitioner for one's own care,
 *  the child (with the practitioner) for a guardian's. */
export function profileLabel(p: CareProfile): { title: string; subtitle: string | null } {
  if (p.role === 'guardian') {
    return { title: p.childFirstName ?? p.practitionerName ?? '', subtitle: p.practitionerName };
  }
  return { title: p.practitionerName ?? '', subtitle: null };
}

/**
 * The profiles from `/me`: its role-aware `links` on a server that has them,
 * otherwise the practitioners list as patient profiles, exactly as before.
 */
export function profilesFrom(me: {
  links?: { linkId: string; practitionerId: string; practitionerName: string | null; photoUrl: string | null; role: 'patient' | 'guardian'; child: boolean; childFirstName: string | null }[];
  practitioners?: { id: string; name: string; photoUrl: string | null }[];
}): CareProfile[] {
  if (Array.isArray(me.links)) {
    return me.links.map((l) => ({
      key: l.linkId, practitionerId: l.practitionerId, practitionerName: l.practitionerName, photoUrl: l.photoUrl,
      role: l.role === 'guardian' ? 'guardian' : 'patient', child: l.role !== 'guardian' && l.child === true, childFirstName: l.childFirstName ?? null,
    }));
  }
  return (me.practitioners ?? []).map((p) => ({
    key: p.id, practitionerId: p.id, practitionerName: p.name, photoUrl: p.photoUrl, role: 'patient', child: false, childFirstName: null,
  }));
}

/** The headers a selection sends: the practitioner when there is a choice to
 *  make, and the link only for a guardian's view of a child. */
export function headersFor(profiles: CareProfile[], selected: CareProfile | null): { practitionerId: string | null; linkId: string | null } {
  if (!selected) return { practitionerId: null, linkId: null };
  return {
    practitionerId: profiles.length > 1 ? selected.practitionerId : null,
    linkId: selected.role === 'guardian' ? selected.key : null,
  };
}
