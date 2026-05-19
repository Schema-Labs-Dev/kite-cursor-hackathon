import { env } from './env';

export type SiweInput = {
  address: `0x${string}`;
  nonce: string;
  issuedAt?: Date;
};

/**
 * Build a SIWE message string by hand. We avoid importing the `siwe` package on
 * device because its dependencies pull in Node-only crypto/Buffer paths that
 * don't run cleanly inside the Hermes runtime. Verification still happens on
 * the backend with the full library, so wire-format compatibility is what matters.
 */
export function buildSiweMessage({
  address,
  nonce,
  issuedAt = new Date(),
}: SiweInput): string {
  const domain = stripScheme(env.apiUrl);
  const uri = `https://${domain}`;

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to Kite',
    '',
    `URI: ${uri}`,
    'Version: 1',
    `Chain ID: ${env.chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
  ].join('\n');
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '').split('/')[0];
}
