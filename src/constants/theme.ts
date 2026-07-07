export const Colors = {
  light: {
    text: '#14171A',
    textSecondary: '#666D77',
    background: '#F7F8FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7F5F3',
    border: '#E5E7EB',
    accent: '#0D9488',
    danger: '#DC2626',
  },
  dark: {
    text: '#EDEEF0',
    textSecondary: '#8A8F98',
    background: '#0A0B0E',
    backgroundElement: '#15171B',
    backgroundSelected: '#17262A',
    border: '#24262B',
    accent: '#2DD4BF',
    danger: '#F87171',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const CategoryColors = {
  file: '#60A5FA',
  software: '#FBBF24',
  usb: '#FB7185',
  other: '#9CA3AF',
} as const;

// Loaded via @expo-google-fonts in the root layout (see _layout.tsx). IBM
// Plex has no variable-weight file, so pick the matching static family per
// weight rather than applying fontWeight on top of a single family.
export const Fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 12,
  large: 20,
  pill: 999,
} as const;

export const BottomTabInset = 0;
export const MaxContentWidth = 800;
