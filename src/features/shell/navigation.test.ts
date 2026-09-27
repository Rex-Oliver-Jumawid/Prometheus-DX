import { describe, expect, it } from 'vitest';
import {
  breadcrumbsForPath,
  navigationForRole,
  utilityNavigationForRole,
} from './navigation';

describe('shell navigation', () => {
  it('shows Registry only to Administrators', () => {
    expect(
      utilityNavigationForRole('ADMINISTRATOR').map((item) => item.label),
    ).toContain('Registry');
    expect(
      utilityNavigationForRole('MEMBER').map((item) => item.label),
    ).not.toContain('Registry');
  });

  it('keeps the signed-in Home dashboard separate from the public landing route', () => {
    expect(navigationForRole('MEMBER').find((item) => item.label === 'Home')?.path).toBe('/workspace');
  });

  it('keeps VisiWork and Reports & Analytics as separate primary destinations', () => {
    const navigation = navigationForRole('MEMBER');

    expect(navigation.find((item) => item.label === 'VisiWork')).toMatchObject({
      path: '/visiwork',
    });
    expect(
      navigation.find((item) => item.label === 'Reports & Analytics'),
    ).toMatchObject({ path: '/reports' });
  });

  it('only creates breadcrumbs for deeper routes', () => {
    expect(breadcrumbsForPath('/projects')).toEqual([]);
    expect(breadcrumbsForPath('/projects/example-project')).toEqual([
      'Projects',
      'Example project',
    ]);
  });
});
