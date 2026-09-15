import 'dotenv/config';
import { z } from 'zod';

const ServerEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:4173'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

const parsed = ServerEnvironmentSchema.parse(process.env);

export const serverEnvironment = {
  port: parsed.PORT,
  nodeEnv: parsed.NODE_ENV,
  clientOrigins: parsed.CLIENT_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  supabaseUrl: parsed.SUPABASE_URL,
  supabaseAnonKey: parsed.SUPABASE_ANON_KEY,
};
