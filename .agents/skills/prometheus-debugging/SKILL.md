---
name: prometheus-debugging
description: Use when diagnosing or fixing defects in Prometheus. Covers reproduction, system-boundary diagnosis, root-cause fixes, focused verification, regression, and decision-journal updates for meaningful failures.
---

# Prometheus Debugging

Use this workflow for defects, failing tests, broken integrations, regressions, and unexpected runtime behavior.

## 1. Reproduce the user-visible problem first

Start as close as possible to the real user path.

Determine:

```text
What action was performed?
What was expected?
What actually happened?
Can it be reproduced consistently?
Which system boundary appears to fail?
```

Prefer browser-level reproduction for browser-facing defects before changing implementation details.

For test failures, understand whether the failure is in the product, the test, the environment, or the test setup before changing code.

## 2. Narrow the failing boundary

Inspect only the diagnostics relevant to the failure:

- Browser behavior.
- Accessibility tree and selectors.
- Browser console.
- Network requests and responses.
- Frontend validation and state.
- Authentication session.
- Backend logs.
- Authorization decisions.
- API validation.
- Database state.
- Prisma queries and constraints.
- Environment configuration.
- Recent changes.

Follow the actual request/data path rather than guessing from the visible symptom.

## 3. Fix the root cause

Do not mask a failure with a special-case workaround if the underlying boundary remains broken.

Examples:

- A hidden button is not a substitute for backend authorization.
- A longer Playwright timeout is not a substitute for fixing a bad selector or asynchronous state bug.
- Client-side validation is not a substitute for backend validation.
- Cached UI state is not a substitute for persistent database state.

Prefer the smallest fix that restores the intended architecture.

## 4. Verify the original reproduction

After the change, repeat the exact path that originally failed.

A bug is not considered fixed until the original reproduction succeeds or the failure is otherwise directly demonstrated to be resolved.

Then run the smallest relevant automated check.

Expand regression when the fix touches shared areas such as:

- Authentication.
- Authorization.
- Routing.
- Persistence.
- Shared contracts.
- App shell/navigation.
- Database schema.
- Common UI primitives.

## 5. Treat adjacent failures intentionally

Do not ignore obvious failures discovered while debugging, including:

- Lint failures.
- Type errors.
- Test flakiness.
- Console errors.
- Clear accessibility regressions.
- Obvious visual defects.

If an adjacent issue requires a large unrelated architectural change, identify it rather than silently expanding scope.

## 6. Record meaningful debugging lessons

If the failure reveals a significant architectural, integration, security, testing, or workflow lesson, update the active phase journal under `.docs/phases/`.

Use the decision format defined in `.docs/phases/README.md` and the phase-delivery skill.

Record:

- What made the issue difficult.
- Root cause.
- Options considered.
- Chosen solution.
- Result.
- What was learned.
- The next approach that should prevent repetition.

Do not create journal entries for trivial syntax mistakes unless the mistake exposed a broader systemic issue.

## 7. Report debugging results accurately

State:

- Reproduction.
- Root cause.
- Change made.
- Verification performed.
- Regression performed.
- Anything still unverified.

Do not claim a defect is fixed only because the implementation looks plausible.
