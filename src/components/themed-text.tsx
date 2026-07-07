import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const resolvedColor = theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')];

  return (
    <Text
      style={[
        { color: resolvedColor },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  smallBold: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  default: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: Fonts.sansBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  link: {
    fontFamily: Fonts.sansMedium,
    lineHeight: 20,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: Fonts.sansSemiBold,
    lineHeight: 20,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
