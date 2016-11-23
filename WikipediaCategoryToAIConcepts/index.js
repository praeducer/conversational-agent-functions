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
var insertAIConceptUri = 'https://conversational-agent-functions.azurewebsites.net/api/InsertAIConcept?code=XERJ0r6B3fgO2KjhagBIisPi/f6kRlrhRHujcyGkaCybNtFL4Rzjig==';
var userAgent = '[testing] Futurisma - A conversational agent that teaches AI by paulprae.com';

// TODO: Make this recursive for subcategories. Can call itself. Have it take in another param for depth, stop after depth is 0.
// TODO: Make sure this does stop all requests after a single request fails
// Category must by valid for a url. All spaces replaced with '_', underscore.
// Promises: https://developers.google.com/web/fundamentals/getting-started/primers/promises
module.exports = function (cntxt, req) {
    context = cntxt;
    context.log('[WikipediaCategoryToAIConcepts] JavaScript HTTP trigger function processed a request.');

    if (req.query.category || (req.body && req.body.category)) {       
        context.log('[WikipediaCategoryToAIConcepts] category ' + (req.query.category || req.body.category));

        GetPagesByCategoryTitle('Category:' + (req.query.category || req.body.category))
            .then(function(pageids){
                if(pageids && pageids.length > 1){
                    context.log('[WikipediaCategoryToAIConcepts] resolved first promise');
                    var urls = CreatePageidsUrls(pageids);
                    var wikiPageObjects = WikiPagesToObjectsByManyUrls(urls);
                    // TODO: Could return and handle in another then
                    Promise.all(
                            wikiPageObjects.map(InsertAIConcept)
                        ).then(function(results){
                            context.log('[WikipediaCategoryToAIConcepts] success. Processed ' + pageids.length + ' pageids.');
                            res = {
                                body: "WikipediaCategoryToAIConcepts success. Processed " + pageids.length + " pageids."
                            };
                            context.done(null, res);
                        }).catch(function(err){
                            context.log('[WikipediaCategoryToAIConcepts] failure');    
                            context.log(err);
                            res = {
                                status: 400,
                                body: err
                            };            
                            context.done(null, res);
                        });
                }
                else {
                    context.log('[WikipediaCategoryToAIConcepts] success. No pageids to process in the category.');  
                    res = {
                        body: "[WikipediaCategoryToAIConcepts] success. No pageids to process in the category."
                    };
                    context.done(null, res);
                }
            })
            .catch(function(err){
                context.log('[WikipediaCategoryToAIConcepts] rejected first promise');
                context.log('[WikipediaCategoryToAIConcepts] failure');   
                context.log(err);
                res = {
                    status: 400,
                    body: err
                };            
                context.done(null, res);
            });
    }
    else {
        context.log('[WikipediaCategoryToAIConcepts] failure. Please pass a category on the query string or in the request body.');  
        res = {
            status: 400,
            body: "[WikipediaCategoryToAIConcepts] failure. Please pass a category on the query string or in the request body."
        };
        context.done(null, res);
    }
    
    context.log('[WikipediaCategoryToAIConcepts] async fired');
};

// TODO: Handle case where there are more than 500 pages. Use API's continue param
// TODO: Use a generator to get category and pageids at the same time
// Takes in the string of the category title e.g. "Category:Computer_vision"
function GetPagesByCategoryTitle(category){
    context.log('[GetPageidsByCategoryTitle] start async');

    return new Promise(function(resolve, reject) {
        try{
            var getOptions = {
                url: getPageidsByCategoryTitleUrl + category,
                method: 'GET',
                headers: {
                    'User-Agent': userAgent
                },
                json: true
            };

            if(test){
                context.log(getOptions);
            }

            var pageids = [];
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
                    context.log(err);
                    // stop execution of script at all done's while testing.
                    if(test){
                        context.done(null, res);
                        process.exit();
                    }
                    reject(err);
                });
        } catch (e) {
            context.log('[GetPageidsByCategoryTitle] exception');
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

// TODO: Turn into it's own azure function. Return a list of documents that then can be iterated over and inserted into document DB
// TODO: Use wikipedia API's' continue functionality instead of custom batching system
function WikiPagesToObjectsByManyUrls(urls){
    context.log('[WikiPagesToObjectsByManyUrls] start async');

    var wikiPageObjects = [];  
    // This will return an array of all the results
    // TODO: Is this async? Does the calling method need to expect a promise or does the then make this act sync?
    Promise.all(
        urls.map(WikiPagesToObjectsByUrl)
    ).then(function(arrayOfResults){       
        context.log('[WikiPagesToObjectsByManyUrls] Promise.all success');
        // Turn into a single dimensional array
        arrayOfResults.forEach(function(results){
            wikiPageObjects = wikiPageObjects.concat(results);
        });
        return wikiPageObjects;
    })
    .catch(function(err){
        context.log('[WikiPagesToObjectsByManyUrls] Promise.all failure');
        context.log(err);
        // stop execution of script at all done's while testing.
        if(test){
            context.done(null, res);
            process.exit();
        }
        // failure
        // TODO: Fail silently. Don't want one issue to stop all inserts
        return wikiPageObjects;
    });
}

function WikiPagesToObjectsByUrl(url){
    context.log('[WikiPagesToObjectsByUrl] start async');

    return new Promise(function(resolve, reject) {
        var getOptions = {
            url: url,
            method: 'GET',
            headers: {
                'User-Agent': userAgent
            },
            json: true
        };

        request(getOptions)
            .then(function(response){
                context.log('[WikiPagesToObjectsByUrl] resolved ' + url);
                if(test){
                    context.log('[WikiPagesToObjectsByUrl] response');
                    context.log(response);
                }
                
                var wikiPageObjects = [];
                if(response.query.pageids){
                    response.query.pageids.forEach(function(element) {
                        if(response.query.pages[element].pageid
                            && response.query.pages[element].title
                            && response.query.pages[element].extract){
                                wikiPageObjects.push(
                                    {
                                        pageid: response.query.pages[element].pageid,
                                        title: response.query.pages[element].title,
                                        extract: response.query.pages[element].extract
                                    }
                                );
                        }
                    });
                }
                resolve(wikiPageObjects);
            })
            .catch(function(err){
                context.log('[WikiPagesToObjectsByUrl] rejected ' + url);
                context.log(err);
                // stop execution of script at all done's while testing.
                if(test){
                    context.done(null, res);
                    process.exit();
                }
                // failure
                // TODO: Fail silently. Don't want one issue to stop all inserts
                reject(err);
            }); 
    }); 
}

// TODO: Insert category as well, especially after refactoring so this script is recursive to subcategories
function InsertAIConcept(wikiPageObject){
    context.log('[InsertAIConcept] start async');

    return new Promise(function(resolve, reject) {
        var postOptions = {
            method: 'POST',
            // TODO: Store in an environment variable e.g. process.env[code];
            uri: insertAIConceptUri,
            body: {
                source: {
                    pageid: wikiPageObject.pageid,
                    name: 'wikipedia',
                    accessedDate: Date.now(),
                    scriptVersion: packageJSON.version
                },
                title: wikiPageObject.title,
                extract: wikiPageObject.extract,
                active: true
            },
            json: true // Automatically stringifies the body to JSON
        };
        try{
            request(postOptions)
                .then(function (parsedBody) {
                    // TODO: Consider printing everything after its all returned in calling methods to prevent strange async stuff.
                    context.log('[InsertAIConcept] resolved ' + postOptions.uri);
                    context.log(parsedBody);
                    // stop execution of script while testing.
                    // TODO: Remove after initial test. Still want to fail on errors after initial test.
                    if(test){                                          
                        context.done(null, res); 
                        process.exit();
                    }
                    // success
                    resolve(parsedBody);
                })
                .catch(function (err) {
                    // TODO: Consider printing everything after its all returned in calling methods to prevent strange async stuff.
                    context.log('[InsertAIConcept] rejected ' + postOptions.uri);
                    context.log('[InsertAIConcept] pageid ' + pageid);
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
            // TODO: Consider printing everything after its all returned in calling methods to prevent strange async stuff.
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