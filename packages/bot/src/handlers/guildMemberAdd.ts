import {
  loadConfig,
  createPendingVerification,
  isUserVerified,
  sendDirectMessage,
  postFallbackPrompt,
} from '@discord-verification/shared';

interface GuildMemberAddPayload {
  guild_id: string;
  user?: { id: string; bot?: boolean };
}

export async function handleGuildMemberAdd(data: unknown): Promise<void> {
  const payload = data as GuildMemberAddPayload;
  const { guild, web } = loadConfig();

  // TODO: multiple guild support -- this bot is currently hardcoded to a single guild.
  if (payload.guild_id !== guild.guildId) return; // not our configured server
  if (!payload.user || payload.user.bot) return; // ignore other bots joining

  const userId = payload.user.id;

  if (isUserVerified(guild.guildId, userId)) {
    // already verified before (e.g. rejoining) -- nothing to do here.
    // re-granting the role, if desired, is a separate "welcome back" feature.
    return;
  }

  const pending = createPendingVerification(guild.guildId, userId);
  const verifyUrl = `${web.publicBaseUrl}/verify?token=${pending.token}`;

  const dmSent = await sendDirectMessage(
    userId,
    `Welcome! Please verify your account to get access to the server: ${verifyUrl}\n` +
      `This link expires in a while, so verify soon.`
  );

  if (!dmSent) {
    await postFallbackPrompt(guild.fallbackChannelId, userId, verifyUrl);
  }
}
