import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  loadConfig,
  verifyState,
  claimPendingVerification,
  markVerificationFailed,
  markUserVerified,
  exchangeOAuthCode,
  getOAuthUser,
  userIsInGuild,
  addVerifiedRole,
} from '@discord-verification/shared';
import { htmlPage } from '../render.js';

function fail(res: ServerResponse, status: number, title: string, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html' });
  res.end(htmlPage(title, `<p>${message}</p>`));
}

export async function handleCallback(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  if (oauthError) {
    fail(res, 400, 'Login cancelled', 'You cancelled the Discord login, so verification was not completed.');
    return;
  }

  if (!code || !state) {
    fail(res, 400, 'Invalid request', 'This callback is missing required parameters.');
    return;
  }

  // 1. verify the state param actually came from a link we generated.
  const token = verifyState(state);
  if (!token) {
    fail(res, 400, 'Invalid request', 'This verification link is invalid or was tampered with.');
    return;
  }

  // 2. claim the token so a replayed/duplicate callback can't run twice.
  const pending = claimPendingVerification(token);
  if (!pending) {
    fail(res, 410, 'Link already used or expired', 'This verification link has already been used or expired.');
    return;
  }

  const { guild } = loadConfig();

  try {
    // 3. exchange the code for a short-lived access token.
    const tokenResponse = await exchangeOAuthCode(code);

    // 4. confirm the Discord account logging in is the same one that received the DM.
    const oauthUser = await getOAuthUser(tokenResponse.access_token);
    if (oauthUser.id !== pending.user_id) {
      markVerificationFailed(token, 'oauth_user_mismatch');
      fail(
        res,
        403,
        'Account mismatch',
        "The Discord account you logged in with isn't the one this link was sent to."
      );
      return;
    }

    // 5. confirm they're actually still a member of the guild (not just that they clicked a link).
    const inGuild = await userIsInGuild(tokenResponse.access_token, guild.guildId);
    if (!inGuild) {
      markVerificationFailed(token, 'not_in_guild');
      fail(res, 403, 'Not a member', "You don't appear to be a member of the server anymore.");
      return;
    }

    // 6. grant the role using the bot token (never exposed to the browser).
    await addVerifiedRole(guild.guildId, oauthUser.id, guild.verifiedRoleId);
    markUserVerified(guild.guildId, oauthUser.id);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlPage('Verified!', '<p>You\'re verified. Head back to Discord — your role is ready.</p>'));
  } catch (err) {
    console.error('[callback] verification failed:', err);
    markVerificationFailed(token, 'internal_error');
    fail(res, 500, 'Something went wrong', 'Verification failed unexpectedly. Please try again from Discord.');
  }
}
