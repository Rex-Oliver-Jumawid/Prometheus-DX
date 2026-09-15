# Phase 0 Manual Test Cases - Foundation

## Phase Context

Phase 0 establishes the production architecture before business screens are implemented.

Canonical architecture is defined in `.context/tech-stack.md`.

The intended data path is:

```text
React
  |
  v
NestJS
  |
  v
Prisma
  |
  v
Supabase PostgreSQL
```

Authentication will use Supabase Auth.

The production application should be testable through Playwright later, so routing and environment setup must not depend on manual hacks.

## Required Scope

- React + TypeScript + Vite
- NestJS
- Prisma
- Supabase PostgreSQL
- Supabase Auth foundation
- React Router
- TanStack Query
- Zustand only where shared UI state is needed
- React Hook Form
- Zod
- Tailwind CSS
- Shared contracts
- Lint
- Typecheck
- Unit tests
- Production build
- Playwright setup


## How to Execute These Tests

Execute the tests manually from the browser using real application routes and API behavior.

Mark each case as:

- `PASS`
- `FAIL`
- `BLOCKED`

When a case fails, record:

- Browser and viewport
- User account and role
- Exact steps performed
- Expected result
- Actual result
- Screenshot or screen recording when useful
- Browser console error
- Network request and response status when relevant
- Related database record when relevant

Do not mark a test as passed only because the interface looks correct.

Permission-sensitive tests must be verified against backend behavior as well.

## Global Visual and Interaction Checks

Apply these checks to every page in this phase:

- No overlapping elements.
- No clipped controls or text.
- No accidental page-level horizontal scrollbar.
- No unexpected vertical scrollbar inside fixed layouts.
- Modal and drawer positioning is correct.
- Long names and descriptions do not destroy the layout.
- Loading states do not cause major layout jumps.
- Empty states are intentional.
- Error states are understandable.
- Keyboard focus is visible.
- Buttons cannot be accidentally triggered twice.
- Refresh preserves server-backed state.
- Browser Back and Forward behave naturally.
- Direct URL navigation works.
- There are no unexplained console errors.


## Manual Test Cases

| ID | Test | Steps | Expected Result |
| --- | --- | --- | --- |
| F0-01 | Frontend starts | Start the frontend development server and open the application. | Application loads successfully without fatal errors. |
| F0-02 | Backend starts | Start NestJS. | Server starts and exposes the expected API base path. |
| F0-03 | Frontend to backend connection | Trigger a health or test API request from the browser. | Request succeeds and returns the expected response. |
| F0-04 | Backend to database connection | Trigger a backend endpoint that performs a simple database query. | Query succeeds. |
| F0-05 | Prisma migration | Apply the current Prisma migration to a clean development database. | Migration completes successfully. |
| F0-06 | Migration repeat safety | Restart the application after migrations are already applied. | Application starts without trying to recreate existing structures incorrectly. |
| F0-07 | SPA direct route | Open a configured frontend route directly in the address bar. | SPA loads rather than returning a server 404. |
| F0-08 | Browser refresh | Refresh a configured route. | Same route loads correctly. |
| F0-09 | Backend unavailable | Stop backend and perform an API-driven action. | Frontend displays a controlled error state. |
| F0-10 | Database unavailable | Temporarily make the database unavailable and call a database endpoint. | Backend returns a controlled server error and does not crash permanently. |
| F0-11 | Environment separation | Inspect frontend bundle and browser network configuration. | Backend-only secrets are not exposed to the browser. |
| F0-12 | Production build | Run the production build. | Build completes successfully. |
| F0-13 | Production preview | Serve the production build locally. | Application works under production build behavior. |
| F0-14 | Lint | Run project lint command. | No lint errors remain. |
| F0-15 | Typecheck | Run TypeScript typecheck. | No type errors remain. |
| F0-16 | Unit test baseline | Run configured unit tests. | Test command succeeds. |
| F0-17 | Playwright baseline | Run one minimal browser smoke test. | Browser automation can start, navigate, and assert application availability. |
| F0-18 | Console cleanliness | Open the app and inspect the browser console. | No unexplained runtime errors or repeated warnings. |

## Phase 0 Exit Checklist

- [ ] Frontend, backend, and database communicate correctly.
- [ ] Prisma migrations work.
- [ ] Direct SPA routes and refresh work.
- [ ] Secrets are separated correctly.
- [ ] Error handling exists for unavailable dependencies.
- [ ] Production build passes.
- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Baseline tests pass.
- [ ] Browser console is clean enough to begin feature work.

## Regression to Carry Forward

Every later phase should continue verifying:

- Application starts.
- API responds.
- Database remains reachable.
- Production build still succeeds.
- Direct route refresh still works.
