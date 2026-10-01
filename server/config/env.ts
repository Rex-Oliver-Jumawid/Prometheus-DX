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
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  APP_URL: z.string().url().optional(),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().min(1).optional(),
  INVITATION_DELIVERY_MODE: z.enum(['brevo', 'disabled']).default('brevo'),
  WORK_SESSION_MAX_HOURS: z.coerce.number().positive().max(168).default(16),
  WEB_PUSH_VAPID_SUBJECT: z.string().min(1).optional(),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
}).superRefine((value, context) => {
  const configured = [
    value.WEB_PUSH_VAPID_SUBJECT,
    value.WEB_PUSH_VAPID_PUBLIC_KEY,
    value.WEB_PUSH_VAPID_PRIVATE_KEY,
  ].filter(Boolean).length;
  if (configured !== 0 && configured !== 3) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, and WEB_PUSH_VAPID_PRIVATE_KEY must be configured together.',
    });
  }
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
  supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: parsed.APP_URL,
  brevoApiKey: parsed.BREVO_API_KEY,
  brevoSenderEmail: parsed.BREVO_SENDER_EMAIL,
  brevoSenderName: parsed.BREVO_SENDER_NAME,
  invitationDeliveryMode: parsed.INVITATION_DELIVERY_MODE,
  workSessionMaxHours: parsed.WORK_SESSION_MAX_HOURS,
  webPush:
    parsed.WEB_PUSH_VAPID_SUBJECT &&
    parsed.WEB_PUSH_VAPID_PUBLIC_KEY &&
    parsed.WEB_PUSH_VAPID_PRIVATE_KEY
      ? {
          subject: parsed.WEB_PUSH_VAPID_SUBJECT,
          publicKey: parsed.WEB_PUSH_VAPID_PUBLIC_KEY,
          privateKey: parsed.WEB_PUSH_VAPID_PRIVATE_KEY,
        }
      : null,
};
