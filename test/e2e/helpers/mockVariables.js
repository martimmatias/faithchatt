const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..", "..", "..");

/**
* Points the jail module's server-configuration imports (variables/Categories.js,
* variables/Roles.js, variables/TextChannel.js) at the IDs of the test server
* instead of the hardcoded FaithChatt production IDs, by pre-seeding
* require.cache before anything requires them.
*
* Must run before the jail commands/utils are required for the first time in
* this process - once a module is cached, this override has no effect on it.
*
* @param {ReturnType<import("./config.js")["loadConfig"]>} config
*/
function injectFakeConfig(config) {
    const fakeExports = {
        [path.join(REPO_ROOT, "variables", "Categories.js")]: {
            jail: config.categoryJailId,
            verification: config.categoryJailId,
        },
        [path.join(REPO_ROOT, "variables", "Roles.js")]: {
            unverified: config.roleIds.unverified,
            member: config.roleIds.member,
            muted: config.roleIds.muted,
            moderator: config.roleIds.moderator,
        },
        [path.join(REPO_ROOT, "variables", "TextChannel.js")]: {
            modLog: config.channelIds.modLog,
            jailLog: config.channelIds.jailLog,
            jailedRules: config.channelIds.jailedRules,
        },
    };

    for (const [absolutePath, exportsValue] of Object.entries(fakeExports)) {
        const resolved = require.resolve(absolutePath);
        require.cache[resolved] = {
            id: resolved,
            filename: resolved,
            loaded: true,
            exports: exportsValue,
        };
    }
}

module.exports = { injectFakeConfig };
