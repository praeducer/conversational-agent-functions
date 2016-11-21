// TODO: Store these in an environment variable
// ADD THIS PART TO YOUR CODE
var config = {}

config.endpoint = "https://futurisma.documents.azure.com:443/";
config.primaryKey = "1VIiaQn3SS18oQZ046X1iLWvT6wBdrV8wfKp0B8sb2JeqArAhteWcE69WydABkFwDDVexd51ySb6EHUHNTO6cw==";
config.database = {
    "id": "futurisma"
};
config.collection = {
    "id": "AIConcept"
};

module.exports = config;