// https://github.com/request/request-promise
const request = require('request-promise')  

var context;

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

// TODO: Batch into sets of 20 as that is the limit
// TODO: Return a list of documents that then can be iterated over and inserted into document DB
function GetPagesByPageids(pageids){
    context.log('[GetPagesByPageids] start');

    var pageidsStr = pageids.join("|");
    var url = getPagesByPageidsUrl.concat(pageidsStr);
    options.url = url;

    request(options)
        .then(function(response){
            context.log('[GetPagesByPageids] resolved ' + url);
            response.query.pageids.forEach(function(element) {
                //context.log(response.query.pages[element].title);
                context.log(response.query.pages[element]);
            });
            // TODO: Use promises and move this to main function.
            res = {
                body: "WikipediaCategoryToAIConcepts pageids " + JSON.stringify(response.query.pageids)
            };
            context.done(null, res);
        })
        .catch(function(err){
            context.log('[GetPagesByPageids] rejected ' + url);
        });
}