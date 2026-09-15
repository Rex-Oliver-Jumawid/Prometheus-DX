import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

const requiredFiles = [
  '.env.example',
  '.gitignore',
  '.nvmrc',
  'AGENTS.md',
  'README.md',
  'eslint.config.mjs',
  'package.json',
  'playwright.config.ts',
  'prisma/schema.prisma',
  'src/main.tsx',
  'server/main.ts',
  'vite.config.ts',
];

for (const file of requiredFiles) {
  requireFile(file);
}

const packageJson = JSON.parse(read('package.json'));
const requiredScripts = [
  'dev',
  'build',
  'lint',
  'typecheck',
  'test',
  'test:e2e',
  'prisma:generate',
  'prisma:validate',
];

for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) {
    errors.push(`package.json is missing the "${script}" script.`);
  }
}

if (packageJson.private !== true) {
  errors.push('package.json must keep "private": true.');
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isInteger(nodeMajor) || nodeMajor < 22) {
  errors.push(`Node.js 22 or newer is required. Current version: ${process.versions.node}.`);
}

const nvmVersion = read('.nvmrc').trim();
if (nvmVersion !== '22') {
  errors.push(`.nvmrc must pin Node.js 22 for this repository. Found: ${nvmVersion || '(empty)'}.`);
}

const envExample = read('.env.example');
const requiredEnvKeys = [
  'PORT',
  'CLIENT_ORIGINS',
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
];

for (const key of requiredEnvKeys) {
  if (!new RegExp(`^${key}=`, 'm').test(envExample)) {
    errors.push(`.env.example is missing ${key}.`);
  }
}

const browserEnvKeys = [...envExample.matchAll(/^([A-Z0-9_]+)=/gm)]
  .map((match) => match[1])
  .filter((key) => key.startsWith('VITE_'));

for (const key of browserEnvKeys) {
  if (/(DATABASE|DIRECT|SERVICE_ROLE|SECRET)/.test(key)) {
    errors.push(`Browser-exposed environment variable looks sensitive: ${key}.`);
  }
}

const gitignore = read('.gitignore');
for (const ignoredPath of ['node_modules/', 'dist/', '.env']) {
  if (!gitignore.includes(ignoredPath)) {
    errors.push(`.gitignore should include ${ignoredPath}.`);
  }
}

if (errors.length > 0) {
  console.error('Prometheus-DX project doctor found configuration problems:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Prometheus-DX project doctor passed.');
