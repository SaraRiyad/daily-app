import { StyleSheet } from 'react-native';
import { darkTheme, fonts, theme, type DailyColors } from '@/constants/colors';
import { useColors } from './useColors';

const createStyles = (c: DailyColors) => StyleSheet.create({
  text: { fontFamily: fonts.regular, fontSize: 15, color: c.foreground },
  page: { flex: 1, backgroundColor: c.background }, content: { paddingHorizontal: 21, paddingTop: 8, gap: 16 },
  header: { minHeight: 74, paddingHorizontal: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 28, fontFamily: fonts.medium, letterSpacing: -0.7, lineHeight: 34 },
  section: { fontSize: 19, fontFamily: fonts.medium, letterSpacing: -0.3 }, label: { fontFamily: fonts.medium, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: { backgroundColor: c.card, borderRadius: 21, borderWidth: 1, borderColor: c.border, padding: 18, gap: 12 },
  button: { backgroundColor: c.primary, minHeight: 52, borderRadius: 15, paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondary: { backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border },
  note: { backgroundColor: c.secondary, borderRadius: 13, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  input: { minHeight: 52, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 13, fontFamily: fonts.regular, fontSize: 15, color: c.foreground },
  choices: { flexDirection: 'row', backgroundColor: c.secondary, padding: 4, borderRadius: 13, flexWrap: 'wrap', gap: 4 },
  choice: { flex: 1, minWidth: 64, minHeight: 42, padding: 10, borderRadius: 10, justifyContent: 'center' },
  choiceSelected: { backgroundColor: c.accent },
  jobIcon: { width: 45, height: 45, borderRadius: 14, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: c.accent, justifyContent: 'center', alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }, sheet: { backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginVertical: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: '14.2857%', height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
// Immutable style sets, selected reactively; no global color mutation.
const lightStyles = createStyles(theme);
const darkStyles = createStyles(darkTheme);
export function useDailyUI() {
  const c = useColors();
  const statusColor = (status: string) => ({ Work: c.primary, 'Day off': c === darkTheme ? c.mutedForeground : c.charcoal, Vacation: c.vacation, Sick: c.sick }[status] || c.border);
  return { c, s: c === darkTheme ? darkStyles : lightStyles, statusColor };
}