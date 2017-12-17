// Setup our function's User-Agent.
const fs = require('fs');
const path = require('path');
var packageJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
var userAgent = packageJSON.name + "/" + packageJSON.version + " (+http://neona.chat)"
var userAgent = `$(packageJSON.name)/$(packageJSON.version) (+$(package.JSON.bot))`

const url = require('url');

// Simple function for querying wikipedia's entity api.
function API (query) {
    var base_url = "https://en.wikipedia.org/w/api.php";
    return { // Request Options Object
        url: url.format({pathname: base_url, query: query}),
        method: 'GET',
        headers: {
            'User-Agent': userAgent
        },
        json: true
    };
}

// Takes in the string of the category title e.g. "Category:Computer_vision"

// https://www.mediawiki.org/wiki/API:Categorymembers
API.CategoryMembers = function(category, limit=200, _continue) {
    return API({
        action: "query",
        format: "json",
        list: "categorymembers",
        cmlimit: limit.toString(10),
        cmtype: "page",
        cmprop: "ids",
        cmtitle: "category:" + category.toLowerCase().replace(" ", "_"),
        cmcontinue: _continue
    })
}
API.Subcategories = function(category, _continue) {
    return API({
        action: "query",
        format: "json",
        list: "categorymembers",
        cmtype: "subcat",
        cmtitle: "category:" + category.toLowerCase().replace(" ", "_"),
        cmcontinue: _continue
    })
}
// Pages
// https://www.mediawiki.org/wiki/Extension:TextExtracts
API.Pages = function(pageids=[], limit=20, _continue) {
    return API({
        action: "query",
        format: "json",
        prop: "extracts",
        exlimit: limit,
        // Remove exintro= to get full text. May help with search.
        exintro: true,
        explaintext: true,
        indexpageids: true,
        pageids: pageids.join("|"),
        excontinue: _continue
    })
}

module.exports = API
