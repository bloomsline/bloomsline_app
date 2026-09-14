// A patient still `pending` is listed with the others and says so, wherever the
// practitioner picks a patient: People, booking, sharing. Patients added from the
// phone before it created them as active were stored as pending and vanished
// from these lists.
import type { PatientListItem } from '@/src/api/practitioner';

const LABEL = { en: 'Pending', fr: 'En attente' } as const;

export const patientLabel = (p: Pick<PatientListItem, 'name' | 'status'>, locale: 'en' | 'fr'): string =>
  p.status === 'pending' ? `${p.name} · ${LABEL[locale] ?? LABEL.en}` : p.name;
