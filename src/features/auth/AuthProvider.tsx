import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';
import { CurrentMemberSchema } from '../../../shared/contracts/member';
import { apiFetch } from '../../lib/api';
import { getSupabaseClient } from '../../lib/supabase';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!client) {
      setSession(null);
      return;
    }

    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) queryClient.removeQueries({ queryKey: ['current-member'] });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client, queryClient]);

  const memberQuery = useQuery({
    queryKey: ['current-member', session?.user.id],
    enabled: Boolean(session),
    queryFn: ({ signal }) =>
      apiFetch('/me', CurrentMemberSchema, {
        accessToken: session?.access_token,
        signal,
      }),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const value: AuthContextValue = {
    session,
    member: memberQuery.data,
    memberPending: Boolean(session) && memberQuery.isPending,
    memberError: memberQuery.error,
    retryAuthorization: () => void memberQuery.refetch(),
    signOut: async () => {
      queryClient.removeQueries({ queryKey: ['current-member'] });
      setSession(null);
      if (client) await client.auth.signOut({ scope: 'local' });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
