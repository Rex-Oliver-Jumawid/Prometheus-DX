import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ProjectMemberSchema,
  ProjectMembersResponseSchema,
  UpdateProjectMemberAccessRequestSchema,
  type ProjectMember,
} from '../../../shared/contracts/project-workflow';
import type { ProjectAccessLevel } from '../../../shared/contracts/project';
import { apiFetch } from '../../lib/api';

const membersKey = (projectId: string) =>
  ['projects', 'members', projectId] as const;

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}

export function ProjectMembersPanel({
  projectId,
  accessToken,
}: {
  projectId: string;
  accessToken?: string;
}) {
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: membersKey(projectId),
    queryFn: () =>
      apiFetch(`/projects/${projectId}/members`, ProjectMembersResponseSchema, {
        accessToken,
      }),
    retry: false,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
  const updateAccess = useMutation({
    mutationFn: ({
      memberId,
      accessLevel,
    }: {
      memberId: string;
      accessLevel: ProjectAccessLevel;
    }) =>
      apiFetch(
        `/projects/${projectId}/members/${memberId}/access`,
        ProjectMemberSchema,
        {
          accessToken,
          method: 'PATCH',
          body: UpdateProjectMemberAccessRequestSchema.parse({ accessLevel }),
        },
      ),
    onSuccess: (updated: ProjectMember) => {
      queryClient.setQueryData(
        membersKey(projectId),
        (current: typeof members.data) =>
          current
            ? {
                ...current,
                members: current.members.map((item) =>
                  item.member.id === updated.member.id ? updated : item,
                ),
              }
            : current,
      );
    },
  });

  return (
    <section
      className="project-members-panel"
      aria-labelledby="project-members-title"
    >
      <div className="project-members-heading">
        <div>
          <p className="projects-kicker">PROJECT PARTICIPATION</p>
          <h2 id="project-members-title">Project Members</h2>
          <p>
            Membership is derived from permanent Outcome Membership. Access
            controls only the canonical project-level editable actions.
          </p>
        </div>
      </div>
      {members.isPending ? (
        <div className="project-members-loading" role="status">
          Loading Project Members...
        </div>
      ) : members.isError || !members.data ? (
        <div className="projects-state-card" role="alert">
          <strong>Project Members could not be loaded.</strong>
          <p>{errorMessage(members.error)}</p>
          <button
            type="button"
            className="projects-secondary-button"
            onClick={() => void members.refetch()}
          >
            Retry
          </button>
        </div>
      ) : members.data.members.length === 0 ? (
        <div className="projects-state-card">
          <strong>No Project Members yet</strong>
          <p>Members appear here after joining their first Outcome.</p>
        </div>
      ) : (
        <div className="project-members-list">
          {members.data.members.map((item) => {
            const isUpdating =
              updateAccess.isPending &&
              updateAccess.variables?.memberId === item.member.id;
            return (
              <article className="project-member-row" key={item.member.id}>
                <div className="project-member-identity">
                  <span aria-hidden="true">
                    {item.member.fullName
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <div>
                    <h3>{item.member.fullName}</h3>
                    <p>{item.member.email}</p>
                  </div>
                </div>
                <div className="project-member-outcomes">
                  <span>Joined Outcomes</span>
                  <p>
                    {item.outcomes.length
                      ? item.outcomes.map(({ title }) => title).join(', ')
                      : 'Membership source unavailable'}
                  </p>
                </div>
                {members.data.canManageAccess ? (
                  <label className="project-member-access">
                    <span>Project access</span>
                    <select
                      aria-label={`Project access for ${item.member.fullName}`}
                      value={item.accessLevel}
                      disabled={isUpdating}
                      onChange={(event) =>
                        void updateAccess.mutateAsync({
                          memberId: item.member.id,
                          accessLevel: event.target.value as ProjectAccessLevel,
                        })
                      }
                    >
                      <option value="CAN_VIEW">CAN_VIEW</option>
                      <option value="CAN_EDIT">CAN_EDIT</option>
                    </select>
                  </label>
                ) : (
                  <div className="project-member-access">
                    <span>Project access</span>
                    <strong>{item.accessLevel}</strong>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {updateAccess.isError && (
        <p className="project-status-error" role="alert">
          {errorMessage(updateAccess.error)}
        </p>
      )}
    </section>
  );
}
