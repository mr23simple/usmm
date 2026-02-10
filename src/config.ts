import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().default('3005'),
  FB_PAGE_ID: z.string().optional(),
  FB_PAGE_ACCESS_TOKEN: z.string().optional(),
  CONCURRENCY: z.string().default('3').transform(Number),
  PUBLISH_RATE_LIMIT: z.string().default('10').transform(Number),
  DRY_RUN: z.string().default('false').transform((v) => v === 'true'),
  API_KEY: z.string().optional(), // Optional simple auth
});

const processEnv = EnvSchema.safeParse(process.env);

if (!processEnv.success) {
  console.error("❌ Invalid environment variables:", processEnv.error.format());
  process.exit(1);
}

export const config = processEnv.data;
