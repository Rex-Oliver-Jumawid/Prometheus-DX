import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CurrentMemberSchema } from '../../../shared/contracts/member';
import { apiFetch } from '../../lib/api';
import { getSupabaseClient } from '../../lib/supabase';
import { AuthContext, type AuthContextValue } from './auth-context';
import { storedSessionIsInvalid } from './auth-routing';

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabaseClient();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const authenticatedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!client) {
      setSession(null);
      return;
    }

    let active = true;
    let authEventVersion = 0;

    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (
        authenticatedUserId.current &&
        authenticatedUserId.current !== nextUserId
      ) {
        queryClient.clear();
      }
      authenticatedUserId.current = nextUserId;
      setSession(nextSession);
    };

    const { data: authListener } = client.auth.onAuthStateChange(
      (event, nextSession) => {
        // Bootstrap owns the initial stored session so it can verify it with
        // Supabase before protected routes trust it.
        if (event === 'INITIAL_SESSION') return;
        authEventVersion += 1;
        applySession(nextSession);
      },
    );

    void (async () => {
      const bootstrapVersion = authEventVersion;
      const {
        data: { session: storedSession },
      } = await client.auth.getSession();

      if (!active || authEventVersion !== bootstrapVersion) return;
      if (!storedSession) {
        applySession(null);
        return;
      }

      const {
        data: { user },
        error,
      } = await client.auth.getUser(storedSession.access_token);

      if (!active || authEventVersion !== bootstrapVersion) return;

      if (
        storedSessionIsInvalid({
          hasUser: Boolean(user),
          hasError: Boolean(error),
          errorStatus: error?.status,
        })
      ) {
        queryClient.clear();
        applySession(null);
        void client.auth.signOut({ scope: 'local' });
        return;
      }

      // A transient Auth service/network failure should not silently sign a
      // valid user out. Keep the stored session and let /me determine whether
      // workspace access can be verified.
      applySession(storedSession);
    })();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
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
      queryClient.clear();
      setSession(null);
      if (client) await client.auth.signOut({ scope: 'local' });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
