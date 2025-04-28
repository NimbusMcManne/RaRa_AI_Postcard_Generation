import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  port: z.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  oaiPmhEndpoint: z.string().url(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config = ConfigSchema.parse({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  nodeEnv: process.env.NODE_ENV,
  oaiPmhEndpoint: process.env.OAI_PMH_ENDPOINT,
});
