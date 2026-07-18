import type { IncomingMessage } from 'node:http';
import { loadConfig } from '@discord-verification/shared';

export function getClientIp(req: IncomingMessage): string {
  const { web } = loadConfig();

  if (web.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    if (first) return first.trim();
  }

  return req.socket.remoteAddress ?? 'unknown';
}