// Resource-type presentation for the "To do" / "From your practitioner" lists.
import { PenLine, ClipboardList, Dumbbell, BookOpen, Table, FileText, type LucideIcon } from 'lucide-react-native';

const TYPE_META: Record<string, { Icon: LucideIcon; label: string }> = {
  worksheet: { Icon: PenLine, label: 'Worksheet' },
  assessment: { Icon: ClipboardList, label: 'Assessment' },
  exercise: { Icon: Dumbbell, label: 'Exercise' },
  psychoeducation: { Icon: BookOpen, label: 'Reading' },
  table: { Icon: Table, label: 'Table' },
};

export function resourceTypeMeta(type: string): { Icon: LucideIcon; label: string } {
  return TYPE_META[type] ?? { Icon: FileText, label: 'Resource' };
}

export function statusLabel(status: string): string {
  return status === 'completed' ? 'Done' : status === 'in_progress' ? 'In progress' : 'Not started';
}

export const isDone = (status: string): boolean => status === 'completed';
