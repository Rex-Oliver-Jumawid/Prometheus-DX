import { describe, expect, it } from 'vitest';
import { breadcrumbsForPath, utilityNavigationForRole } from './navigation';

describe('shell navigation', () => {
  it('shows Registry only to Administrators', () => {
    expect(
      utilityNavigationForRole('ADMINISTRATOR').map((item) => item.label),
    ).toContain('Registry');
    expect(
      utilityNavigationForRole('MEMBER').map((item) => item.label),
    ).not.toContain('Registry');
  });

  it('only creates breadcrumbs for deeper routes', () => {
    expect(breadcrumbsForPath('/projects')).toEqual([]);
    expect(breadcrumbsForPath('/projects/example-project')).toEqual([
      'Projects',
      'Example project',
    ]);
  });
});
