// Setup our function's User-Agent.
const fs = require('fs');
const path = require('path');
var packageJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
var userAgent = packageJSON.name + "/" + packageJSON.version + " (+http://neona.chat)"

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
// TODO: Handle case where there are more than 500 pages. Use API's continue param
// TODO: Turn into it's own azure function. Return a list of documents that then can be iterated over and inserted into document DB
// TODO: Use wikipedia API's' continue functionality instead of custom batching system

// https://www.mediawiki.org/wiki/API:Categorymembers
API.CategoryMembers = function(category, limit=500) {
    return API({
        action: "query",
        format: "json",
        list: "categorymembers",
        cmlimit: limit.toString(10),
        cmtype: "page",
        cmprop: "ids",
        cmtitle: "Category:" + category.toLowerCase().replace(" ", "_")
    })
}
API.Subcategories = function(category) {
    return API({
        action: "query",
        format: "json",
        list: "categorymembers",
        cmtype: "subcat",
        cmtitle: category
    })
}
// Pages
// https://www.mediawiki.org/wiki/Extension:TextExtracts
API.Pages = function(pageids=[], limit=20) {
    return API({
        action: "query",
        format: "json",
        prop: "extracts",
        exlimit: limit,
        // Remove exintro= to get full text. May help with search.
        exintro: true,
        explaintext: true,
        indexpageids: true,
        pageids: pageids.join("|")
    })
}

module.exports = API