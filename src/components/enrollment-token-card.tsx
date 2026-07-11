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
  const { token, loading, generateToken, revokeToken } = useEnrollmentToken(organizationId);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleCopy() {
    if (!token) return;
    await Clipboard.setStringAsync(token.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleGenerate() {
    setBusy(true);
    setActionError(null);
    const { error } = await generateToken();
    setActionError(error);
    setBusy(false);
  }

  async function handleRevoke() {
    setBusy(true);
    setActionError(null);
    const { error } = await revokeToken();
    setActionError(error);
    setConfirmingRevoke(false);
    setBusy(false);
  }

  if (loading) return null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">Enrollment token</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Paste this into the agent&apos;s .env file (ENROLLMENT_TOKEN) on every PC you deploy.
      </ThemedText>

      {token ? (
        <>
          <View style={styles.tokenRow}>
            <ThemedText type="code" numberOfLines={1} style={styles.tokenText}>
              {token.token}
            </ThemedText>
            <Pressable onPress={handleCopy}>
              <ThemedText type="linkPrimary">{copied ? 'Copied!' : 'Copy'}</ThemedText>
            </Pressable>
          </View>

          {confirmingRevoke ? (
            <View style={styles.confirmRow}>
              <ThemedText type="small" themeColor="danger" style={styles.confirmText}>
                Agents using this token will stop reporting until you deploy a new one.
              </ThemedText>
              <Pressable onPress={() => setConfirmingRevoke(false)} disabled={busy}>
                <ThemedText type="link" themeColor="textSecondary">
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleRevoke} disabled={busy}>
                <ThemedText type="linkPrimary" themeColor="danger">
                  {busy ? 'Revoking…' : 'Revoke'}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmingRevoke(true)}>
              <ThemedText type="link" themeColor="danger">
                Revoke token…
              </ThemedText>
            </Pressable>
          )}
        </>
      ) : (
        <Pressable onPress={handleGenerate} disabled={busy}>
          <ThemedText type="linkPrimary">{busy ? 'Generating…' : 'Generate token'}</ThemedText>
        </Pressable>
      )}

      {actionError && (
        <ThemedText themeColor="danger" type="small">
          {actionError}
        </ThemedText>
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
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  confirmText: {
    flex: 1,
  },
});
