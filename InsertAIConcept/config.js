var fs = require("fs");
var path = require("path");
var functionJSON = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "function.json"), "utf8")
);

 // These are typically set automatically.
let documentDBBinding = functionJSON.bindings.filter(function(obj) {return obj.type === "documentDB"})[0];
// Convert the format A=ValueA;B=ValueB;... into an object.
let localDBConnection = "AccountEndpoint=http://localhost:443/;AccountKey=;";
let documentDBConnection = (process.env[documentDBBinding.connection] || localDBConnection).split(";").reduce(function(obj,pair) {
  let [key, value] = pair.split("=", 2);
  obj[key] = value;
  return obj;
}, {});

// Set environment values in Function Apps -> conversational-agent-functions -> Application Settings.
module.exports = {
  database: documentDBBinding.databaseName,
  collection: documentDBBinding.collectionName,
  // Find these values in Azure Cosmos DB -> yourDB -> Settings/Keys
  uri: documentDBConnection.AccountEndpoint,
  key: documentDBConnection.AccountKey
};
