const { Client, GatewayIntentBits, Partials } = require("discord.js");

const intentsLoad = [GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds, GatewayIntentBits.GuildExpressions, GatewayIntentBits.GuildIntegrations, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers];
const partialsLoad = [Partials.User, Partials.Channel, Partials.GuildMember, Partials.Message, Partials.Reaction, Partials.ThreadMember];

const client = new Client({ intents: intentsLoad, partials: partialsLoad });
module.exports.client = client;
require("dotenv").config({ quiet: true });
require("./utils/handler.js");
require("./utils/mongo")();

client.login(process.env.TOKEN);
