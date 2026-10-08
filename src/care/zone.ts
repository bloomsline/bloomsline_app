// When the phone and the practitioner keep different clocks. Booking times are
// shown on the phone's clock (the right one for the person who has to turn up),
// but nothing said so: a patient abroad, or a phone set to another zone, read
// "8:00" as the practitioner's 8:00. Pure, no imports, so `npm test` reads it.

/** "Europe/Paris" → "Paris", "America/New_York" → "New York". */
export function zoneCity(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

/**
 * The two cities to name when the clocks differ at `at`, or null when they show
 * the same time (same zone, or two zones that agree, like Paris and Madrid).
 */
export function zoneDifference(phoneTz: string | undefined, practitionerTz: string | undefined, at: Date = new Date()): { phone: string; practitioner: string } | null {
  if (!phoneTz || !practitionerTz || phoneTz === practitionerTz) return null;
  const clock = (tz: string) => {
    try {
      return at.toLocaleString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: '2-digit' });
    } catch {
      return null;
    }
  };
  const a = clock(phoneTz);
  const b = clock(practitionerTz);
  if (a === null || b === null || a === b) return null;
  return { phone: zoneCity(phoneTz), practitioner: zoneCity(practitionerTz) };
}
