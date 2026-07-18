import { createServer } from 'node:http';
import { initDb, loadConfig, closeDb, registerGracefulShutdown } from '@discord-verification/shared';
import { handleVerifyPage } from './routes/verify.js';
import { handleCallback } from './routes/callback.js';
import { handleHealthz } from './routes/healthz.js';
import { htmlPage } from './render.js';
import { createRateLimiter } from './rateLimit.js';
import { getClientIp } from './getClientIp.js';

initDb();
const { web } = loadConfig();

// 10 attempts/minute/IP is generous for a real user clicking through OAuth
// once, but stops a client from hammering the OAuth token exchange (which
// would otherwise burn through Discord's own rate limit on our behalf).
const callbackLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/healthz') {
    handleHealthz(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/verify') {
    handleVerifyPage(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/callback') {
    const ip = getClientIp(req);
    const { allowed, retryAfterMs } = callbackLimiter(ip);
    if (!allowed) {
      res.writeHead(429, {
        'Content-Type': 'text/html',
        'Retry-After': String(Math.ceil((retryAfterMs ?? 1000) / 1000)),
      });
      res.end(
        htmlPage('Too many attempts', '<p>Too many verification attempts. Please wait a moment and try again.</p>')
      );
      return;
    }

    handleCallback(req, res).catch((err) => {
      console.error('[web] unhandled callback error:', err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(htmlPage('Error', '<p>Something went wrong.</p>'));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end(htmlPage('Not found', '<p>Nothing here.</p>'));
});

server.listen(web.port, () => {
  console.log(`[web] listening on :${web.port}`);
});

registerGracefulShutdown('web', () => {
  return new Promise<void>((resolvePromise, reject) => {
    // stops accepting new connections, waits for in-flight requests to finish.
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      closeDb();
      resolvePromise();
    });
  });
});