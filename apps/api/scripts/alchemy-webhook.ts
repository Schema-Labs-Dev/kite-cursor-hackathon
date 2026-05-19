/**
 * CLI to manage the Kite Alchemy Custom Webhook (Address Activity).
 *
 *   pnpm --filter @kite/api webhook create <publicly-reachable-url>
 *   pnpm --filter @kite/api webhook list
 *   pnpm --filter @kite/api webhook update-url <webhook_id> <new-url>
 *   pnpm --filter @kite/api webhook delete <webhook_id>
 *
 * After `create`, paste the printed webhook_id + signing_key into apps/api/.env
 * (ALCHEMY_WEBHOOK_ID, ALCHEMY_WEBHOOK_SIGNING_KEY) and restart the API.
 *
 * Auth: by default uses ALCHEMY_NOTIFY_AUTH_TOKEN. Falls back to ALCHEMY_API_KEY
 * if the auth token isn't set (some Alchemy accounts allow this).
 */

import 'dotenv/config';
import { getAddress } from 'viem';

const NOTIFY_BASE = 'https://dashboard.alchemy.com/api';

type CreateResponse = {
  data: {
    id: string;
    network: string;
    webhook_type: string;
    webhook_url: string;
    is_active: boolean;
    signing_key: string;
    addresses?: string[];
  };
};

type ListResponse = {
  data: Array<{
    id: string;
    network: string;
    webhook_type: string;
    webhook_url: string;
    is_active: boolean;
    signing_key?: string;
  }>;
};

function token(): string {
  // Prefer the dedicated Notify token; fall back to the RPC API key (some
  // Alchemy accounts allow it for admin calls).
  const notify = process.env.ALCHEMY_NOTIFY_AUTH_TOKEN;
  const api = process.env.ALCHEMY_API_KEY;
  const t = (notify && notify.length > 0) ? notify : (api && api.length > 0 ? api : '');
  if (!t) {
    fatal(
      'Missing ALCHEMY_NOTIFY_AUTH_TOKEN. Grab it from https://dashboard.alchemy.com → Webhooks → Auth Token, then add it to apps/api/.env.',
    );
  }
  return t;
}

async function req<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${NOTIFY_BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'X-Alchemy-Token': token(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      fatal(
        `Alchemy ${res.status}: ${text}\n\n` +
          'Auth rejected. The Notify admin API needs the dashboard "Auth Token" (Dashboard → Webhooks → Auth Token), ' +
          'which is separate from the RPC API key. Put it in apps/api/.env as ALCHEMY_NOTIFY_AUTH_TOKEN and re-run.',
      );
    }
    fatal(`Alchemy ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

async function create(url: string): Promise<void> {
  if (!/^https:\/\/.+/i.test(url)) {
    fatal(`Webhook URL must be https. Got: ${url}`);
  }
  const finalUrl = url.endsWith('/api/v1/webhooks/alchemy')
    ? url
    : url.replace(/\/?$/, '/api/v1/webhooks/alchemy');

  const treasury = (process.env.KITE_TREASURY_ADDRESS ?? '').trim();
  const addresses = treasury ? [treasury] : [];

  const body = {
    network: 'BASE_SEPOLIA',
    webhook_type: 'ADDRESS_ACTIVITY',
    webhook_url: finalUrl,
    addresses,
  };

  console.log('Creating webhook:', body);
  const out = await req<CreateResponse>('POST', '/create-webhook', body);

  console.log('\n✓ Created\n');
  console.log(`  webhook_id   ${out.data.id}`);
  console.log(`  signing_key  ${out.data.signing_key}`);
  console.log(`  url          ${out.data.webhook_url}`);
  console.log(`  network      ${out.data.network}`);
  console.log(`  addresses    ${(out.data.addresses ?? []).length}`);
  console.log('\nPaste into apps/api/.env then restart the API:\n');
  console.log(`  ALCHEMY_WEBHOOK_ID=${out.data.id}`);
  console.log(`  ALCHEMY_WEBHOOK_SIGNING_KEY=${out.data.signing_key}\n`);
}

async function list(): Promise<void> {
  const out = await req<ListResponse>('GET', '/team-webhooks');
  if (!out.data.length) {
    console.log('(no webhooks)');
    return;
  }
  for (const w of out.data) {
    console.log(`${w.id}  ${w.is_active ? '●' : '○'}  ${w.network}  ${w.webhook_type}`);
    console.log(`  ${w.webhook_url}`);
  }
}

async function updateUrl(id: string, url: string): Promise<void> {
  // Alchemy's API expects PUT here (PATCH returns 405 Method Not Allowed).
  await req('PUT', '/update-webhook', { webhook_id: id, webhook_url: url });
  console.log(`✓ Updated ${id} → ${url}`);
}

async function del(id: string): Promise<void> {
  await req('DELETE', `/delete-webhook?webhook_id=${encodeURIComponent(id)}`);
  console.log(`✓ Deleted ${id}`);
}

async function syncUsers(): Promise<void> {
  const webhookId = process.env.ALCHEMY_WEBHOOK_ID;
  if (!webhookId) {
    fatal('ALCHEMY_WEBHOOK_ID missing in apps/api/.env. Run `webhook create` first.');
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({
      select: { walletAddress: true },
    });
    const treasury = (process.env.KITE_TREASURY_ADDRESS ?? '').trim();
    // Demo merchants — kept in sync so inbound payments fire webhook events.
    // Keep this list in step with apps/mobile/lib/merchants.ts.
    const merchants = ['0xAE0AC5583B519C34777FB5998016CF1D1d033091'];

    // De-dupe + checksum (the Notify API rejects malformed mixed-case input).
    const seen = new Set<string>();
    const addresses: string[] = [];
    for (const raw of [
      ...users.map((u) => u.walletAddress),
      treasury,
      ...merchants,
    ]) {
      if (!raw) continue;
      try {
        const ck = getAddress(raw);
        const key = ck.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        addresses.push(ck);
      } catch {
        console.warn(`  (skipping malformed address: ${raw})`);
      }
    }

    if (addresses.length === 0) {
      console.log('No addresses to sync.');
      return;
    }

    console.log(
      `Pushing ${users.length} user address(es) + Treasury → webhook ${webhookId}…`,
    );
    await req('PATCH', '/update-webhook-addresses', {
      webhook_id: webhookId,
      addresses_to_add: addresses,
      addresses_to_remove: [],
    });
    console.log(`✓ Synced ${addresses.length} address(es).`);
  } finally {
    await prisma.$disconnect();
  }
}

function fatal(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'create':
      if (!args[0]) fatal('Usage: webhook create <publicly-reachable-https-url>');
      await create(args[0]);
      break;
    case 'list':
      await list();
      break;
    case 'update-url':
      if (!args[0] || !args[1])
        fatal('Usage: webhook update-url <webhook_id> <new-https-url>');
      await updateUrl(args[0], args[1]);
      break;
    case 'delete':
      if (!args[0]) fatal('Usage: webhook delete <webhook_id>');
      await del(args[0]);
      break;
    case 'sync-users':
      await syncUsers();
      break;
    default:
      console.log(
        [
          'Kite Alchemy webhook CLI',
          '',
          '  pnpm --filter @kite/api webhook create <https-url>',
          '  pnpm --filter @kite/api webhook list',
          '  pnpm --filter @kite/api webhook update-url <id> <new-url>',
          '  pnpm --filter @kite/api webhook delete <id>',
          '  pnpm --filter @kite/api webhook sync-users',
        ].join('\n'),
      );
  }
}

main().catch((err: unknown) => {
  fatal((err as Error).message);
});
