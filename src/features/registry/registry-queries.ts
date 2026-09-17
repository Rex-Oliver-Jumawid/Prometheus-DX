import { queryOptions } from '@tanstack/react-query';
import { RegistryOverviewResponseSchema } from '../../../shared/contracts/registry';
import { apiFetch } from '../../lib/api';

export const registryOverviewQueryKey = ['registry', 'overview'] as const;

export function registryOverviewQuery(accessToken?: string) {
  return queryOptions({
    queryKey: registryOverviewQueryKey,
    queryFn: () =>
      apiFetch('/registry', RegistryOverviewResponseSchema, { accessToken }),
    staleTime: 60_000,
  });
}
