const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    userId: { type: String },
    userName: { type: String },
    textChannel: { type: String },
    // Snapshot of the role IDs stripped from the member when they were jailed,
    // so /unjail can restore them instead of leaving the member roleless.
    removedRoles: { type: [String], default: [] },
});

module.exports = mongoose.model("jailsystem", schema);
