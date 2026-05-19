#!/usr/bin/env node
/**
 * End-to-end SIWE flow test.
 * Usage: PRIVATE_KEY=0x... node scripts/siwe-test.mjs
 * Falls back to the deployer key in contracts/.env if not given.
 */
import { SiweMessage } from 'siwe';
import { privateKeyToAccount } from 'viem/accounts';

const API = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const PK = process.env.PRIVATE_KEY;
if (!PK) {
  console.error('Set PRIVATE_KEY env var');
  process.exit(1);
}

const account = privateKeyToAccount(PK.startsWith('0x') ? PK : `0x${PK}`);
const address = account.address;
console.log('Wallet:', address);

const nonceRes = await fetch(`${API}/auth/nonce`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address }),
});
if (!nonceRes.ok) throw new Error(`nonce: ${nonceRes.status} ${await nonceRes.text()}`);
const { nonce, expiresAt } = await nonceRes.json();
console.log('Nonce:', nonce, 'expires', expiresAt);

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
console.log('Signed message:\n---\n' + message + '\n---');

const verifyRes = await fetch(`${API}/auth/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, signature }),
});
const verifyBody = await verifyRes.json();
if (!verifyRes.ok) throw new Error(`verify: ${verifyRes.status} ${JSON.stringify(verifyBody)}`);
const { token, user } = verifyBody;
console.log('JWT:', token.slice(0, 24) + '...');
console.log('User:', user);

for (const path of ['/me', '/treasury/balance']) {
  const r = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json();
  console.log(`\nGET ${path} -> HTTP ${r.status}`);
  console.log(JSON.stringify(body, null, 2));
}
