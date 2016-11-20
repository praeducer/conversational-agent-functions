// https://github.com/request/request-promise
const request = require('request-promise')  
const fs = require('fs');

var context;
var appRoot = process.cwd();
var packageJSON = JSON.parse(fs.readFileSync(appRoot + '\package.json', 'utf8'));

// https://www.mediawiki.org/wiki/API:Categorymembers
var getPageidsByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmlimit=500&cmtype=page&cmprop=ids&cmtitle=';
var getSubCategoryByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=subcat&cmtitle='
// https://www.mediawiki.org/wiki/Extension:TextExtracts
// TODO: Remove exintro= to get full text. May help with search.
var getPagesByPageidsUrl = 'https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&indexpageids=&pageids=';
var options = {
    url: "",
    method: 'GET',
    headers: {
        'User-Agent': 'Futurisma - A conversational agent that teaches AI by paulprae.com'
    },
    json: true
};

// TODO: Make this recursive for subcategories. Can call itself. Have it take in another param for depth, stop after depth is 0. Make sure not to insert duplicates into document db though.
module.exports = function (cntxt, req) {
    context = cntxt;
    context.log('WikipediaCategoryToAIConcepts JavaScript HTTP trigger function processed a request.');

    if (req.query.category || (req.body && req.body.category)) {
        // TODO: Use a promise here and then say context is done once promise resolves.
       GetPagesByCategoryTitle('Category:' + (req.query.category || req.body.category));
    }
    else {
        res = {
            status: 400,
            body: "Please pass a category on the query string or in the request body"
        };
        context.done(null, res);
    }
};

// TODO: Handle case where there are more than 500 pages. Use API's continue param
// TODO: Use a generator to get category and pageids at the same time
// Takes in the string of the category title e.g. "Category:Computer vision"
function GetPagesByCategoryTitle(category){
    context.log('[GetPageidsByCategoryTitle] start ' + category);

    var pageids = [];
    var url = getPageidsByCategoryTitleUrl.concat(encodeURIComponent(category));
    options.url = url;

    // https://blog.risingstack.com/node-hero-node-js-request-module-tutorial/
    request(options)
        .then(function(response){
            context.log('[GetPageidsByCategoryTitle] resolved ' + url);
            response.query.categorymembers.forEach(function(element) {
                pageids.push(element.pageid);
            });
            // TODO: Return pageids using promises and then call this method in main function
            GetPagesByPageids(pageids);
        })
        .catch(function(err){
            context.log('[GetPageidsByCategoryTitle] rejected ' + url);
        });
}

// TODO: Turn into it's own azure function
// TODO: Use wikipedia's API continue functionality instead of custom batching system
// TODO: Return a list of documents that then can be iterated over and inserted into document DB
// TODO: Only updated if a revision was made since the last time the script was ran: https://www.mediawiki.org/wiki/API:Revisions
function GetPagesByPageids(pageids){
    context.log('[GetPagesByPageids] start');

    var postOptions = {
        method: 'POST',
        // TODO: Store in an environment variable e.g. process.env[code];
        uri: 'https://conversational-agent-functions.azurewebsites.net/api/InsertAIConcept?code=XERJ0r6B3fgO2KjhagBIisPi/f6kRlrhRHujcyGkaCybNtFL4Rzjig==',
        body: {
            source: {
                name: 'wikipedia',
                accessedDate: Date.now(),
                scriptVersion: packageJSON.version
            },
            active: true
        },
        json: true // Automatically stringifies the body to JSON
    };
    // Process in batches of 20
    var increment = 20;
    var lowerBound = 0;
    var upperBound = increment;
    var lowerBoundLimit = Math.floor(pageids.length / increment) * increment;
    var remainingPageidsCount = pageids.length;

    for(;lowerBound <= lowerBoundLimit; lowerBound + increment){
        if(upperBound > pageids.length) upperBound = remainingPageidsCount;
        var pageidsStr = pageids.slice(lowerBound, upperBound).join("|");
        var url = getPagesByPageidsUrl.concat(pageidsStr);
        options.url = url;
        upperBound = upperBound + increment;
        remainingPageidsCount = remainingPageidsCount - increment;

        request(options)
            .then(function(response){
                context.log('[GetPagesByPageids] resolved ' + url);

                response.query.pageids.forEach(function(element) {
                    postOptions.body.source.pageid = response.query.pages[element].pageid;
                    postOptions.body.title = response.query.pages[element].title;
                    postOptions.body.extract = response.query.pages[element].extract;
                    request(postOptions)
                        .then(function (parsedBody) {
                            context.log('[GetPagesByPageids] resolved ' + postOptions.uri);
                            context.log('[GetPagesByPageids] pageid ' + response.query.pages[element].pageid);
                        })
                        .catch(function (err) {
                            context.log('[GetPagesByPageids] rejected ' + postOptions.uri);
                            context.log('[GetPagesByPageids] pageid ' + response.query.pages[element].pageid);
                        });
                });
                // TODO: Use promises and move this to main function.
                res = {
                    body: "WikipediaCategoryToAIConcepts complete"
                };
                context.done(null, res);
            })
            .catch(function(err){
                context.log('[GetPagesByPageids] rejected ' + url);
            });    
    }
}