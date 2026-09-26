import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ProjectMemberSchema,
  ProjectMembersResponseSchema,
  UpdateProjectMemberAccessRequestSchema,
  type ProjectMember,
} from '../../../shared/contracts/project-workflow';
import type { ProjectAccessLevel } from '../../../shared/contracts/project';
import { apiFetch } from '../../lib/api';
import { MemberAvatar } from '../shell/MemberAvatar';

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
  compact = false,
  projectLead,
}: {
  projectId: string;
  accessToken?: string;
  compact?: boolean;
  projectLead?: { id: string; fullName: string; email: string; profileImagePath?: string | null };
}) {
  const queryClient = useQueryClient();
  const members = useQuery({
    queryKey: membersKey(projectId),
    queryFn: () =>
      apiFetch(`/projects/${projectId}/members`, ProjectMembersResponseSchema, {
        accessToken,
      }),
    retry: false,
    staleTime: 60_000,
    gcTime: 15 * 60_000,
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
    onMutate: async ({ memberId, accessLevel }) => {
      const queryKey = membersKey(projectId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (current: typeof members.data) =>
        current
          ? {
              ...current,
              members: current.members.map((item) =>
                item.member.id === memberId ? { ...item, accessLevel } : item,
              ),
            }
          : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(membersKey(projectId), context.previous);
      }
    },
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
      className={`project-members-panel${compact ? ' pw-chat-members' : ''}`}
      aria-labelledby="project-members-title"
    >
      <div className="project-members-heading">
        <div>
          {!compact && <p className="projects-kicker">PROJECT PARTICIPATION</p>}
          <h2 id="project-members-title">Project Members</h2>
          <p>
            {compact
              ? 'Members default to View only for project structure.'
              : 'Membership is derived from permanent Outcome Membership. Access controls only the canonical project-level editable actions.'}
          </p>
        </div>
      </div>
      {compact && projectLead && (
        <div className="pw-chat-lead-row">
          <MemberAvatar name={projectLead.fullName} profileImagePath={projectLead.profileImagePath} className="pw-chat-member-avatar" />
          <div className="pw-chat-member-identity"><strong>{projectLead.fullName}</strong><small>Project Lead</small></div>
          <span className="pw-chat-member-role">Project Lead</span>
        </div>
      )}
      {members.isPending ? (
        <div className="pw-members-skeleton" role="status" aria-label="Loading Project Members">
          <span className="sr-only">Loading Project Members...</span>
          {[0, 1, 2].map((index) => (
            <div className="pw-members-skeleton-row" key={index} aria-hidden="true">
              <span className="pw-chat-skeleton-line pw-chat-skeleton-avatar" />
              <div className="pw-members-skeleton-copy">
                <span className="pw-chat-skeleton-line" />
                <span className="pw-chat-skeleton-line" />
              </div>
              <span className="pw-chat-skeleton-line pw-chat-skeleton-pill" />
            </div>
          ))}
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
      ) : members.data.members.filter((item) => item.member.id !== projectLead?.id).length === 0 ? (
        compact && projectLead ? null : (
          <div className="projects-state-card">
            <strong>No Project Members yet</strong>
            <p>Members appear here after joining their first Outcome.</p>
          </div>
        )
      ) : (
        <div className="project-members-list">
          {members.data.members.filter((item) => item.member.id !== projectLead?.id).map((item) => {
            const isUpdating =
              updateAccess.isPending &&
              updateAccess.variables?.memberId === item.member.id;
            return (
              <article className="project-member-row" key={item.member.id}>
                <div className="project-member-identity">
                  <MemberAvatar name={item.member.fullName} profileImagePath={item.member.profileImagePath} />
                  <div>
                    <h3>{item.member.fullName}</h3>
                    <p>{item.member.email}</p>
                  </div>
                </div>
                {!compact && <div className="project-member-outcomes">
                  <span>Joined Outcomes</span>
                  <p>
                    {item.outcomes.length
                      ? item.outcomes.map(({ title }) => title).join(', ')
                      : 'Membership source unavailable'}
                  </p>
                </div>}
                {members.data.canManageAccess ? (
                  <label className="project-member-access">
                    <span>{compact ? 'Access' : 'Project access'}</span>
                    <select
                      aria-label={`Project access for ${item.member.fullName}`}
                      value={item.accessLevel}
                      disabled={isUpdating}
                      onChange={(event) =>
                        updateAccess.mutate({
                          memberId: item.member.id,
                          accessLevel: event.target.value as ProjectAccessLevel,
                        })
                      }
                    >
                      <option value="CAN_VIEW">{compact ? 'View only' : 'CAN_VIEW'}</option>
                      <option value="CAN_EDIT">{compact ? 'Can edit' : 'CAN_EDIT'}</option>
                    </select>
                  </label>
                ) : (
                  <div className="project-member-access">
                    <span>Project access</span>
                    <strong>{compact ? (item.accessLevel === 'CAN_VIEW' ? 'View only' : 'Can edit') : item.accessLevel}</strong>
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
