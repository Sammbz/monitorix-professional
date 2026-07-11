import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Organization } from '@/types/monitoring';

type OrganizationContextValue = {
  organization: Organization | null;
  loading: boolean;
  error: string | null;
  createOrganization: (name: string) => Promise<{ error: string | null }>;
  joinOrganization: (code: string) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('memberships')
      .select('organizations(id, name, created_at)')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      setError(queryError.message);
      setOrganization(null);
    } else {
      setError(null);
      setOrganization((data?.organizations as unknown as Organization) ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) {
      setOrganization(null);
      setLoading(false);
      return;
    }
    refetch();
  }, [session, refetch]);

  const createOrganization = useCallback(
    async (name: string): Promise<{ error: string | null }> => {
      if (!session) return { error: 'Not signed in' };

      const { data, error: rpcError } = await supabase.rpc('create_organization', { p_name: name });

      if (rpcError || !data) {
        return { error: rpcError?.message ?? 'Could not create organization' };
      }

      setOrganization(data as Organization);
      return { error: null };
    },
    [session]
  );

  const joinOrganization = useCallback(
    async (code: string): Promise<{ error: string | null }> => {
      if (!session) return { error: 'Not signed in' };

      const { data, error: rpcError } = await supabase.rpc('accept_invitation', { p_code: code.trim() });

      if (rpcError || !data) {
        return { error: rpcError?.message ?? 'Could not join the organization' };
      }

      setOrganization(data as Organization);
      return { error: null };
    },
    [session]
  );

  const value = useMemo<OrganizationContextValue>(
    () => ({ organization, loading, error, createOrganization, joinOrganization, refetch }),
    [organization, loading, error, createOrganization, joinOrganization, refetch]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return ctx;
}
