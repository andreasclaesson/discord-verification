import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPendingVerification, buildAuthorizeUrl, signState } from '@discord-verification/shared';
import { htmlPage } from '../render.js';

export function handleVerifyPage(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '', 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(htmlPage('Missing token', '<p>This verification link is missing its token.</p>'));
    return;
  }

  const pending = getPendingVerification(token);

  if (!pending || pending.status !== 'pending' || pending.expires_at <= Date.now()) {
    res.writeHead(410, { 'Content-Type': 'text/html' });
    res.end(
      htmlPage(
        'Link expired',
        '<p>This verification link is no longer valid. Leave and rejoin the server to get a new one.</p>'
      )
    );
    return;
  }

  const authorizeUrl = buildAuthorizeUrl(signState(token));

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(
    htmlPage(
      'Verify your account',
      `<p>Click below and log in with Discord to confirm you're a member of the server.</p>
       <a class="button" href="${authorizeUrl}">Continue with Discord</a>`
    )
  );
}
