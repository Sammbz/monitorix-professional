import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type TeamMember = {
  membership_id: string;
  user_id: string;
  email: string;
  role: 'admin' | 'employee';
  created_at: string;
};

export type PendingInvitation = {
  id: string;
  code: string;
  role: 'admin' | 'employee';
  expires_at: string;
  created_at: string;
};

export function useTeam(organizationId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!organizationId) {
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [membersResult, invitationsResult] = await Promise.all([
      supabase.rpc('org_members', { p_organization_id: organizationId }),
      supabase
        .from('invitations')
        .select('id, code, role, expires_at, created_at')
        .eq('organization_id', organizationId)
        .eq('revoked', false)
        .is('accepted_by', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }),
    ]);

    if (membersResult.error) {
      setError(membersResult.error.message);
    } else if (invitationsResult.error) {
      setError(invitationsResult.error.message);
    } else {
      setError(null);
      setMembers((membersResult.data as TeamMember[]) ?? []);
      setInvitations((invitationsResult.data as PendingInvitation[]) ?? []);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const removeMember = useCallback(
    async (membershipId: string): Promise<{ error: string | null }> => {
      const { error: rpcError } = await supabase.rpc('remove_member', { p_membership_id: membershipId });
      if (rpcError) return { error: rpcError.message };
      await refetch();
      return { error: null };
    },
    [refetch]
  );

  const revokeInvitation = useCallback(
    async (invitationId: string): Promise<{ error: string | null }> => {
      const { error: updateError } = await supabase
        .from('invitations')
        .update({ revoked: true })
        .eq('id', invitationId);
      if (updateError) return { error: updateError.message };
      await refetch();
      return { error: null };
    },
    [refetch]
  );

  return { members, invitations, loading, error, refetch, removeMember, revokeInvitation };
}
