#!/usr/bin/env node
/**
 * Verifies:
 *  - Reusing a consumed nonce returns 401
 *  - PATCH /me updates display name and returns it on subsequent /me
 */
import { SiweMessage } from 'siwe';
import { privateKeyToAccount } from 'viem/accounts';

const API = process.env.API_URL ?? 'http://localhost:3001/api/v1';
const PK = process.env.PRIVATE_KEY;
if (!PK) throw new Error('Set PRIVATE_KEY');

const account = privateKeyToAccount(PK.startsWith('0x') ? PK : `0x${PK}`);
const address = account.address;

async function login() {
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
  const r = await fetch(`${API}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });
  return { ...(await r.json()), status: r.status, message, signature };
}

const first = await login();
console.log('1st verify:', first.status, '->', first.token?.slice(0, 16) + '...');

const replay = await fetch(`${API}/auth/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: first.message, signature: first.signature }),
});
console.log('replay verify (expect 401):', replay.status);

const token = first.token;
const patchRes = await fetch(`${API}/me`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ displayName: 'Bernard', basename: 'bernard.base.eth' }),
});
console.log('\nPATCH /me ->', patchRes.status);
console.log(JSON.stringify(await patchRes.json(), null, 2));

const meRes = await fetch(`${API}/me`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log('\nGET /me ->', meRes.status);
console.log(JSON.stringify(await meRes.json(), null, 2));
