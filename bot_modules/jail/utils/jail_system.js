const { PermissionsBitField, ChannelType, Collection, AttachmentBuilder } = require("discord.js");
const moment = require("moment");
const { parentId, rolesId, textId } = require("../../../utils/variables");
const perm = PermissionsBitField.Flags;

const jailSystem = {
    /**
    * Creates a jail channel for a member in a specific guild.
    *
    * @param {import("discord.js").Guild} guild - The guild on which the channel will be created.
    * @param {import("discord.js").GuildMember} jailedMember - The member who will be jailed.
    * @return {Promise<import("discord.js").TextChannel>} A promise that resolves when the channel is created.
    */
    createJailChannel(guild, jailedMember) {
        const memberRole = guild.roles.cache.get(rolesId.member);
        const mutedRole = guild.roles.cache.get(rolesId.muted);
        const moderatorRole = guild.roles.cache.get(rolesId.moderator);
        const everyone = guild.roles.cache.find(r => r.name === "@everyone");

        return guild.channels.create({
            name: `jail-${jailedMember.user.tag}`,
            type: ChannelType.GuildText,
            parent: parentId.jail,
            topic: jailedMember.user.id,
            permissionOverwrites: [
                { id: jailedMember.user.id, allow: [perm.ViewChannel, perm.ReadMessageHistory, perm.SendMessages], deny: [perm.ManageChannels, perm.EmbedLinks, perm.AttachFiles, perm.CreatePublicThreads, perm.CreatePrivateThreads, perm.CreateInstantInvite, perm.SendMessagesInThreads, perm.ManageThreads, perm.ManageMessages, perm.UseExternalEmojis, perm.UseExternalStickers, perm.UseApplicationCommands, perm.ManageWebhooks, perm.ManageRoles, perm.SendTTSMessages] },
                { id: mutedRole.id, deny: [perm.EmbedLinks, perm.AttachFiles] },
                { id: memberRole.id, deny: [perm.ViewChannel] },
                { id: moderatorRole.id, allow: [perm.ViewChannel, perm.SendMessages, perm.ReadMessageHistory] },
                { id: everyone.id, deny: [perm.ViewChannel] },
            ],
        });
    },

    /**
    * Removes roles from a guild member (except muted/unverified/managed roles) and adds the muted role.
    *
    * @param {import("discord.js").Guild} guild - The guild from which to remove roles.
    * @param {import("discord.js").GuildMember} jailedMember - The member whose roles are to be removed.
    * @return {Promise<string[]>} A promise that resolves with the IDs of the roles that were removed, so they can be restored later.
    */
    async removeRoles(guild, jailedMember) {
        const unverifiedRole = guild.roles.cache.get(rolesId.unverified);
        const mutedRole = guild.roles.cache.get(rolesId.muted);

        const userRoles = jailedMember.roles.cache.filter(role => role.id !== mutedRole.id && role.id !== unverifiedRole.id && role.managed !== true);
        const removedRoleIds = [...userRoles.keys()];

        await jailedMember.roles.add(mutedRole);
        await jailedMember.roles.remove(userRoles);

        return removedRoleIds;
    },

    /**
    * Restores previously removed roles to a guild member and removes the muted role.
    *
    * @param {import("discord.js").Guild} guild - The guild on which to restore roles.
    * @param {import("discord.js").GuildMember} unjailedMember - The member whose roles are to be restored.
    * @param {string[]} removedRoleIds - The role IDs captured by removeRoles() when the member was jailed.
    * @return {Promise<void>} A promise that resolves when the roles are restored.
    */
    async restoreRoles(guild, unjailedMember, removedRoleIds) {
        const mutedRole = guild.roles.cache.get(rolesId.muted);
        const memberRole = guild.roles.cache.get(rolesId.member);

        const rolesToRestore = (removedRoleIds || [])
            .map(roleId => guild.roles.cache.get(roleId))
            .filter(role => role != null);

        // Legacy jail records have no snapshot to restore from; fall back to the base member role
        // rather than leaving the member with no roles at all.
        if (rolesToRestore.length === 0) {
            rolesToRestore.push(memberRole);
        }

        await unjailedMember.roles.add(rolesToRestore);
        await unjailedMember.roles.remove(mutedRole);
    },

    /**
    * Fetches the full message history of a jail channel and posts a transcript to the jail log channel.
    * Intended to be called right before a jail channel is deleted, so its contents aren't lost.
    *
    * @param {import("discord.js").TextChannel} channel - The jail channel to log.
    * @param {import("discord.js").EmbedBuilder} [summaryEmbed] - An embed summarizing the closure to attach to the log entry.
    * @return {Promise<void>} A promise that resolves once the transcript has been posted.
    */
    async logTranscript(channel, summaryEmbed) {
        const logChannel = channel.client.channels.cache.get(textId.jailLog);
        if (!logChannel) return;

        let messageCollection = new Collection();
        let channelMessages = await channel.messages.fetch({ limit: 100 }).catch(err => console.error(err));
        messageCollection = messageCollection.concat(channelMessages);
        while (channelMessages && channelMessages.size === 100) {
            const lastMessageId = channelMessages.lastKey();
            channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId }).catch(err => console.error(err));
            if (channelMessages) {
                messageCollection = messageCollection.concat(channelMessages);
            }
        }

        const msgs = messageCollection.filter(msg => !msg.length).reverse();
        const text = msgs.map(m => `${m.author.tag}: ${m.content}`).join("\n");

        if (text.length >= 2000) {
            const timestamp = moment().format("M-D-YYYY, HH:mm");
            const fileAttach = new AttachmentBuilder(Buffer.from(text), {
                name: `JailLog - ${timestamp}.txt`,
            });
            await logChannel.send({
                content: "Channel is over 2000 characters. Thus, a generated file.",
                embeds: summaryEmbed ? [summaryEmbed] : [],
                files: [fileAttach],
            });
        }
        else {
            await logChannel.send({
                content: text.length > 0 ? `\`\`\`\n${text}\`\`\`` : undefined,
                embeds: summaryEmbed ? [summaryEmbed] : [],
            });
        }
    },
};

module.exports = jailSystem;
