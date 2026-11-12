import { readFileSync } from 'node:fs';
const values = Object.fromEntries(
  readFileSync(process.argv[2], 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const split = line.indexOf('=');
      return [
        line.slice(0, split),
        line.slice(split + 1).replace(/^"|"$/g, ''),
      ];
    }),
);
for (const [target, source] of Object.entries({
  DATABASE_URL: 'DB_URL',
  DIRECT_URL: 'DB_URL',
  SUPABASE_URL: 'API_URL',
  VITE_SUPABASE_URL: 'API_URL',
  SUPABASE_ANON_KEY: 'ANON_KEY',
  VITE_SUPABASE_ANON_KEY: 'ANON_KEY',
  SUPABASE_SERVICE_ROLE_KEY: 'SERVICE_ROLE_KEY',
})) {
  if (!values[source]) throw new Error(`Missing local Supabase ${source}`);
  console.log(`${target}=${values[source]}`);
}
