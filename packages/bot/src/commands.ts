const MANAGE_ROLES_PERMISSION = 1 << 28;
export const REVERIFY_COMMAND_NAME = 'reverify';

export const commandDefinitions = [
    {
        name: REVERIFY_COMMAND_NAME,
        description: 'Send a member a fresh verification link',
        type: 1, // CHAT_INPUT
        default_member_permissions: String(MANAGE_ROLES_PERMISSION),
        dm_permission: false,
        options: [
            {
                type: 6, // USER
                name: 'member',
                description: 'The member to re-verify',
                required: true,
            },
        ],
    },
];