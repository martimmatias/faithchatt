const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { PermissionsBitField } = require("discord.js");

const { loadConfig } = require("./helpers/config.js");
const { injectFakeConfig } = require("./helpers/mockVariables.js");
const { createTestClient, connectMongo } = require("./helpers/testClient.js");
const { createModerator, createInteraction } = require("./helpers/fakeInteraction.js");

const perm = PermissionsBitField.Flags;
const config = loadConfig();

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Runs the real jail commands (bot_modules/jail/commands/mod/*.js) against a
// real Discord test server and a real MongoDB, end to end: /jail -> the
// ticket gets manipulated -> /closejail (and, separately, /unjail). Nothing
// about the jail feature itself is mocked; only the interaction's reply
// transport is faked, since there is no real slash-command invocation behind
// this run. See test/e2e/README.md for how to point this at your own test
// server. Requires MONGO_URL, TOKEN and the E2E_* variables listed in
// helpers/config.js - the whole suite is skipped (not failed) when they are
// missing, so this never blocks contributors who haven't set up a test server.
test("jail feature end-to-end lifecycle", {
    timeout: 120_000,
    skip: config.ready ? false : `missing e2e env vars: ${config.missing.join(", ")} (see test/e2e/README.md)`,
}, async (t) => {
    injectFakeConfig(config);

    // Required only after injectFakeConfig() has seeded require.cache, so the
    // jail module picks up the test server's IDs instead of the hardcoded
    // production ones.
    const jailCommand = require("../../bot_modules/jail/commands/mod/jail.js");
    const unjailCommand = require("../../bot_modules/jail/commands/mod/unjail.js");
    const closejailCommand = require("../../bot_modules/jail/commands/mod/closejail.js");
    const jailModel = require("../../bot_modules/jail/models/jailsystem.js");

    const client = await createTestClient(config.token);
    await connectMongo(config.mongoUrl);

    const guild = await client.guilds.fetch(config.guildId);
    await guild.roles.fetch();
    await guild.channels.fetch();

    const moderator = createModerator();

    async function fetchTarget() {
        return guild.members.fetch({ user: config.targetUserId, force: true });
    }

    async function findLeftoverJailChannel() {
        return guild.channels.cache.find(channel =>
            channel.parentId === config.categoryJailId && channel.topic === config.targetUserId);
    }

    // Puts the target member back to a known baseline before a scenario runs:
    // no jail record, no leftover ticket channel, muted role off, holding
    // exactly the "member" role so the jail flow has something real to strip
    // and later restore.
    async function resetTarget() {
        await jailModel.deleteMany({ userId: config.targetUserId });

        const leftoverChannel = await findLeftoverJailChannel();
        if (leftoverChannel) await leftoverChannel.delete().catch(() => null);

        const member = await fetchTarget();
        const rolesToStrip = member.roles.cache.filter(role => role.id !== guild.id);
        if (rolesToStrip.size > 0) await member.roles.remove(rolesToStrip);
        await member.roles.add(config.roleIds.member);

        return fetchTarget();
    }

    t.after(async () => {
        await resetTarget().catch(err => console.error("e2e cleanup failed:", err));
        await mongoose.disconnect();
        await client.destroy();
    });

    await resetTarget();

    let jailChannelId;

    await t.test("creates a jail ticket: strips roles, mutes, opens the ticket channel, and records it", async () => {
        const targetMember = await fetchTarget();
        const interaction = createInteraction({
            guild,
            channel: null,
            moderator,
            optionValues: {
                user: { member: targetMember },
                reason: { value: "E2E test: automated jail ticket creation" },
            },
        });

        await jailCommand.execute(interaction);

        assert.ok(interaction.replies.length >= 2, "expected an initial reply and a follow-up");

        const jailData = await jailModel.findOne({ userId: config.targetUserId });
        assert.ok(jailData, "expected a jail record to be created");
        assert.ok(jailData.removedRoles.includes(config.roleIds.member), "expected the member role to be captured for later restoration");
        jailChannelId = jailData.textChannel;

        const jailedMember = await fetchTarget();
        assert.ok(jailedMember.roles.cache.has(config.roleIds.muted), "expected the target to hold the muted role");
        assert.ok(!jailedMember.roles.cache.has(config.roleIds.member), "expected the member role to have been stripped");

        const channel = await guild.channels.fetch(jailChannelId);
        assert.equal(channel.parentId, config.categoryJailId, "expected the ticket to live in the jail category");
        assert.equal(channel.topic, config.targetUserId, "expected the channel topic to carry the jailed user's id");

        const targetOverwrite = channel.permissionOverwrites.cache.get(config.targetUserId);
        assert.ok(targetOverwrite.allow.has(perm.SendMessages), "expected the jailed member to be able to send messages in their own ticket");
        assert.ok(targetOverwrite.deny.has(perm.ManageChannels), "expected the jailed member to be denied channel management");

        const mutedOverwrite = channel.permissionOverwrites.cache.get(config.roleIds.muted);
        assert.ok(mutedOverwrite.deny.has(perm.EmbedLinks), "expected the muted role to be denied embeds in the ticket");

        const memberOverwrite = channel.permissionOverwrites.cache.get(config.roleIds.member);
        assert.ok(memberOverwrite.deny.has(perm.ViewChannel), "expected regular members to not see the ticket");

        const moderatorOverwrite = channel.permissionOverwrites.cache.get(config.roleIds.moderator);
        assert.ok(moderatorOverwrite.allow.has(perm.ViewChannel), "expected moderators to see the ticket");

        const everyoneOverwrite = channel.permissionOverwrites.cache.get(guild.id);
        assert.ok(everyoneOverwrite.deny.has(perm.ViewChannel), "expected the ticket to be hidden from @everyone");
    });

    await t.test("rejects a second /jail attempt while the member is already jailed", async () => {
        const targetMember = await fetchTarget();
        const interaction = createInteraction({
            guild,
            channel: null,
            moderator,
            optionValues: {
                user: { member: targetMember },
                reason: { value: "E2E test: duplicate jail attempt" },
            },
        });

        await jailCommand.execute(interaction);

        assert.equal(interaction.replies.length, 1, "expected a single error reply, no channel/database work");
        const errorEmbed = interaction.replies[0].payload.embeds[0];
        assert.match(errorEmbed.data.description, /already been jailed/i);

        const jailData = await jailModel.findOne({ userId: config.targetUserId });
        assert.equal(jailData.textChannel, jailChannelId, "expected the original ticket channel to be untouched");
    });

    await t.test("manipulating the ticket: messages sent in it show up in the close transcript, then /closejail tears it down", async () => {
        const channel = await guild.channels.fetch(jailChannelId);
        const manipulationMarker = `e2e-manipulation-${Date.now()}`;
        await channel.send(`Automated e2e test message ${manipulationMarker}`);

        const jailLogChannelBefore = await guild.channels.fetch(config.channelIds.jailLog);
        const messagesBefore = await jailLogChannelBefore.messages.fetch({ limit: 1 });
        const lastLogMessageIdBefore = messagesBefore.first()?.id ?? null;

        const interaction = createInteraction({ guild, channel, moderator });
        await closejailCommand.execute(interaction);

        assert.equal(interaction.replies.length, 1);
        assert.match(interaction.replies[0].payload, /closes in five seconds/i);

        const jailDataAfterClose = await jailModel.findOne({ userId: config.targetUserId });
        assert.equal(jailDataAfterClose, null, "expected the jail record to be removed as soon as /closejail runs");

        const jailLogChannelAfter = await guild.channels.fetch(config.channelIds.jailLog);
        const messagesAfter = await jailLogChannelAfter.messages.fetch({ limit: 5 });
        const transcriptMessage = messagesAfter.find(msg => msg.content.includes(manipulationMarker));
        assert.ok(transcriptMessage, "expected the transcript logged before deletion to include the manipulated message");
        assert.notEqual(transcriptMessage.id, lastLogMessageIdBefore);

        // /closejail deletes the channel 5s after replying.
        await wait(7000);
        const deletedChannel = await guild.channels.fetch(jailChannelId, { force: true }).catch(() => null);
        assert.equal(deletedChannel, null, "expected the ticket channel to have been deleted automatically");
    });

    await t.test("/unjail restores the member's original roles without deleting the ticket channel", async () => {
        await resetTarget();

        const setupInteraction = createInteraction({
            guild,
            channel: null,
            moderator,
            optionValues: {
                user: { member: await fetchTarget() },
                reason: { value: "E2E test: setup for /unjail" },
            },
        });
        await jailCommand.execute(setupInteraction);

        const jailData = await jailModel.findOne({ userId: config.targetUserId });
        const channel = await guild.channels.fetch(jailData.textChannel);

        const unjailInteraction = createInteraction({
            guild,
            channel,
            moderator,
            optionValues: { user: { member: await fetchTarget() } },
        });
        await unjailCommand.execute(unjailInteraction);

        const jailDataAfterUnjail = await jailModel.findOne({ userId: config.targetUserId });
        assert.equal(jailDataAfterUnjail, null, "expected the jail record to be removed by /unjail");

        const unjailedMember = await fetchTarget();
        assert.ok(!unjailedMember.roles.cache.has(config.roleIds.muted), "expected the muted role to be removed");
        assert.ok(unjailedMember.roles.cache.has(config.roleIds.member), "expected the original member role to be restored");

        const channelAfterUnjail = await guild.channels.fetch(channel.id).catch(() => null);
        assert.ok(channelAfterUnjail, "expected /unjail to leave the ticket channel in place");

        await channelAfterUnjail.delete().catch(() => null);
    });
});
