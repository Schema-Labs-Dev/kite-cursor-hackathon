#!/usr/bin/env node
/**
 * Phase 4 smoke test:
 *  - Login (SIWE)
 *  - GET /transactions  (expect empty initially)
 *  - GET /users/resolve?q=Bernard
 *  - GET /users/resolve?q=<address>
 */
import { SiweMessage } from 'siwe';
import { privateKeyToAccount } from 'viem/accounts';

const API = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const PK = process.env.PRIVATE_KEY;
if (!PK) throw new Error('Set PRIVATE_KEY');

const account = privateKeyToAccount(PK.startsWith('0x') ? PK : `0x${PK}`);
const address = account.address;

const { nonce } = await (
  await fetch(`${API}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  })
).json();

const siwe = new SiweMessage({
  domain: 'localhost:3001',
  address,
  statement: 'Sign in to Kite',
  uri: 'http://localhost:3001',
  version: '1',
  chainId: 84532,
  nonce,
  issuedAt: new Date().toISOString(),
});
const message = siwe.prepareMessage();
const signature = await account.signMessage({ message });

const { token } = await (
  await fetch(`${API}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  })
).json();

const auth = { Authorization: `Bearer ${token}` };

console.log('--- GET /transactions ---');
const txs = await (await fetch(`${API}/transactions`, { headers: auth })).json();
console.log(JSON.stringify(txs, null, 2));

console.log('\n--- GET /users/resolve?q=Bernard ---');
const r1 = await (
  await fetch(`${API}/users/resolve?q=Bernard`, { headers: auth })
).json();
console.log(JSON.stringify(r1, null, 2));

console.log('\n--- GET /users/resolve?q=bernard.base ---');
const r2 = await (
  await fetch(`${API}/users/resolve?q=bernard.base`, { headers: auth })
).json();
console.log(JSON.stringify(r2, null, 2));

console.log(`\n--- GET /users/resolve?q=${address} ---`);
const r3 = await (
  await fetch(`${API}/users/resolve?q=${address}`, { headers: auth })
).json();
console.log(JSON.stringify(r3, null, 2));

console.log('\n--- GET /users/resolve?q=x (too short, expect 400) ---');
const r4 = await fetch(`${API}/users/resolve?q=x`, { headers: auth });
console.log('status', r4.status);
