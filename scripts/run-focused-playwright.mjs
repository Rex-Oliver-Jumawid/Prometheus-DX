import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
if (args.includes('--')) {
  console.error('Place -- only before the spec file and Playwright options.');
  process.exit(2);
}
const specPattern = /(?:^|\/)[^/]+\.spec\.[cm]?[jt]sx?$/;
const firstOptionIndex = args.findIndex((arg) => arg.startsWith('-'));
const selectors =
  firstOptionIndex === -1 ? args : args.slice(0, firstOptionIndex);
const unexpectedSelectors = selectors.filter((arg) => !specPattern.test(arg));

if (unexpectedSelectors.length > 0) {
  console.error(
    [
      'Focused Playwright accepts explicit spec files only.',
      `Unexpected selector: ${unexpectedSelectors[0]}`,
      '',
      'Keep each spec path intact on one shell command line.',
    ].join('\n'),
  );
  process.exit(2);
}

const specFiles = selectors;

if (specFiles.length === 0) {
  console.error(
    [
      'Focused Playwright requires at least one explicit spec file.',
      '',
      'Example:',
      '  pnpm test:e2e:focused -- tests/e2e/schedule.spec.ts -g "saves schedule"',
      '',
      'Use pnpm test:e2e only for an intentional broad Chromium regression gate.',
    ].join('\n'),
  );
  process.exit(2);
}

if (specFiles.length > 3) {
  console.error(
    [
      `Focused Playwright accepts at most 3 spec files; received ${specFiles.length}.`,
      'Run the smallest affected set first.',
      'Use pnpm test:e2e only when a broad Chromium regression is intentionally required.',
    ].join('\n'),
  );
  process.exit(2);
}

if (args.some((arg) => arg === '--project' || arg.startsWith('--project='))) {
  console.error(
    'Do not pass --project to the focused runner. It intentionally uses Chromium only.',
  );
  process.exit(2);
}

const runnerArgs = ['exec', 'playwright', 'test', ...args, '--project=chromium'];

if (!args.some((arg) => arg === '--reporter' || arg.startsWith('--reporter='))) {
  runnerArgs.push('--reporter=line');
}

if (
  !args.some(
    (arg) => arg === '--max-failures' || arg.startsWith('--max-failures='),
  )
) {
  runnerArgs.push('--max-failures=1');
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, runnerArgs, {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
