var WikipediaCategoryToAIConcepts = require("./WikipediaCategoryToAIConcepts");
//WikipediaCategoryToAIConcepts(console, {query: {category: "Artificial_intelligence"}})

// Emulate the Azure context object.
function createContext() {
    return {
        bindings: {},
        log: Object.assign(console.log, console),
        done: function(error, response) {
            console.log(response)
        }
    };
}

WikipediaCategoryToAIConcepts(createContext(), {
    query: { category: "Artificial_intelligence" }
});
