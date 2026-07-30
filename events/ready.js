const config = require("../config.json");
const { Routes, REST } = require("discord.js");

async function loadCommands(client) {
    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
    try {
        console.log("Started refreshing application (/) commands.");
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, config.guildId),
            { body: client.commandsArray },
        );
        console.log("Successfully reloaded application (/) commands.");

        const logo = ` _____     _ _   _   _____ _       _   _   
|   __|___|_| |_| |_|     | |_ ___| |_| |_ 
|   __| .'| |  _|   |   --|   | .'|  _|  _|
|__|  |__,|_|_| |_|_|_____|_|_|__,|_| |_|`;
        console.log(`------------------------------\n\n${logo}\n\nV2 SERVER UTILITIES DISCORD BOT\n©️ FaithChatt Forum. All rights reserved.\n\nhttps://discord.gg/faithchatt\n\n------------------------------`);
    }
    catch (error) {
        console.error(error);
    }
    const arrayStatus = [
        `Sola Gratia`,
        `Sola Fide`,
        `Sola Scriptura`,
        `Solus Christus`,
        `Soli Deo Gloria`,
        `discord.gg/faithchatt`,
    ];
    let index = 0;
    setInterval(() => {
        if (index === arrayStatus.length) index = 0;
        const status = arrayStatus[index];
        client.user.setActivity(status, { type: "PLAYING" });
        index++;
    }, 5000);
    console.log("The bot is ready!");
}

module.exports = {
    once: true,
    name: "ready",
    execute(client) {
        loadCommands(client);
    },
};
