const { SlashCommandBuilder, PermissionsBitField, RESTJSONErrorCodes } = require("discord.js");
const { textId, errorMessages } = require("../../../../utils/variables.js");
const jailModel = require("../../models/jailsystem.js");
const embedFactory = require("../../../../utils/embedFactory.js");
const jailSystem = require("../../utils/jail_system.js");
const perm = PermissionsBitField.Flags;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jail")
        .setDescription("Jails a member breaking the rules")
        .addUserOption(option => option.setName("user").setDescription("User to be jailed").setRequired(true))
        .addStringOption(option => option.setName("reason").setDescription("Reason for user to be jailed").setRequired(true)),
    /**
    * @param {import("discord.js").ChatInputCommandInteraction} interaction
    * @returns
    */
    async execute(interaction) {
        const jailedMember = await interaction.options.get("user").member;
        const reason = await interaction.options.get("reason").value;

        const modPerms = interaction.member.permissions.has(perm.BanMembers || perm.KickMembers);
        if (!modPerms) {
            return interaction.reply({
                embeds: [
                    embedFactory.createErrorEmbed(errorMessages.notAuthorized),
                ],
                ephemeral: true,
            });
        }

        const modLogChannel = interaction.guild.channels.cache.get(textId.modLog);

        const jailData = await jailModel.findOne({ userId: jailedMember.user.id });
        if (!jailData) {
            let jailChannel;
            let newJailData;

            try {
                await interaction.reply({
                    embeds: [
                        embedFactory.createJailEmbed(embedFactory.JailEmbedType.JailBeingSetup, interaction.user, jailedMember, reason, null),
                    ],
                    ephemeral: true,
                });

                const removedRoleIds = await jailSystem.removeRoles(interaction.guild, jailedMember);

                jailChannel = await jailSystem.createJailChannel(interaction.guild, jailedMember);

                newJailData = await jailModel.create({
                    userId: jailedMember.user.id,
                    userName: jailedMember.user.tag,
                    textChannel: jailChannel.id,
                    removedRoles: removedRoleIds,
                });
                newJailData.save();

                console.log(`🚨 Member has been jailed:\nMember: ${jailedMember.user.tag}\nReason: ${reason}`);

                try {
                    // DM jailed user
                    await jailedMember.send({
                        embeds: [
                            embedFactory.createJailEmbed(embedFactory.JailEmbedType.JailedUserFacing, interaction.user, jailedMember, reason, jailChannel),
                        ],
                    });
                }
                catch (err) {
                    if (err.code == RESTJSONErrorCodes.CannotSendMessagesToThisUser) {
                        console.log(`Could not DM ${jailedMember.user.username} (${jailedMember.user.id}). Are their DMs closed?`);
                        interaction.followUp({
                            embeds: [
                                embedFactory.createWarningEmbed(`Could not DM user. Maybe their DMs are closed?`, `UID: ${jailedMember.user.id}`),
                            ],
                            ephemeral: true,
                        });
                    }
                    else {
                        console.error(err);
                    }
                }

                // Send embed in jail mod logs
                await modLogChannel.send({
                    embeds: [
                        embedFactory.createJailEmbed(embedFactory.JailEmbedType.JailedModLog, interaction.user, jailedMember, reason, jailChannel),
                    ],
                });

                // Send embed in jail channel
                await jailChannel.send({
                    content: `${jailedMember}`,
                    embeds: [
                        embedFactory.createJailEmbed(embedFactory.JailEmbedType.JailChannelIntroduction, interaction.user, jailedMember, reason, jailChannel),
                    ],
                }).catch(err => console.error(err));

                // Ping the moderator and delete it after 3s
                await jailChannel.send({ content: `${interaction.user}` }).then(msg => {
                    setTimeout(() => msg.delete().catch(err => console.error(err)), 3000);
                });

                // Followup initial setup message to indicate success
                await interaction.followUp({
                    embeds: [
                        embedFactory.createJailEmbed(embedFactory.JailEmbedType.JailCreated, interaction.user, jailedMember, reason, jailChannel),
                    ],
                    ephemeral: true,
                }).catch(err => console.error(err));
            }
            catch (err) {
                console.log(err);
                if (newJailData) {
                    await newJailData.deleteOne({ "_id": newJailData.id }).catch(err => console.error(err));
                }
                if (jailChannel) {
                    await jailChannel.delete().catch(err => console.error(err));
                }

                // Send error embed
                await interaction.followUp({
                    embeds: [
                        embedFactory.createErrorEmbed(errorMessages.internalError),
                    ],
                }).catch(err => console.error(err));
            }
        }
        else {
            const existingChannel = interaction.guild.channels.cache.get(jailData.textChannel);

            if (existingChannel) {
                return interaction.reply({
                    embeds: [
                        embedFactory.createErrorEmbed(errorMessages.userAlreadyJailed),
                    ],
                    ephemeral: true,
                });
            }

            // The jail record exists but its ticket channel is gone (manually deleted, bot downtime, etc).
            // Recreate the channel instead of silently doing nothing, since the member is still muted.
            try {
                const jailChannel = await jailSystem.createJailChannel(interaction.guild, jailedMember);
                jailData.textChannel = jailChannel.id;
                await jailData.save();

                await jailChannel.send({
                    content: `${jailedMember}`,
                    embeds: [
                        embedFactory.createJailEmbed(embedFactory.JailEmbedType.JailChannelIntroduction, interaction.user, jailedMember, reason, jailChannel),
                    ],
                }).catch(err => console.error(err));

                return interaction.reply({
                    embeds: [
                        embedFactory.createJailEmbed(embedFactory.JailEmbedType.JailCreated, interaction.user, jailedMember, reason, jailChannel),
                    ],
                    ephemeral: true,
                });
            }
            catch (err) {
                console.error(err);
                return interaction.reply({
                    embeds: [
                        embedFactory.createErrorEmbed(errorMessages.internalError),
                    ],
                    ephemeral: true,
                });
            }
        }
    },
};
