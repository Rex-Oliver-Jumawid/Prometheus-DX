import { queryOptions } from '@tanstack/react-query';
import { HomeDashboardResponseSchema } from '../../../shared/contracts/home';
import { apiFetch } from '../../lib/api';

export const homeKeys = {
  all: ['home'] as const,
  dashboard: ['home', 'dashboard'] as const,
};

export function homeDashboardQuery(accessToken?: string) {
  return queryOptions({
    queryKey: homeKeys.dashboard,
    queryFn: () =>
      apiFetch('/home', HomeDashboardResponseSchema, { accessToken }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}
