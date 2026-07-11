import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useEnrollmentToken } from '@/hooks/use-enrollment-token';
import { useTheme } from '@/hooks/use-theme';

export function EnrollmentTokenCard({ organizationId }: { organizationId: string }) {
  const theme = useTheme();
  const { token, loading, generateToken } = useEnrollmentToken(organizationId);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function handleCopy() {
    if (!token) return;
    await Clipboard.setStringAsync(token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerate() {
    setGenerating(true);
    await generateToken();
    setGenerating(false);
  }

  if (loading) return null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">Enrollment token</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Paste this into the agent&apos;s .env file (ENROLLMENT_TOKEN) on every PC you deploy.
      </ThemedText>

      {token ? (
        <View style={styles.tokenRow}>
          <ThemedText type="code" numberOfLines={1} style={styles.tokenText}>
            {token.token}
          </ThemedText>
          <Pressable onPress={handleCopy}>
            <ThemedText type="linkPrimary">{copied ? 'Copied!' : 'Copy'}</ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={handleGenerate} disabled={generating}>
          <ThemedText type="linkPrimary">{generating ? 'Generating…' : 'Generate token'}</ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  tokenText: {
    flex: 1,
  },
});
