import {
    loadConfig,
    createPendingVerification,
    sendDirectMessage,
    deferInteractionResponse,
    editInteractionResponse,
} from '@discord-verification/shared';
import { REVERIFY_COMMAND_NAME } from '../commands.js';

interface InteractionOption {
    name: string;
    value?: string;
}

interface InteractionData {
    name: string;
    options?: InteractionOption[];
}

interface Interaction {
    id: string;
    token: string;
    guild_id?: string;
    member?: { permissions?: string };
    data?: InteractionData;
}

// same bit as commands.ts's default_member_permissions, Discord already hides the command from members without this, but permission changes can take a moment to propagate through Discord's cache, so we check again here.
const MANAGE_ROLES_BIT = 1n << 28n;
const ADMINISTRATOR_BIT = 1n << 3n;

function hasManageRoles(permissions?: string): boolean {
    if (!permissions) return false;
    try {
        const bits = BigInt(permissions);
        // administrator implicitly has every permission in Discord's own model, check for it explicitly, or an admin-only member gets wrongly rejected, here despite Discord already showing them the command.
        return (bits & MANAGE_ROLES_BIT) === MANAGE_ROLES_BIT || (bits & ADMINISTRATOR_BIT) === ADMINISTRATOR_BIT;
    } catch {
        return false; // malformed permissions string -- fail closed
    }
}

export async function handleInteractionCreate(data: unknown): Promise<void> {
    const interaction = data as Interaction;

    if (interaction.data?.name !== REVERIFY_COMMAND_NAME) return;

    const { guild, web } = loadConfig();

    if (interaction.guild_id !== guild.guildId) return; // command fired in an unexpected guild, ignore

    if (!hasManageRoles(interaction.member?.permissions)) {
        await deferInteractionResponse(interaction.id, interaction.token);
        await editInteractionResponse(interaction.token, "You don't have permission to use this command.");
        return;
    }

    const targetUserId = interaction.data?.options?.find((o) => o.name === 'member')?.value;
    if (!targetUserId) {
        await deferInteractionResponse(interaction.id, interaction.token);
        await editInteractionResponse(interaction.token, 'No member specified.');
        return;
    }

    // defer immediately -- DMing the user + DB writes can take longer than discord's 3s interaction ack window.
    await deferInteractionResponse(interaction.id, interaction.token);

    try {
        const pending = createPendingVerification(guild.guildId, targetUserId);
        const verifyUrl = `${web.publicBaseUrl}/verify?token=${pending.token}`;

        const dmSent = await sendDirectMessage(
            targetUserId,
            `An admin has requested you re-verify your account: ${verifyUrl}`
        );

        await editInteractionResponse(
            interaction.token,
            dmSent
                ? `Sent a new verification link to <@${targetUserId}>.`
                : `Couldn't DM <@${targetUserId}> (their DMs are closed). Share this link with them manually: ${verifyUrl}`
        );
    } catch (err) {
        console.error('[reverify] failed:', err);
        await editInteractionResponse(interaction.token, 'Something went wrong sending the verification link.');
    }
}