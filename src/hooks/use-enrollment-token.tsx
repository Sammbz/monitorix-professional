import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { EnrollmentToken } from '@/types/monitoring';

export function useEnrollmentToken(organizationId: string | null) {
  const [token, setToken] = useState<EnrollmentToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!organizationId) {
      setToken(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('enrollment_tokens')
      .select('id, organization_id, token, revoked, created_at')
      .eq('organization_id', organizationId)
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
    } else {
      setError(null);
      setToken(data);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const generateToken = useCallback(async (): Promise<{ error: string | null }> => {
    if (!organizationId) return { error: 'No organization' };

    const { data, error: insertError } = await supabase
      .from('enrollment_tokens')
      .insert({ organization_id: organizationId })
      .select('id, organization_id, token, revoked, created_at')
      .single();

    if (insertError || !data) {
      return { error: insertError?.message ?? 'Could not generate a token' };
    }

    setToken(data);
    return { error: null };
  }, [organizationId]);

  const revokeToken = useCallback(async (): Promise<{ error: string | null }> => {
    if (!token) return { error: 'No active token' };

    const { error: updateError } = await supabase
      .from('enrollment_tokens')
      .update({ revoked: true })
      .eq('id', token.id);

    if (updateError) {
      return { error: updateError.message };
    }

    setToken(null);
    return { error: null };
  }, [token]);

  return { token, loading, error, generateToken, revokeToken, refetch };
}
