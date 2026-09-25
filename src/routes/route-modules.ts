const STALE_CHUNK_RELOAD_KEY = 'prometheus:stale-chunk-reload';

function isStaleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module')
  );
}

async function loadRoute<T>(loader: () => Promise<T>): Promise<T> {
  try {
    const module = await loader();
    sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY);
    return module;
  } catch (error) {
    if (
      isStaleChunkError(error) &&
      sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) !== '1'
    ) {
      sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1');
      window.location.reload();
      return new Promise<T>(() => undefined);
    }
    throw error;
  }
}

export function loadProjectOverviewRoute() {
  return loadRoute(() => import('../features/projects/ProjectOverviewPage')).then(
    (module) => ({ Component: module.ProjectOverviewPage }),
  );
}

export function loadRegistryRoute() {
  return loadRoute(() => import('../features/shell/RegistryGate')).then(
    (module) => ({ Component: module.RegistryGate }),
  );
}

export function loadReportsAnalyticsRoute() {
  return loadRoute(() => import('../features/reports/ReportsAnalyticsPage')).then(
    (module) => ({ Component: module.ReportsAnalyticsPage }),
  );
}

export function loadScheduleRoute() {
  return loadRoute(() => import('../features/schedule/SchedulePage')).then(
    (module) => ({ Component: module.SchedulePage }),
  );
}

export function loadTeamRoute() {
  return loadRoute(() => import('../features/team/TeamPage')).then((module) => ({
    Component: module.TeamPage,
  }));
}

export function loadVisiWorkRoute() {
  return loadRoute(() => import('../features/visiwork/VisiWorkPage')).then(
    (module) => ({ Component: module.VisiWorkPage }),
  );
}

export function loadNotificationsRoute() {
  return loadRoute(() => import('../features/notifications/NotificationsPage')).then(
    (module) => ({ Component: module.NotificationsPage }),
  );
}
