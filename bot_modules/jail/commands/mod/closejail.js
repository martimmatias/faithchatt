const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require("discord.js");
const { parentId, textId, errorMessages } = require("../../../../utils/variables.js");
const jailModel = require("../../models/jailsystem.js");
const embedFactory = require("../../../../utils/embedFactory.js");
const jailSystem = require("../../utils/jail_system.js");
const perm = PermissionsBitField.Flags;

module.exports = {
    data: new SlashCommandBuilder()
        .setName("closejail")
        .setDescription("Closes the jail ticket manually"),
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

        // If we are in the jail category
        if (interaction.channel.parent.id === parentId.jail) {
            if (interaction.channel.id === textId.jailedRules) {
                return interaction.reply({
                    embeds: [
                        embedFactory.createErrorEmbed(errorMessages.notAllowedInRulesChannel),
                    ],
                    ephemeral: true,
                });
            }

            try {
                const jailData = await jailModel.findOne({ "textChannel": interaction.channel.id });
                if (jailData) {
                    await jailModel.deleteOne({ "textChannel": interaction.channel.id });
                }
            }
            catch (err) {
                console.log(err);
                return interaction.followUp({
                    embeds: [
                        embedFactory.createErrorEmbed(errorMessages.internalError),
                    ],
                    ephemeral: true,
                });
            }

            const closeLogEmbed = new EmbedBuilder()
                .setDescription(`🔒 Jail ticket **${interaction.channel.name}** was closed by \`${interaction.user.tag}\`.`)
                .setFooter({ text: `Moderator UID: ${interaction.user.id}` })
                .setColor("#ffd100");
            await jailSystem.logTranscript(interaction.channel, closeLogEmbed).catch(err => console.error(err));

            await interaction.reply(`**The channel closes in five seconds.**`).catch(err => console.log(err));
            // Reserve the five second timeout then delete
            setTimeout(() => {
                interaction.channel.delete(`Jail closed by ${interaction.member.nickname} (${interaction.member.user.id}).`);
            }, 5000);
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
