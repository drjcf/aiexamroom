import { routeBase } from './config';
import type { ModuleNavTab } from './ui/ModuleNav';

/**
 * Build an LMS route from the configured base. `sub` should start with '/'
 * (or be empty for the dashboard root). Reads `routeBase` at call time, so
 * paths reflect whatever `configureLms({ routeBase })` set.
 */
export function lmsRoute(sub = ''): string {
  return `${routeBase}${sub}`;
}

/** Shared module-nav tabs, built at render time from the configured base. */
export function lmsTabs(): ModuleNavTab[] {
  return [
    { label: 'Dashboard', href: lmsRoute(), exact: true },
    { label: 'Courses', href: lmsRoute('/courses') },
    { label: 'Learning Paths', href: lmsRoute('/curricula') },
    { label: 'My Learning', href: lmsRoute('/my-learning') },
    { label: 'Certificates', href: lmsRoute('/certificates') },
    { label: 'Reports', href: lmsRoute('/reports') },
  ];
}
