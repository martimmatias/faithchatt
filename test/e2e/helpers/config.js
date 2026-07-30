require("dotenv").config({ quiet: true });

const REQUIRED_VARS = [
    "TOKEN",
    "MONGO_URL",
    "E2E_GUILD_ID",
    "E2E_TARGET_USER_ID",
    "E2E_ROLE_MEMBER_ID",
    "E2E_ROLE_MUTED_ID",
    "E2E_ROLE_MODERATOR_ID",
    "E2E_ROLE_UNVERIFIED_ID",
    "E2E_CATEGORY_JAIL_ID",
    "E2E_CHANNEL_MOD_LOG_ID",
    "E2E_CHANNEL_JAIL_LOG_ID",
];

/**
* Reads the E2E test environment and reports whether every variable
* the jail lifecycle test needs is present. Callers should skip the
* suite (rather than fail it) when `ready` is false, since this
* environment is only available to whoever owns the test server.
*
* @returns {{ready: boolean, missing: string[], token: string, mongoUrl: string, guildId: string, targetUserId: string, roleIds: {member: string, muted: string, moderator: string, unverified: string}, categoryJailId: string, channelIds: {modLog: string, jailLog: string, jailedRules: (string|null)}}}
*/
function loadConfig() {
    const missing = REQUIRED_VARS.filter(name => !process.env[name]);

    return {
        ready: missing.length === 0,
        missing,
        token: process.env.TOKEN,
        mongoUrl: process.env.MONGO_URL,
        guildId: process.env.E2E_GUILD_ID,
        targetUserId: process.env.E2E_TARGET_USER_ID,
        roleIds: {
            member: process.env.E2E_ROLE_MEMBER_ID,
            muted: process.env.E2E_ROLE_MUTED_ID,
            moderator: process.env.E2E_ROLE_MODERATOR_ID,
            unverified: process.env.E2E_ROLE_UNVERIFIED_ID,
        },
        categoryJailId: process.env.E2E_CATEGORY_JAIL_ID,
        channelIds: {
            modLog: process.env.E2E_CHANNEL_MOD_LOG_ID,
            jailLog: process.env.E2E_CHANNEL_JAIL_LOG_ID,
            jailedRules: process.env.E2E_CHANNEL_JAILED_RULES_ID || null,
        },
    };
}

module.exports = { loadConfig };
