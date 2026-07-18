export interface AppConfig {
    discord: {
        botToken: string;
        clientId: string;
        clientSecret: string;
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
    };
}
export declare function loadConfig(): AppConfig;
