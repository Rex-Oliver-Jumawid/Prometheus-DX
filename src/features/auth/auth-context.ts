import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { CurrentMember } from '../../../shared/contracts/member';

export interface AuthContextValue {
  session: Session | null | undefined;
  member: CurrentMember | undefined;
  memberPending: boolean;
  memberError: Error | null;
  retryAuthorization: () => void;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
