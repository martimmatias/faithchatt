/**
* Builds a stand-in for the "moderator" side of an interaction. The jail
* commands only ever read permissions/nickname/user off of this object -
* every Discord-side effect (role changes, channel creation) happens on the
* real target member instead, so this never needs to be a real GuildMember.
*
* @param {{id?: string, tag?: string}} [overrides]
*/
function createModerator(overrides = {}) {
    return {
        nickname: "E2E Moderator",
        permissions: { has: () => true },
        user: {
            id: overrides.id || "100000000000000000",
            tag: overrides.tag || "E2E Moderator#0001",
        },
    };
}

/**
* Builds a minimal stand-in for a discord.js ChatInputCommandInteraction,
* wired to a real guild/channel so command code that touches Discord (role
* changes, channel creation, sending messages) runs for real. Only the
* interaction-reply transport (reply/followUp) is faked, since there is no
* real Discord interaction backing this call - the test drives the command's
* execute() function directly.
*
* @param {{guild: import("discord.js").Guild, channel: (import("discord.js").TextChannel|null), moderator: object, optionValues?: Record<string, {value?: *, member?: *}>}} params
*/
function createInteraction({ guild, channel, moderator, optionValues = {} }) {
    const replies = [];

    return {
        guild,
        channel,
        member: moderator,
        user: moderator.user,
        options: {
            get(name) {
                return optionValues[name] || null;
            },
        },
        replies,
        async reply(payload) {
            replies.push({ kind: "reply", payload });
            return payload;
        },
        async followUp(payload) {
            replies.push({ kind: "followUp", payload });
            return payload;
        },
    };
}

module.exports = { createModerator, createInteraction };
