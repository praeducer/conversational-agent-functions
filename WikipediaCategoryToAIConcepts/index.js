// For testing
var test = true;

// https://github.com/request/request-promise
const request = require('request-promise')  
const fs = require('fs');
const path = require('path');

var context;
var appRoot = process.cwd();
var packageJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

// https://www.mediawiki.org/wiki/API:Categorymembers
var getPageidsByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmlimit=500&cmtype=page&cmprop=ids&cmtitle=';
var getSubCategoryByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=subcat&cmtitle='
// https://www.mediawiki.org/wiki/Extension:TextExtracts
// TODO: Remove exintro= to get full text. May help with search.
var getPagesByPageidsUrl = 'https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&indexpageids=&pageids=';
var getOptions = {
    url: "",
    method: 'GET',
    headers: {
        'User-Agent': '[testing] Futurisma - A conversational agent that teaches AI by paulprae.com'
    },
    json: true
};
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

// TODO: Make this recursive for subcategories. Can call itself. Have it take in another param for depth, stop after depth is 0. Make sure not to insert duplicates into document db though.
// Promises: https://developers.google.com/web/fundamentals/getting-started/primers/promises
module.exports = function (cntxt, req) {
    context = cntxt;
    context.log('[WikipediaCategoryToAIConcepts] JavaScript HTTP trigger function processed a request.');

    if (req.query.category || (req.body && req.body.category)) {       
        context.log('[WikipediaCategoryToAIConcepts] category ' + req.body.category);
        GetPagesByCategoryTitle('Category:' + (req.query.category || req.body.category))
            .then(function(pageids){
                GetPagesByPageids(pageids)
                    .then(function(results){
                        context.log('[WikipediaCategoryToAIConcepts] complete');
                        res = {
                            body: "WikipediaCategoryToAIConcepts complete"
                        };
                        context.done(null, res);
                    }).catch(function(err){
                        context.log('[GetPageidsByCategoryTitle] err');    
                        context.log(err);
                        res = {
                            status: 400,
                            body: err
                        };            
                        context.done(null, res);
                    });
            })
            .catch(function(err){
                context.log('[GetPageidsByCategoryTitle] err');   
                context.log(err);             
                context.done(null, res);
            });
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
    context.log('[GetPageidsByCategoryTitle] start async');
    return new Promise(function(resolve, reject) {

        var pageids = [];
        var url = getPageidsByCategoryTitleUrl.concat(encodeURIComponent(category));
        getOptions.url = url;

        // https://blog.risingstack.com/node-hero-node-js-request-module-tutorial/
        request(getOptions)
            .then(function(response){
                context.log('[GetPageidsByCategoryTitle] resolved ' + url);
                response.query.categorymembers.forEach(function(element) {
                    pageids.push(element.pageid);
                });
                resolve(pageids);
            })
            .catch(function(err){
                context.log('[GetPageidsByCategoryTitle] rejected ' + url);
                reject(err);
            });
    });
}

// TODO: Turn into it's own azure function. Return a list of documents that then can be iterated over and inserted into document DB
// TODO: Use wikipedia API's' continue functionality instead of custom batching system
function GetPagesByPageids(pageids){
    context.log('[GetPagesByPageids] start async');

    var urls = CreatePageidsUrls(pageids);
    // This will return an array of all the results from GetPagesByUrl
    return Promise.all(
        urls.map(GetPagesByUrl)
    ); 
}

function CreatePageidsUrls(pageids){
    context.log('[CreatePageidsUrls] start ');
    var urls = [];

    // Process in batches of 20
    var increment = 20;
    var lowerBound = 0;
    var upperBound = increment;
    var remainingPageidsCount = pageids.length;

    while(remainingPageidsCount > 0){
        context.log('[CreatePageidsUrls] remainingPageidsCount ' + remainingPageidsCount);

        if(upperBound > pageids.length) upperBound = remainingPageidsCount + lowerBound;
        var pageidsStr = pageids.slice(lowerBound, upperBound).join("|");
        var url = getPagesByPageidsUrl + encodeURIComponent(pageidsStr);
        urls.push(url);

        if(test){
            context.log('[CreatePageidsUrls] lowerBound ' + lowerBound);
            context.log('[CreatePageidsUrls] upperBound ' + upperBound);
            context.log('[CreatePageidsUrls] pageidsStr ' + pageidsStr);
        }

        remainingPageidsCount = remainingPageidsCount - increment;
        lowerBound = lowerBound + increment;
        upperBound = upperBound + increment;
    }
    context.log('[CreatePageidsUrls] end');
    return urls;
}

function GetPagesByUrl(url){
    context.log('[GetPagesByUrl] start async');

    return new Promise(function(resolve, reject) {
        getOptions.url = url;
        // TODO: Make sure responses look like what we think they look like. Print them.
        request(getOptions)
            .then(function(response){
                context.log('[GetPagesByUrl] resolved ' + url);

                var insertAIConceptPromises = [];
                if(response.query.pageids){
                    response.query.pageids.forEach(function(element) {
                        if(response.query.pages[element].pageid
                            && response.query.pages[element].title
                            && response.query.pages[element].extract){

                                insertAIConceptPromises.push(
                                    InsertAIConcept(
                                        response.query.pages[element].pageid,
                                        response.query.pages[element].title,
                                        response.query.pages[element].extract
                                    )
                                );
                        }
                    });
                }
                // success, return array of results from all promises
                Promise.all(insertAIConceptPromises)
                    .then(function(results){
                        context.log('[GetPagesByUrl] promises resolved');
                        resolve(results);
                    })
                    .catch(function(err){
                        context.log('[GetPagesByUrl] promises rejected');
                        // stop execution of script at all done's while testing.
                        if(test){
                            context.done(null, res);
                            process.exit();
                        }
                        // TODO: what happens when one of the promises fails but the rest succeed? we don't want the whole thing to get rejected because of one failure.
                        reject(err);
                    });
            })
            .catch(function(err){
                context.log('[GetPagesByUrl] rejected ' + url);
                context.log(err);
                // stop execution of script at all done's while testing.
                if(test){
                    context.done(null, res);
                    process.exit();
                }
                // failure
                reject(err);
            }); 
    }); 
}

function InsertAIConcept(pageid, title, extract){
    context.log('[InsertAIConcept] start async');

    return new Promise(function(resolve, reject) {
        postOptions.body.source.pageid = pageid;
        postOptions.body.title = title;
        postOptions.body.extract = extract;
        try{
            request(postOptions)
                .then(function (parsedBody) {
                    context.log('[InsertAIConcept] resolved ' + postOptions.uri);
                    // TODO: Consider printing everything after its all returned in calling methods.
                    context.log(parsedBody);
                    // stop execution of script while testing.
                    if(test){                                          
                        context.done(null, res); 
                        process.exit();
                    }
                    // success
                    resolve(parsedBody);
                })
                .catch(function (err) {
                    context.log('[InsertAIConcept] rejected ' + postOptions.uri);
                    context.log('[InsertAIConcept] pageid ' + pageid);
                    // TODO: Consider printing everything after its all returned in calling methods.
                    context.log(err);
                    // stop execution of script while testing.
                    if(test){                                          
                        context.done(null, res);    
                        process.exit();
                    }
                    // failure
                    reject(err);
                });
        } catch (e) {
            // TODO: Consider printing everything after its all returned in calling methods.
            context.log('[InsertAIConcept] exception');
            context.log(e);
            if(err) context.log(err);
            // stop execution of script while testing.
            if(test){                                        
                context.done(null, res);
                process.exit();
            }
            // failure
            reject(e);
        }
    });
}