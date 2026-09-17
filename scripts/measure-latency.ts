import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { PrismaClient, type ProjectStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { AuthService } from '../server/auth/auth.service';
import type { PrismaService } from '../server/database/prisma.service';
import { ProjectsService } from '../server/projects/projects.service';
import { ProjectWorkflowService } from '../server/projects/project-workflow.service';
import type { InvitationDelivery } from '../server/registry/invitation.service';
import { RegistryService } from '../server/registry/registry.service';
import type {
  Project,
  ProjectCreateOptionsResponse,
} from '../shared/contracts/project';

const requiredEnvironment = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'E2E_MEMBER_EMAIL',
  'E2E_MEMBER_PASSWORD',
] as const;

for (const key of requiredEnvironment) {
  if (!process.env[key]) throw new Error(`Missing ${key}.`);
}

const apiBaseUrl = process.env.PERF_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
const iterations = Number(process.env.PERF_ITERATIONS ?? 5);
const includePatch = process.env.PERF_INCLUDE_PATCH === '1';

if (process.env.PERF_DATABASE_MODE === 'session' && process.env.DATABASE_URL) {
  const sessionUrl = new URL(process.env.DATABASE_URL);
  sessionUrl.port = '5432';
  sessionUrl.searchParams.delete('pgbouncer');
  process.env.DATABASE_URL = sessionUrl.toString();
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function summary(values: number[]) {
  return {
    medianMs: Number(median(values).toFixed(1)),
    minMs: Number(Math.min(...values).toFixed(1)),
    maxMs: Number(Math.max(...values).toFixed(1)),
    samplesMs: values.map((value) => Number(value.toFixed(1))),
  };
}

async function timed<T>(operation: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await operation();
  return { value, durationMs: performance.now() - startedAt };
}

async function repeat<T>(operation: () => Promise<T>) {
  const values: number[] = [];
  let lastValue: T | undefined;
  for (let index = 0; index < iterations; index += 1) {
    const result = await timed(operation);
    values.push(result.durationMs);
    lastValue = result.value;
  }
  return { timing: summary(values), lastValue: lastValue as T };
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_MEMBER_EMAIL!,
    password: process.env.E2E_MEMBER_PASSWORD!,
  });
  if (error || !data.session || !data.user) {
    throw new Error('Performance account sign-in failed.');
  }
  const accessToken = data.session.access_token;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const request = async <T>(path: string, init?: RequestInit) => {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    });
    if (!response.ok) {
      throw new Error(`${path} returned ${response.status}.`);
    }
    return (await response.json()) as T;
  };

  const projectsRequest = await repeat(() => request<Project[]>('/projects'));
  const projects = projectsRequest.lastValue;
  let measuredProject = projects.find((project) => project.canChangeStatus);
  if (!measuredProject && includePatch) {
    const options = await request<ProjectCreateOptionsResponse>(
      '/projects/create-options',
    );
    const currentLead = options.leads.find(
      (candidate) =>
        candidate.email.toLowerCase() ===
        process.env.E2E_MEMBER_EMAIL!.toLowerCase(),
    );
    const department = options.departments[0];
    if (currentLead && department) {
      measuredProject = await request<Project>('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Latency measurement ${new Date().toISOString()}`,
          description:
            'Dedicated Project for repeatable authorized status latency measurement.',
          leadMemberId: currentLead.id,
          departmentIds: [department.id],
        }),
      });
    }
  }
  measuredProject ??= projects[0];
  if (!measuredProject) throw new Error('No project is available to measure.');

  const endpoint = {
    projects: projectsRequest.timing,
    projectDetail: (
      await repeat(() => request(`/projects/${measuredProject.id}`))
    ).timing,
    workflow: (
      await repeat(() => request(`/projects/${measuredProject.id}/workflow`))
    ).timing,
    registry: await repeat(() => request('/registry')),
  };

  const patchSamples: number[] = [];
  if (measuredProject.canChangeStatus && includePatch) {
    const originalStatus = measuredProject.status;
    const alternateStatus: ProjectStatus =
      originalStatus === 'PLANNING' ? 'IN_PROGRESS' : 'PLANNING';
    for (let index = 0; index < iterations; index += 1) {
      for (const status of [alternateStatus, originalStatus]) {
        const result = await timed(() =>
          request(`/projects/${measuredProject.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }),
        );
        patchSamples.push(result.durationMs);
      }
    }
  }

  const deniedProject = projects.find(
    (project) =>
      !project.canChangeStatus && project.currentMemberAccess === 'CAN_VIEW',
  );
  let deniedStatusProbe: number | 'not-available' = 'not-available';
  if (deniedProject) {
    const deniedResponse = await fetch(
      `${apiBaseUrl}/projects/${deniedProject.id}/status`,
      {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: deniedProject.status }),
      },
    );
    deniedStatusProbe = deniedResponse.status;
  }

  const queryDurations: number[] = [];
  const prisma = new PrismaClient({
    log: [{ emit: 'event', level: 'query' }],
  });
  prisma.$on('query', (event) => queryDurations.push(event.duration));
  const prismaService = prisma as unknown as PrismaService;
  const auth = new AuthService(prismaService, supabase);
  const projectsService = new ProjectsService(prismaService);
  const workflowService = new ProjectWorkflowService(prismaService);
  const invitationDelivery: InvitationDelivery = {
    sendInvitation: async () => undefined,
  };
  const registryService = new RegistryService(
    prismaService,
    invitationDelivery,
  );

  const profile = async (operation: () => Promise<unknown>) => {
    const samples: {
      totalMs: number;
      databaseMs: number;
      queryCount: number;
    }[] = [];
    for (let index = 0; index < iterations; index += 1) {
      queryDurations.length = 0;
      const result = await timed(operation);
      samples.push({
        totalMs: result.durationMs,
        databaseMs: queryDurations.reduce((sum, value) => sum + value, 0),
        queryCount: queryDurations.length,
      });
    }
    return {
      total: summary(samples.map((sample) => sample.totalMs)),
      database: summary(samples.map((sample) => sample.databaseMs)),
      queryCounts: samples.map((sample) => sample.queryCount),
    };
  };

  const jwtVerification = await repeat(() =>
    supabase.auth.getClaims(accessToken),
  );
  const memberResolution = await profile(() =>
    auth.resolveActiveMember(accessToken),
  );
  const member = await auth.resolveActiveMember(accessToken);
  const serviceProfiles = {
    projects: await profile(() => projectsService.listProjects(member)),
    projectDetail: await profile(() =>
      projectsService.getProject(member, measuredProject.id),
    ),
    workflow: await profile(() =>
      workflowService.getWorkflow(member, measuredProject.id),
    ),
    registry: await profile(() => registryService.getOverview()),
  };

  const projectsForSerialization = await projectsService.listProjects(member);
  const serialization = await repeat(async () => {
    JSON.stringify(projectsForSerialization);
  });

  await prisma.$disconnect();
  await supabase.auth.signOut({ scope: 'local' });

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        iterations,
        target: apiBaseUrl,
        databaseMode: process.env.PERF_DATABASE_MODE ?? 'configured',
        endpoint: {
          projects: endpoint.projects,
          projectDetail: endpoint.projectDetail,
          workflow: endpoint.workflow,
          registry: endpoint.registry.timing,
          projectStatusPatch:
            patchSamples.length > 0 ? summary(patchSamples) : 'not-authorized',
          deniedStatusProbe,
        },
        breakdown: {
          jwtVerification: jwtVerification.timing,
          activeMemberResolution: memberResolution,
          serviceProfiles,
          projectsSerialization: serialization.timing,
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Measurement failed.');
  process.exitCode = 1;
});
