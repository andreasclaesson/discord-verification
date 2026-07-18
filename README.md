# discord-verification
 
Lightweight Discord server verification built without any Discord wrapper libraries.
Verification itself is instant: a user logs
in with Discord OAuth2, we confirm they're really a member of the server,
and grant them a role. An optional admin-only slash
command exists separately for re-sending links (see below).
 
## How it works
 
1. Someone joins the server → the bot creates a one-time verification token
   and DMs them a link (`/verify?token=...`).
2. If their DMs are closed, the bot posts a link button in a fallback channel
   instead.
3. The link sends them through Discord OAuth2
4. On callback, the web app checks:
   - the OAuth2 `state` param is genuinely one we signed,
   - the logged-in Discord account matches the one the DM was sent to,
   - that account is still actually in the guild.
5. If all three pass, the bot token grants the verified role. The web app
   never holds the bot token in the browser.
## Packages
 
- `packages/shared`: config loading, the SQLite schema/queries, and the
  Discord REST helpers (OAuth2 exchange, role grant, DMs).
- `packages/bot`: the gateway client (identify/heartbeat/resume) and the
  `GUILD_MEMBER_ADD` handler.
- `packages/web`: a tiny `node:http` server with the `/verify` and
  `/callback` routes.
## Setup

### 1. Create an application at the [Discord Developer Portal](https://discord.com/developers/applications).
   - **Bot** tab: create a bot, copy the token, enable the **Server Members
     Intent** (privileged, required for `GUILD_MEMBER_ADD`).
   - **OAuth2** tab: copy the Client ID/Secret, add a redirect matching
     `DISCORD_REDIRECT_URI`. (http&https)
   - Invite the bot with the `bot` and `applications.commands` scopes and
     these permissions: Manage Roles, Send Messages, Attach Files and Embed Links. Make sure the bot's
     role sits **above** the role it will be granting.
 
### Option A: Docker (recommended for self-hosting)
 
2. Copy `.env.example` to `.env` and fill it in. Leave `DATABASE_PATH` alone --
   `docker-compose.yml` overrides it to a shared volume automatically.
3. `docker compose up -d --build`
4. Register the slash commands once (see below), from inside the running bot
   container: `docker compose exec bot node packages/bot/dist/registerCommands.js`, or run `npm run register-commands` locally with the same `.env`.
Both `bot` and `web` run as separate containers from the same image (see
`Dockerfile`), sharing one SQLite file via a named volume. `web` exposes
`/healthz` and has a Docker healthcheck wired to it already.
 
### Option B: Run directly with Node
 
2. Copy `.env.example` to `.env` and fill it in.
3. `npm install`
4. `npm run build`
5. `npm run register-commands` (from `packages/bot`, or via the root once,
   registers `/reverify`; guild commands propagate within seconds).
6. `npm run dev:bot` and `npm run dev:web` (separate processes/terminals).

## Slash commands
 
- **`/reverify member:@user`** (requires Manage Roles or Administrator),
  generates a fresh verification link for a member and DMs it to them,
  falling back to an ephemeral reply with the raw link if their DMs are closed.
  Useful if someone's original link expired or they missed the DM.

## Operational notes
 
- **`GET /healthz`** on the web server returns `200` with a DB connectivity
  check, or `503` if the database is unreachable. Not authenticated,
  intended for uptime monitoring / container healthchecks, not for exposing
  sensitive info.
- **Graceful shutdown**: both `bot` and `web` handle `SIGTERM`/`SIGINT`,
  closing the WebSocket/HTTP server and the SQLite connection cleanly before
  exiting, with a 10s hard-exit fallback if something hangs. This matters
  for `docker compose down`/restarts and orchestrators that send `SIGTERM`
  before killing a container.

## Notes for self-hosters
 
- The verified role must be below the bot's own role in the server's role
  list, or the `PUT .../roles/{roleId}` call will 403.
- If your bot is or grows past 100 servers, the Server Members privileged
  intent needs to be approved by Discord in the verification process before
  it'll work in production.
- `PUBLIC_BASE_URL` must be reachable from a user's browser (not
  `localhost`) once you're not testing locally, put the web package behind
  a reverse proxy with TLS.

## TODO

- Add multi-guild support so the bot can handle verification flows for more
  than one Discord server at a time.
