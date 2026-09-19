import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelConfiguration {
  buildCommand: string;
  outputDirectory: string;
  rewrites: Array<{ source: string; destination: string }>;
}

describe('Vercel configuration', () => {
  it('dispatches API requests before the Vite SPA fallback', () => {
    const configuration = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as VercelConfiguration;

    expect(configuration.buildCommand).toBe(
      'pnpm prisma:generate && pnpm build',
    );
    expect(configuration.outputDirectory).toBe('dist');
    expect(configuration.rewrites).toEqual([
      { source: '/api/(.*)', destination: '/api' },
      { source: '/(.*)', destination: '/index.html' },
    ]);
    expect(existsSync(resolve(process.cwd(), 'api/index.ts'))).toBe(true);
  });
});
