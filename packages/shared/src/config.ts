import { loadRootEnv, repoRoot } from './envLoader.js';
import { isAbsolute, resolve } from 'node:path';

loadRootEnv();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

function resolveDbPath(rawPath: string): string {
  return isAbsolute(rawPath) ? rawPath : resolve(repoRoot(), rawPath);
}

export interface AppConfig {
  discord: {
    botToken: string;
    clientId: string;
    clientSecret: string;
    // must exactly match a redirect URI registered in the Discord Developer Portal.
    redirectUri: string;
    apiBaseUrl: string;
    gatewayVersion: string;
  };
  guild: {
    guildId: string;
    verifiedRoleId: string;
    fallbackChannelId: string;
  };
  verification: {
    tokenTtlMinutes: number;
    stateSecret: string;
  };
  db: {
    path: string;
  };
  web: {
    port: number;
    publicBaseUrl: string;
    trustProxy: boolean;
  };
}

let cached: AppConfig | undefined;

export function loadConfig(): AppConfig {
  if (cached) return cached;

  cached = {
    discord: {
      botToken: required('DISCORD_BOT_TOKEN'),
      clientId: required('DISCORD_CLIENT_ID'),
      clientSecret: required('DISCORD_CLIENT_SECRET'),
      redirectUri: required('DISCORD_REDIRECT_URI'),
      apiBaseUrl: optional('DISCORD_API_BASE_URL', 'https://discord.com/api/v10'),
      gatewayVersion: optional('DISCORD_GATEWAY_VERSION', '10'),
    },
    guild: {
      guildId: required('GUILD_ID'),
      verifiedRoleId: required('VERIFIED_ROLE_ID'),
      fallbackChannelId: required('FALLBACK_CHANNEL_ID'),
    },
    verification: {
      tokenTtlMinutes: Number(optional('TOKEN_TTL_MINUTES', '30')),
      stateSecret: required('STATE_SECRET'),
    },
    db: {
      path: resolveDbPath(optional('DATABASE_PATH', './data/verification.sqlite')),
    },
    web: {
      port: Number(optional('WEB_PORT', '3000')),
      publicBaseUrl: required('PUBLIC_BASE_URL'),
      trustProxy: optional('TRUST_PROXY', 'false') === 'true',
    },
  };

  return cached;
}