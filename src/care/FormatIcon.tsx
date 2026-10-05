// The icon for a session format, places included (see session-format.ts).
import { Building2, CalendarDays, House, MapPin, Phone, Trees, Video } from 'lucide-react-native';
import { formatIconKey } from './session-format';

export function FormatIcon({ format, size = 14, color, strokeWidth = 2 }: { format: string; size?: number; color: string; strokeWidth?: number }) {
  const props = { size, color, strokeWidth };
  switch (formatIconKey(format)) {
    case 'video': return <Video {...props} />;
    case 'phone': return <Phone {...props} />;
    case 'practice': return <Building2 {...props} />;
    case 'home': return <House {...props} />;
    case 'outdoors': return <Trees {...props} />;
    case 'pin': return <MapPin {...props} />;
    default: return <CalendarDays {...props} />;
  }
}
