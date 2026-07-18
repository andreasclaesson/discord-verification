import { loadConfig } from './config.js';

interface DiscordFetchOptions extends RequestInit {
  /** Use the bot token instead of no auth / a user access token. */
  asBot?: boolean;
}

/**
 * Thin fetch wrapper around the Discord REST API.
 * Handles 429s with a single retry using the `retry_after` Discord gives us --
 * good enough for the low request volume this app generates (a handful of
 * calls per verification, not a message-spamming bot).
 */
async function discordFetch(path: string, options: DiscordFetchOptions = {}): Promise<Response> {
  const { discord } = loadConfig();
  const url = path.startsWith('http') ? path : `${discord.apiBaseUrl}${path}`;

  const headers = new Headers(options.headers);
  if (options.asBot) {
    headers.set('Authorization', `Bot ${discord.botToken}`);
  }
  // Only default to JSON for plain string/object bodies. A URLSearchParams
  // body (used for the OAuth2 token exchange, which Discord requires as
  // application/x-www-form-urlencoded) must be left alone -- fetch sets the
  // correct content type for it automatically, and overriding that to
  // 'application/json' here makes Discord fail to parse the request body.
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof URLSearchParams)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 429) {
    const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
    const retryAfterMs = Math.ceil((body.retry_after ?? 1) * 1000);
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    return discordFetch(path, options);
  }

  return response;
}

/** Builds the URL to send a user to for OAuth2 login. */
export function buildAuthorizeUrl(signedState: string): string {
  const { discord } = loadConfig();
  const params = new URLSearchParams({
    client_id: discord.clientId,
    redirect_uri: discord.redirectUri,
    response_type: 'code',
    // identify -> user id/username, guilds -> list of guilds the user is in,
    // so /callback can confirm real membership before granting the role.
    scope: 'identify guilds',
    state: signedState,
    prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function exchangeOAuthCode(code: string): Promise<OAuthTokenResponse> {
  const { discord } = loadConfig();
  const body = new URLSearchParams({
    client_id: discord.clientId,
    client_secret: discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: discord.redirectUri,
  });

  const response = await discordFetch('/oauth2/token', { method: 'POST', body });
  if (!response.ok) {
    throw new Error(`OAuth token exchange failed: ${response.status} ${await response.text()}`);
  }
  return response.json() as Promise<OAuthTokenResponse>;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
}

export async function getOAuthUser(accessToken: string): Promise<DiscordUser> {
  const response = await discordFetch('/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch OAuth user: ${response.status}`);
  }
  return response.json() as Promise<DiscordUser>;
}

interface OAuthGuild {
  id: string;
}

export async function userIsInGuild(accessToken: string, guildId: string): Promise<boolean> {
  const response = await discordFetch('/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch OAuth user guilds: ${response.status}`);
  }
  const guilds = (await response.json()) as OAuthGuild[];
  return guilds.some((g) => g.id === guildId);
}

export async function addVerifiedRole(guildId: string, userId: string, roleId: string): Promise<void> {
  const response = await discordFetch(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: 'PUT',
    asBot: true,
  });
  if (!response.ok) {
    throw new Error(`Failed to add role: ${response.status} ${await response.text()}`);
  }
}

export async function sendDirectMessage(userId: string, content: string): Promise<boolean> {
  const dmChannelRes = await discordFetch('/users/@me/channels', {
    method: 'POST',
    asBot: true,
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!dmChannelRes.ok) return false;

  const channel = (await dmChannelRes.json()) as { id: string };
  const messageRes = await discordFetch(`/channels/${channel.id}/messages`, {
    method: 'POST',
    asBot: true,
    body: JSON.stringify({ content }),
  });

  return messageRes.ok;
}

export async function registerGuildCommands(guildId: string, commands: unknown[]): Promise<void> {
  const { discord } = loadConfig();
  const response = await discordFetch(`/applications/${discord.clientId}/guilds/${guildId}/commands`, {
    method: 'PUT',
    asBot: true,
    body: JSON.stringify(commands),
  });
  if (!response.ok) {
    throw new Error(`Failed to register guild commands: ${response.status} ${await response.text()}`);
  }
}

export async function deferInteractionResponse(
  interactionId: string,
  interactionToken: string,
  ephemeral = true
): Promise<void> {
  const response = await discordFetch(`/interactions/${interactionId}/${interactionToken}/callback`, {
    method: 'POST',
    body: JSON.stringify({ type: 5, data: ephemeral ? { flags: 64 } : {} }),
  });
  if (!response.ok) {
    throw new Error(`Failed to defer interaction: ${response.status} ${await response.text()}`);
  }
}

export async function editInteractionResponse(interactionToken: string, content: string): Promise<void> {
  const { discord } = loadConfig();
  const response = await discordFetch(`/webhooks/${discord.clientId}/${interactionToken}/messages/@original`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    throw new Error(`Failed to edit interaction response: ${response.status} ${await response.text()}`);
  }
}


export async function postFallbackPrompt(channelId: string, userId: string, verifyUrl: string): Promise<void> {
  const response = await discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    asBot: true,
    body: JSON.stringify({
      content: `<@${userId}> I couldn't DM you your verification link — click below to get it instead.`,
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5, // link button
              label: 'Verify account',
              url: verifyUrl,
            },
          ],
        },
      ],
      allowed_mentions: { users: [userId] },
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to post fallback prompt: ${response.status} ${await response.text()}`);
  }
}