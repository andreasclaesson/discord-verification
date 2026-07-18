# discord-verification

Lightweight Discord server verification. No pre-made "filled" library. Verification is instant: a user logs in with Discord OAuth2, we
confirm they're really a member of the server, and grant them a role
server-side. No codes to copy, no slash commands.

## How the project currently works

1. Someone joins your guild, the bot creates a one-time verification token
   and DMs them a link.
2. If users DMs are closed, the bot posts a link button in a fallback channel
   instead.
3. The link sends them through Discord OAuth2.
4. On callback, the web app checks:
   - the OAuth2 `state` param is genuinely one we signed,
   - the logged-in Discord account matches the one the DM was sent to,
   - that account is still actually in the guild.
5. If all three pass, the bot token grants the verified role. The web app
   never holds the bot token in the browser, only the server process does.

## Setup

1. Create an application at the
   [Discord Developer Portal](https://discord.com/developers/applications).
   - **Bot** tab: create a bot, copy the token, enable the **Server Members
     Intent** (privileged, required for `GUILD_MEMBER_ADD`).
   - **OAuth2** tab: copy the Client ID/Secret, add a redirect matching
     `DISCORD_REDIRECT_URI` (http & https just in case).
   - Invite the bot with the `bot` scope and these permissions: Manage
     Roles, Send Messages, Embed Links, Attach Files.
     Make sure the bot's role sits **above** the role it will be granting.
2. Copy `.env.example` to `.env` and fill all values in.
3. `npm install`
4. `npm run build`
5. `npm run dev:bot` and `npm run dev:web` (separate processes/terminals).

## Notes for self-hosters

- The verified role must be below the bot's own role in the server's role
  list, or the `PUT .../roles/{roleId}` call will 403.
- If your bot is or grows past 100 servers, the Server Members privileged
  intent needs to be approved by Discord in the verification process before
  it'll work in production.
- `PUBLIC_BASE_URL` must be reachable from a user's browser (not
  `localhost`) once you're not testing locally, put the web package behind
  a reverse proxy with TLS.
