/** Builds the URL to send a user to for OAuth2 login. */
export declare function buildAuthorizeUrl(signedState: string): string;
export interface OAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
}
export declare function exchangeOAuthCode(code: string): Promise<OAuthTokenResponse>;
export interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
}
export declare function getOAuthUser(accessToken: string): Promise<DiscordUser>;
export declare function userIsInGuild(accessToken: string, guildId: string): Promise<boolean>;
export declare function addVerifiedRole(guildId: string, userId: string, roleId: string): Promise<void>;
export declare function sendDirectMessage(userId: string, content: string): Promise<boolean>;
export declare function postFallbackPrompt(channelId: string, userId: string, verifyUrl: string): Promise<void>;
