import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadConfig } from './config.js';

export function signState(token: string): string {
  const { verification } = loadConfig();
  const sig = createHmac('sha256', verification.stateSecret).update(token).digest('base64url');
  return `${token}.${sig}`;
}

export function verifyState(state: string): string | undefined {
  const { verification } = loadConfig();
  const [token, sig] = state.split('.');
  if (!token || !sig) return undefined;

  const expected = createHmac('sha256', verification.stateSecret).update(token).digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;

  return token;
}
