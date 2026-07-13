import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InviteAdminCard } from '@/components/invite-admin-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useOrganization } from '@/hooks/use-organization';
import { useTeam } from '@/hooks/use-team';
import { useTheme } from '@/hooks/use-theme';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TeamScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { organization } = useOrganization();
  const { members, invitations, loading, error, refetch, removeMember, revokeInvitation } = useTeam(
    organization?.id ?? null
  );
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRemove(membershipId: string) {
    setBusy(true);
    setActionError(null);
    const { error: removeError } = await removeMember(membershipId);
    setActionError(removeError);
    setConfirmingRemoval(null);
    setBusy(false);
  }

  async function handleRevoke(invitationId: string) {
    setBusy(true);
    setActionError(null);
    const { error: revokeError } = await revokeInvitation(invitationId);
    setActionError(revokeError);
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <ThemedText type="code" themeColor="accent" style={styles.eyebrow}>
              MONITORIX
            </ThemedText>
            <ThemedText type="subtitle">Team — {organization?.name}</ThemedText>
          </View>
          <Link href="/" asChild>
            <Pressable>
              <ThemedText type="link" themeColor="textSecondary">
                ← Dashboard
              </ThemedText>
            </Pressable>
          </Link>
        </View>

        {(error || actionError) && (
          <ThemedText themeColor="danger" type="small">
            {actionError ?? error}
          </ThemedText>
        )}

        {loading ? (
          <ActivityIndicator color={theme.accent} style={styles.loader} />
        ) : (
          <FlatList
            style={styles.list}
            data={members}
            keyExtractor={(item) => item.membership_id}
            ListHeaderComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                MEMBERS ({members.length})
              </ThemedText>
            }
            renderItem={({ item }) => {
              const isSelf = item.user_id === session?.user.id;
              const confirming = confirmingRemoval === item.membership_id;
              return (
                <ThemedView
                  type="backgroundElement"
                  style={[styles.row, { borderColor: theme.border }]}>
                  <View style={styles.rowText}>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {item.email}
                      {isSelf ? '  (you)' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.role} · since {formatDate(item.created_at)}
                    </ThemedText>
                  </View>
                  {confirming ? (
                    <View style={styles.confirmGroup}>
                      <Pressable onPress={() => setConfirmingRemoval(null)} disabled={busy}>
                        <ThemedText type="link" themeColor="textSecondary">
                          Cancel
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handleRemove(item.membership_id)} disabled={busy}>
                        <ThemedText type="linkPrimary" themeColor="danger">
                          {busy ? 'Removing…' : 'Confirm'}
                        </ThemedText>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => setConfirmingRemoval(item.membership_id)}>
                      <ThemedText type="link" themeColor="danger">
                        Remove
                      </ThemedText>
                    </Pressable>
                  )}
                </ThemedView>
              );
            }}
            ListFooterComponent={
              <View style={styles.invitationsSection}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                  PENDING INVITATIONS ({invitations.length})
                </ThemedText>
                {invitations.map((invitation) => (
                  <ThemedView
                    key={invitation.id}
                    type="backgroundElement"
                    style={[styles.row, { borderColor: theme.border }]}>
                    <View style={styles.rowText}>
                      <ThemedText type="code" numberOfLines={1} selectable>
                        {invitation.code}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {invitation.role} · expires {formatDate(invitation.expires_at)}
                      </ThemedText>
                    </View>
                    <Pressable onPress={() => handleRevoke(invitation.id)} disabled={busy}>
                      <ThemedText type="link" themeColor="danger">
                        Revoke
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ))}
                {invitations.length === 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    No pending invitations.
                  </ThemedText>
                )}
                <View style={styles.inviteCardSlot}>
                  {organization && (
                    <InviteAdminCard organizationId={organization.id} onCreated={refetch} />
                  )}
                </View>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.three,
  },
  eyebrow: {
    letterSpacing: 2,
    marginBottom: Spacing.half,
  },
  loader: {
    marginTop: Spacing.five,
  },
  list: {
    flex: 1,
  },
  sectionLabel: {
    letterSpacing: 1.5,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  confirmGroup: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  invitationsSection: {
    marginTop: Spacing.four,
  },
  inviteCardSlot: {
    marginTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
});
