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
