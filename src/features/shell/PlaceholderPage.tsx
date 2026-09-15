const descriptions: Record<string, string> = {
  Home: 'Your command center will be connected to real project and work data in Phase 7.',
  Projects: 'Project discovery and creation belong to Phase 3.',
  VisiWork: 'Management visibility and reporting belong to Phase 8.',
  Schedule: 'Schedules and work sessions belong to Phase 6.',
  Team: 'Team availability and work activity belong to Phase 6.',
  Notifications: 'The notification inbox and event delivery belong to Phase 7.',
  Registry: 'Member and department administration begins in Phase 2.',
};

export function PlaceholderPage({ title }: { title: keyof typeof descriptions }) {
  return (
    <section className="placeholder-page" aria-labelledby="page-title"><p className="page-kicker">PROMETHEUS WORKSPACE</p><h1 id="page-title">{title}</h1><div className="placeholder-card"><span aria-hidden="true">{title.slice(0, 1)}</span><div><h2>{title} is ready for its next phase</h2><p>{descriptions[title]}</p><small>The authenticated shell is active; no sample business data is shown.</small></div></div></section>
  );
}
