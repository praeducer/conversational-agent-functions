// TODO: Store these in an environment variable
// ADD THIS PART TO YOUR CODE
var config = {}

config.endpoint = process.env[endpoint] || "https://localhost:443/";
config.primaryKey = process.env[primaryKey]
config.database = {
    "id": process.env[database] || "demo"
};
config.collection = {
    "id": "AIConcept"
};

module.exports = config;