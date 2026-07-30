const mongoose = require("mongoose");
require("dotenv").config({ quiet: true });

module.exports = async () => {
    await mongoose.set("strictQuery", false);
    await mongoose.connect(process.env.MONGO_URL);

    return mongoose;
};

mongoose.connection.on("connected", () => {
    console.log("Database is now ready!");
});
