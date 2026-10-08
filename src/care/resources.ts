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

/**
 * Where a to-do stands, as the patient would put it. The assignment's own status
 * only knows assigned / in progress / completed, and a worksheet with answers
 * kept as a draft, or one the practitioner handed back, both read "assigned"
 * (a reopen sets it back), which is "Not started" on a card the patient has
 * already half filled in. `hasDraft` and `reopened` say the rest when the server
 * sends them; without them this is the status alone, as before.
 */
export type TodoStage = 'todo' | 'progress' | 'reopened' | 'done';

export function todoStage(it: { status: string; hasDraft?: boolean; reopened?: boolean }): TodoStage {
  if (it.status === 'completed') return 'done';
  if (it.reopened) return 'reopened';
  if (it.status === 'in_progress' || it.hasDraft) return 'progress';
  return 'todo';
}

export function stageLabel(stage: TodoStage, locale: Locale = 'en'): string {
  if (locale === 'fr') return stage === 'done' ? 'Terminé' : stage === 'progress' ? 'En cours' : stage === 'reopened' ? 'Rouvert' : 'Pas commencé';
  return stage === 'done' ? 'Done' : stage === 'progress' ? 'In progress' : stage === 'reopened' ? 'Reopened' : 'Not started';
}

/**
 * "By Thursday 9 Oct" / "Pour le jeudi 9 oct.", from the day the practitioner
 * picked when sending. The day is stored at 12:00 UTC and read in UTC, so it is
 * the same day wherever the patient is. null when there is none, it cannot be
 * read, or the item is done (a deadline on finished work is noise).
 */
export function dueLabel(dueAt: string | null | undefined, stage: TodoStage, locale: Locale = 'en'): string | null {
  if (!dueAt || stage === 'done') return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const day = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
    return locale === 'fr' ? `Pour le ${day}` : `By ${day}`;
  } catch {
    return null;
  }
}

/**
 * The card's thin border for a stage. Colour is a second signal beside the
 * written status, never the only one, so it stays muted: a coral that reads as
 * "not yet" rather than as an error, amber for anything under way (a handed
 * back worksheet is under way again), green once it is done.
 */
export function stageLine(stage: TodoStage, palette: { statusTodo: string; statusProgress: string; statusDone: string }): string {
  return stage === 'done' ? palette.statusDone : stage === 'todo' ? palette.statusTodo : palette.statusProgress;
}
