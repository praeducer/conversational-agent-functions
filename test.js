var WikipediaCategoryToAIConcepts = require("./WikipediaCategoryToAIConcepts");
//WikipediaCategoryToAIConcepts(console, {query: {category: "Artificial_intelligence"}})
var wikipedia = require("./wikipedia");
var GetPagesByCategoryTitle = wikipedia.GetPagesByCategoryTitle;
var CreatePageidsUrls = wikipedia.CreatePageidsUrls;
var WikiPagesToObjectsByManyUrls = wikipedia.WikiPagesToObjectsByManyUrls;
var WikiPagesToObjectsByUrl = wikipedia.WikiPagesToObjectsByUrl;

console.log(GetPagesByCategoryTitle("Artificial_intelligence"))


// Emulate the Azure context object.
function createContext() {
    return {
        bindings: {},
        log: Object.assign(console.log, console),
        done: function(error, response) {}
    }
}