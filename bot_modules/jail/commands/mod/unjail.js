const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { parentId, errorMessages } = require("../../../../utils/variables.js");
const jailModel = require("../../models/jailsystem.js");
const embedFactory = require("../../../../utils/embedFactory.js");
const jailSystem = require("../../utils/jail_system.js");
const perm = PermissionsBitField.Flags;

/**
* @param {CommandInteraction} interaction
* @param {string | import("discord.js").InteractionReplyOptions | import("discord.js").MessagePayload} messageContent
*/

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unjail")
        .setDescription("Unjails a member")
        .addUserOption(option => option.setName("user").setDescription("User to be unjailed").setRequired(true)),

    /**
    * @param {import("discord.js").CommandInteraction} interaction
    */
    async execute(interaction) {
        const modPerms = interaction.member.permissions.has(perm.BanMembers || perm.KickMembers);
        if (!modPerms) {
            return interaction.reply({
                embeds: [
                    embedFactory.createErrorEmbed(errorMessages.notAuthorized),
                ],
                ephemeral: true,
            });
        }

        if (interaction.channel.parent.id === parentId.jail) {
            try {
                const jailedMember = await interaction.options.get("user").member;
                const jailedUserData = await jailModel.findOne({ userId: jailedMember.user.id });

                if (!jailedUserData) {
                    return interaction.reply({
                        embeds: [
                            embedFactory.createErrorEmbed(errorMessages.userNoData),
                        ],
                        ephemeral: true,
                    });
                }
                if (interaction.channel.id != jailedUserData.textChannel) {
                    return interaction.reply({
                        embeds: [
                            embedFactory.createErrorEmbed(errorMessages.channelNotExist),
                        ],
                        ephemeral: true,
                    });
                }

                await jailSystem.restoreRoles(interaction.guild, jailedMember, jailedUserData.removedRoles);

                await interaction.reply({
                    embeds: [
                        embedFactory.createSuccessEmbed("✅ | Successfully unjailed the user."),
                    ],
                    ephemeral: true,
                });
                await jailModel.deleteOne({ userId: jailedMember.user.id });
            }
            catch (err) {
                console.error(err);
                await interaction.reply({
                    embeds: [
                        embedFactory.createErrorEmbed(errorMessages.userNotExist),
                    ],
                    ephemeral: true,
                });
            }
        }
        else {
            return interaction.reply({
                embeds: [
                    embedFactory.createErrorEmbed(errorMessages.notAllowedOutsideJail),
                ],
                ephemeral: true,
            });
        }
    },
};
