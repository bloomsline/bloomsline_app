// Text as a search compares it: lower case and without accents, so "lea" finds
// "Léa" and "ines" finds "Inès". Searches compared case only, and with a caseload
// of French names most of them could only be found by typing the accent.
export const fold = (v: string): string => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
