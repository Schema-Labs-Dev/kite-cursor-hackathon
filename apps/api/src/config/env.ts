import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(16),

  BASE_SEPOLIA_RPC_URL: z.string().url(),
  BASE_SEPOLIA_CHAIN_ID: z.coerce.number().default(84532),
  KITE_TREASURY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/i, 'Must be a 0x-prefixed 20-byte address'),
  USDC_ADDRESS_BASE_SEPOLIA: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/i, 'Must be a 0x-prefixed 20-byte address'),
  EURC_ADDRESS_BASE_SEPOLIA: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/i, 'Must be a 0x-prefixed 20-byte address')
    .default('0x808456652fdb597867f38412077A9182bf77359F'),

  // Alchemy — all optional. RPC swap is automatic when ALCHEMY_API_KEY is set.
  // Webhook + notify need all three of (signing key, webhook id, notify auth
  // token) to be live; otherwise we fall back to polling-only.
  ALCHEMY_API_KEY: z.string().min(8).optional(),
  ALCHEMY_WEBHOOK_SIGNING_KEY: z.string().min(8).optional(),
  ALCHEMY_WEBHOOK_ID: z.string().min(4).optional(),
  ALCHEMY_NOTIFY_AUTH_TOKEN: z.string().min(8).optional(),

  // Deployer / admin wallet — owner of KiteUSDC + KiteEURC. Used by the
  // onramp service to mint test tokens to user smart accounts on simulated
  // payment success. `ADMIN_PRIVATE_KEY` is preferred; legacy `PRIVATE_KEY`
  // is accepted as a fallback so existing dev envs keep working.
  ADMIN_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a 0x-prefixed 32-byte hex')
    .optional(),
  PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a 0x-prefixed 32-byte hex')
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
