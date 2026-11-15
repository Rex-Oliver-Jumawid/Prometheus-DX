import { queryOptions } from '@tanstack/react-query';
import { VentureListSchema } from '../../../shared/contracts/venture';
import { apiFetch } from '../../lib/api';

export function venturesQuery(memberId?: string, accessToken?: string) {
  return queryOptions({
    queryKey: ['ventures', memberId],
    queryFn: () => apiFetch('/ventures', VentureListSchema, { accessToken }),
    staleTime: 30_000,
  });
}
