// Daily's native tokens mirror the original Daily prototype.
export const theme = {
  background: '#faf8f5', card: '#ffffff', foreground: '#2f3140',
  primary: '#f58f6c', primaryForeground: '#2f3140',
  secondary: '#f1eeeb', secondaryForeground: '#2f3140',
  muted: '#f1eeeb', mutedForeground: '#777681', border: '#e8e2de',
  accent: '#fbe5d9', accentForeground: '#85452e',
  destructive: '#ad443c', destructiveForeground: '#ffffff',
  input: '#e8e2de', cardForeground: '#2f3140',
  text: '#2f3140', tint: '#f58f6c',
  charcoal: '#2f3140', onCharcoal: '#fdfbf9', subtleOnCharcoal: '#c8c6d0',
  peach: '#fdf0e7', success: '#617e6c', vacation: '#ba9d74', sick: '#a990a0',
  overlay: '#22233088', transparent: 'transparent',
};
export type DailyColors = typeof theme;
export const darkTheme: DailyColors = {
  background: '#20212a', card: '#292b36', foreground: '#f5eee8',
  primary: '#f58f6c', primaryForeground: '#2f3140',
  secondary: '#343541', secondaryForeground: '#f5eee8',
  muted: '#343541', mutedForeground: '#bcb5bf', border: '#45434e',
  accent: '#4e3733', accentForeground: '#ffbc9e',
  destructive: '#ed9b92', destructiveForeground: '#34211f',
  input: '#45434e', cardForeground: '#f5eee8',
  text: '#f5eee8', tint: '#f58f6c',
  charcoal: '#2f3140', onCharcoal: '#fdfbf9', subtleOnCharcoal: '#c8c6d0',
  peach: '#3d3031', success: '#a1c2ab', vacation: '#d4b88f', sick: '#c9aebe',
  overlay: '#12131bb3', transparent: 'transparent',
};
export const fonts = { regular: 'Outfit_400Regular', medium: 'Outfit_500Medium', semibold: 'Outfit_600SemiBold', bold: 'Outfit_700Bold' };
export default { light: theme, dark: darkTheme, radius: 20 };