import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

// The accent color flips lightness between themes (bright teal on dark,
// deep teal on light), so button text needs to flip with it for contrast.
const BUTTON_LABEL_COLOR = { light: '#F5FFFE', dark: '#04201C' } as const;

export function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const { error: authError } = mode === 'sign-in' ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (authError) {
      setError(authError);
    }
  }

  function fieldStyle(field: 'email' | 'password') {
    return [styles.input, { color: theme.text, borderColor: focusedField === field ? theme.accent : theme.border }];
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="code" themeColor="accent" style={styles.eyebrow}>
          MONITORIX
        </ThemedText>
        <ThemedText type="title" style={styles.title}>
          {mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          {mode === 'sign-in'
            ? 'Access your device activity dashboard.'
            : 'Set up an account to start monitoring your devices.'}
        </ThemedText>

        <ThemedView type="backgroundElement" style={[styles.form, { borderColor: theme.border }]}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={fieldStyle('email')}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocusedField('password')}
            onBlur={() => setFocusedField(null)}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            style={fieldStyle('password')}
          />

          {error && (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !email || !password}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.accent,
                opacity: submitting || !email || !password ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: BUTTON_LABEL_COLOR[scheme] }}>
              {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => {
              setError(null);
              setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
            }}
            style={styles.switchModeButton}>
            <ThemedText type="link" themeColor="textSecondary">
              {mode === 'sign-in' ? "Don't have an account? " : 'Already have an account? '}
              <ThemedText type="linkPrimary">{mode === 'sign-in' ? 'Sign up' : 'Sign in'}</ThemedText>
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  eyebrow: {
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.five,
  },
  form: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  input: {
    borderRadius: Radius.small,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontFamily: Fonts.sans,
    fontSize: 15,
  },
  button: {
    borderRadius: Radius.small,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  switchModeButton: {
    alignItems: 'center',
    marginTop: Spacing.one,
  },
});
