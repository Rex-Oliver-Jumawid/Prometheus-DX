import type { Member } from '@prisma/client';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  currentMember?: Member;
}
