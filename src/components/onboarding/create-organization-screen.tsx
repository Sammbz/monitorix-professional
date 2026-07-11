import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useOrganization } from '@/hooks/use-organization';
import { useTheme } from '@/hooks/use-theme';

// The accent color flips lightness between themes (bright teal on dark,
// deep teal on light), so button text needs to flip with it for contrast.
const BUTTON_LABEL_COLOR = { light: '#F5FFFE', dark: '#04201C' } as const;

export function CreateOrganizationScreen() {
  const { signOut } = useAuth();
  const { createOrganization, joinOrganization } = useOrganization();
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [focused, setFocused] = useState<'name' | 'code' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const { error: createError } = await createOrganization(name.trim());
    setSubmitting(false);
    if (createError) {
      setError(createError);
    }
  }

  async function handleJoin() {
    setError(null);
    setSubmitting(true);
    const { error: joinError } = await joinOrganization(inviteCode);
    setSubmitting(false);
    if (joinError) {
      setError(joinError);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="code" themeColor="accent" style={styles.eyebrow}>
          MONITORIX
        </ThemedText>
        <ThemedText type="title" style={styles.title}>
          Set up your organization
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          You&apos;ll get an enrollment token to deploy the monitoring agent across your
          company&apos;s devices.
        </ThemedText>

        <ThemedView type="backgroundElement" style={[styles.form, { borderColor: theme.border }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
            placeholder="Organization name"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            style={[styles.input, { color: theme.text, borderColor: focused === 'name' ? theme.accent : theme.border }]}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || !name.trim()}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: theme.accent,
                opacity: submitting || !name.trim() ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: BUTTON_LABEL_COLOR[scheme] }}>
              {submitting ? 'Please wait…' : 'Continue'}
            </ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textSecondary" style={styles.divider}>
            or join an existing organization
          </ThemedText>

          <TextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            onFocus={() => setFocused('code')}
            onBlur={() => setFocused(null)}
            placeholder="Invite code"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: focused === 'code' ? theme.accent : theme.border }]}
          />

          <Pressable
            onPress={handleJoin}
            disabled={submitting || !inviteCode.trim()}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              {
                borderColor: theme.accent,
                opacity: submitting || !inviteCode.trim() ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText type="smallBold" themeColor="accent">
              {submitting ? 'Please wait…' : 'Join with code'}
            </ThemedText>
          </Pressable>

          {error && (
            <ThemedText themeColor="danger" type="small">
              {error}
            </ThemedText>
          )}

          <Pressable onPress={signOut} style={styles.signOutButton}>
            <ThemedText type="link" themeColor="textSecondary">
              Sign out
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  divider: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  signOutButton: {
    alignItems: 'center',
    marginTop: Spacing.one,
  },
});
