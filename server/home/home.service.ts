import { Inject, Injectable } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type {
  HomeAttentionItem,
  HomeDashboardResponse,
  HomeProject,
} from '../../shared/contracts/home';
import { WORKSPACE_TIMEZONE } from '../../shared/contracts/work-session';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';

@Injectable()
export class HomeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProjectsService) private readonly projectsService: ProjectsService,
    @Inject(WorkSessionsService)
    private readonly workSessionsService: WorkSessionsService,
  ) {}

  async getDashboard(member: Member): Promise<HomeDashboardResponse> {
    const now = new Date();

    await this.workSessionsService.refreshStaleSessions(now);

    const [
      projects,
      history,
      schedule,
      activeSessions,
      reviewOutcomes,
      revisionOutcomes,
    ] = await Promise.all([
      this.projectsService.listProjects(member),
      this.workSessionsService.getHistory(member),
      this.prisma.memberSchedule.findUnique({
        where: { memberId: member.id },
        select: { targetWeeklyMinutes: true },
      }),
      this.prisma.workSession.findMany({
        where: {
          status: 'OPEN',
          timeOut: null,
          member: { status: 'ACTIVE' },
        },
        select: {
          timeIn: true,
          member: {
            select: {
              id: true,
              fullName: true,
              department: {
                select: { id: true, name: true, shortLabel: true },
              },
            },
          },
        },
        orderBy: [{ timeIn: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.outcome.findMany({
        where: {
          lifecycleStatus: { not: 'ACCEPTED' },
          stage: { project: { leadMemberId: member.id } },
          submissions: { some: { reviewStatus: 'FOR_REVIEW' } },
        },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          stage: {
            select: {
              name: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.outcome.findMany({
        where: {
          lifecycleStatus: 'NEEDS_REVISION',
          members: { some: { memberId: member.id } },
          revisionRequests: { some: { resolvedAt: null } },
        },
        select: {
          id: true,
          title: true,
          stage: {
            select: {
              name: true,
              project: { select: { id: true, name: true } },
            },
          },
          revisionRequests: {
            where: { resolvedAt: null },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: { id: true, message: true, createdAt: true },
          },
        },
      }),
    ]);

    const leading: HomeProject[] = [];
    const participating: HomeProject[] = [];

    for (const project of projects) {
      const relationship =
        project.lead.id === member.id
          ? ('LEAD' as const)
          : project.isParticipating
            ? ('PARTICIPANT' as const)
            : null;

      if (!relationship) continue;

      const item: HomeProject = {
        id: project.id,
        name: project.name,
        status: project.status,
        progressPercentage: project.metrics?.progressPercentage ?? 0,
        relationship,
        accessLevel: project.currentMemberAccess,
      };

      if (relationship === 'LEAD') leading.push(item);
      else participating.push(item);
    }

    const workingByMember = new Map(
      activeSessions.map(({ member: activeMember }) => [
        activeMember.id,
        activeMember,
      ]),
    );
    const workingNow = [...workingByMember.values()];

    const attention = [
      ...reviewOutcomes.map((outcome) => ({
        sortAt: outcome.updatedAt.getTime(),
        item: {
          id: `review:${outcome.id}`,
          kind: 'REVIEW' as const,
          projectId: outcome.stage.project.id,
          outcomeId: outcome.id,
          title: outcome.title,
          projectName: outcome.stage.project.name,
          stageName: outcome.stage.name,
          detail: null,
        } satisfies HomeAttentionItem,
      })),
      ...revisionOutcomes.map((outcome) => {
        const request = outcome.revisionRequests[0];
        return {
          sortAt: request?.createdAt.getTime() ?? 0,
          item: {
            id: `revision:${outcome.id}`,
            kind: 'REVISION' as const,
            projectId: outcome.stage.project.id,
            outcomeId: outcome.id,
            title: outcome.title,
            projectName: outcome.stage.project.name,
            stageName: outcome.stage.name,
            detail: request?.message ?? null,
          } satisfies HomeAttentionItem,
        };
      }),
    ]
      .sort(
        (left, right) =>
          right.sortAt - left.sortAt || left.item.id.localeCompare(right.item.id),
      )
      .map(({ item }) => item);

    return {
      timezone: WORKSPACE_TIMEZONE,
      asOf: now.toISOString(),
      summary: {
        workingNow: workingNow.length,
        activeProjects: projects.filter(
          (project) =>
            project.status === 'PLANNING' || project.status === 'IN_PROGRESS',
        ).length,
        totalProjects: projects.length,
        awaitingReview: reviewOutcomes.length,
        revisionRequests: revisionOutcomes.length,
        actualWorkedSeconds: history.totalDurationSeconds,
        plannedMinutes: schedule?.targetWeeklyMinutes ?? 0,
      },
      projects: { leading, participating },
      workingNow,
      needsAttention: attention,
    };
  }
}
