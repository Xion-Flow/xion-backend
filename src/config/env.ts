import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  JWT_SECRET: z.string().default('xion_super_secret_jwt_key_production_change_me_12345'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  CORS_ORIGIN: z.string().default('*'),
});

export const env = envSchema.parse(process.env);
