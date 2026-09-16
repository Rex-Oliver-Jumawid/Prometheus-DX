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
  APP_URL: z.string().url().optional(),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().min(1).optional(),
  INVITATION_DELIVERY_MODE: z.enum(['brevo', 'disabled']).default('brevo'),
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
  appUrl: parsed.APP_URL,
  brevoApiKey: parsed.BREVO_API_KEY,
  brevoSenderEmail: parsed.BREVO_SENDER_EMAIL,
  brevoSenderName: parsed.BREVO_SENDER_NAME,
  invitationDeliveryMode: parsed.INVITATION_DELIVERY_MODE,
};
