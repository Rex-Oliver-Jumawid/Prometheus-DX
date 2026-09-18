export function loadProjectOverviewRoute() {
  return import('../features/projects/ProjectOverviewPage').then((module) => ({
    Component: module.ProjectOverviewPage,
  }));
}

export function loadRegistryRoute() {
  return import('../features/shell/RegistryGate').then((module) => ({
    Component: module.RegistryGate,
  }));
}

export function loadScheduleRoute() {
  return import('../features/schedule/SchedulePage').then((module) => ({
    Component: module.SchedulePage,
  }));
}

export function loadTeamRoute() {
  return import('../features/team/TeamPage').then((module) => ({
    Component: module.TeamPage,
  }));
}
