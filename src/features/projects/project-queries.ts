import { queryOptions } from '@tanstack/react-query';
import {
  ProjectCreateOptionsResponseSchema,
  ProjectDetailResponseSchema,
  ProjectListResponseSchema,
} from '../../../shared/contracts/project';
import { ProjectWorkflowResponseSchema } from '../../../shared/contracts/project-workflow';
import { apiFetch } from '../../lib/api';

export const projectKeys = {
  all: ['projects'] as const,
  list: ['projects', 'list'] as const,
  detail: (projectId: string) => ['projects', 'detail', projectId] as const,
  workflow: (projectId: string) => ['projects', 'workflow', projectId] as const,
  createOptions: ['projects', 'create-options'] as const,
};

export const projectStaleTimes = {
  list: 30_000,
  detail: 30_000,
  workflow: 15_000,
  createOptions: 5 * 60_000,
} as const;

export function projectsListQuery(accessToken?: string) {
  return queryOptions({
    queryKey: projectKeys.list,
    queryFn: () =>
      apiFetch('/projects', ProjectListResponseSchema, { accessToken }),
    staleTime: projectStaleTimes.list,
  });
}

export function projectDetailQuery(projectId: string, accessToken?: string) {
  return queryOptions({
    queryKey: projectKeys.detail(projectId),
    queryFn: () =>
      apiFetch(`/projects/${projectId}`, ProjectDetailResponseSchema, {
        accessToken,
      }),
    staleTime: projectStaleTimes.detail,
  });
}

export function projectWorkflowQuery(projectId: string, accessToken?: string) {
  return queryOptions({
    queryKey: projectKeys.workflow(projectId),
    queryFn: () =>
      apiFetch(
        `/projects/${projectId}/workflow`,
        ProjectWorkflowResponseSchema,
        {
          accessToken,
        },
      ),
    staleTime: projectStaleTimes.workflow,
  });
}

export function projectCreateOptionsQuery(accessToken?: string) {
  return queryOptions({
    queryKey: projectKeys.createOptions,
    queryFn: () =>
      apiFetch('/projects/create-options', ProjectCreateOptionsResponseSchema, {
        accessToken,
      }),
    staleTime: projectStaleTimes.createOptions,
  });
}
