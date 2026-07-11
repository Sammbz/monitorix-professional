import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type CreatedInvitation = { code: string; expires_at: string };

export function InviteAdminCard({ organizationId }: { organizationId: string }) {
  const theme = useTheme();
  const { session } = useAuth();
  const [invitation, setInvitation] = useState<CreatedInvitation | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!session) return;
    setBusy(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('invitations')
      .insert({ organization_id: organizationId, role: 'admin', created_by: session.user.id })
      .select('code, expires_at')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not create an invitation');
    } else {
      setInvitation(data);
    }
    setBusy(false);
  }

  async function handleCopy() {
    if (!invitation) return;
    await Clipboard.setStringAsync(invitation.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText type="smallBold">Invite an admin</ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Create a single-use code (valid 7 days). The invitee signs up, then joins with it.
      </ThemedText>

      {invitation ? (
        <View style={styles.codeRow}>
          <ThemedText type="code" numberOfLines={1} style={styles.codeText} selectable>
            {invitation.code}
          </ThemedText>
          <Pressable onPress={handleCopy}>
            <ThemedText type="linkPrimary">{copied ? 'Copied!' : 'Copy'}</ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={handleCreate} disabled={busy}>
          <ThemedText type="linkPrimary">{busy ? 'Creating…' : 'Create invite code'}</ThemedText>
        </Pressable>
      )}

      {error && (
        <ThemedText themeColor="danger" type="small">
          {error}
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
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  codeText: {
    flex: 1,
  },
});
