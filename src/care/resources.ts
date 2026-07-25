// Resource-type presentation for the "To do" / "From your practitioner" lists.
import { PenLine, ClipboardList, Dumbbell, BookOpen, Table, FileText, type LucideIcon } from 'lucide-react-native';

type Locale = 'en' | 'fr';

const TYPE_ICON: Record<string, LucideIcon> = {
  worksheet: PenLine,
  assessment: ClipboardList,
  exercise: Dumbbell,
  psychoeducation: BookOpen,
  table: Table,
};

const TYPE_LABEL: Record<Locale, Record<string, string>> = {
  en: { worksheet: 'Worksheet', assessment: 'Assessment', exercise: 'Exercise', psychoeducation: 'Reading', table: 'Table', _default: 'Resource' },
  fr: { worksheet: 'Fiche', assessment: 'Évaluation', exercise: 'Exercice', psychoeducation: 'Lecture', table: 'Tableau', _default: 'Ressource' },
};

export function resourceTypeMeta(type: string, locale: Locale = 'en'): { Icon: LucideIcon; label: string } {
  const labels = TYPE_LABEL[locale];
  return { Icon: TYPE_ICON[type] ?? FileText, label: labels[type] ?? labels._default };
}

export function statusLabel(status: string, locale: Locale = 'en'): string {
  if (locale === 'fr') return status === 'completed' ? 'Terminé' : status === 'in_progress' ? 'En cours' : 'Pas commencé';
  return status === 'completed' ? 'Done' : status === 'in_progress' ? 'In progress' : 'Not started';
}

export const isDone = (status: string): boolean => status === 'completed';
