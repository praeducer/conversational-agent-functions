// For testing
var test = false;
var verbose = false;
// TODO: setup to run local: context = console, var res, var req, hide all dones, call instead of exporting the main function
var local = false;

const request = require('request-promise')

// https://www.mediawiki.org/wiki/API:Categorymembers
var getPageidsByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmlimit=500&cmtype=page&cmprop=ids&cmtitle=';
var getSubCategoryByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=subcat&cmtitle='
// https://www.mediawiki.org/wiki/Extension:TextExtracts
// TODO: Remove exintro= to get full text. May help with search.
var getPagesByPageidsUrl = 'https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exlimit=20&exintro=&explaintext=&indexpageids=&pageids=';
const fs = require('fs');
const path = require('path');
var packageJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
var userAgent = packageJSON.name + "/" + packageJSON.version + " (+http://neona.chat)"

module.exports = {
    GetPagesByCategoryTitle: GetPagesByCategoryTitle,
    CreatePageidsUrls: CreatePageidsUrls,
    WikiPagesToObjectsByManyUrls: WikiPagesToObjectsByManyUrls,
    WikiPagesToObjectsByUrl: WikiPagesToObjectsByUrl
}
// TODO: Handle case where there are more than 500 pages. Use API's continue param
// TODO: Use a generator to get category and pageids at the same time
// Takes in the string of the category title e.g. "Category:Computer_vision"
function GetPagesByCategoryTitle(category, log){
    //log("start async")
    context.log("[%s] %s", arguments.callee.name, "start async")
    context.log('[GetPageidsByCategoryTitle] start async');

    return new Promise(function(resolve, reject) {
        try{
            var url = getPageidsByCategoryTitleUrl + category;
            var getOptions = {
                url: url,
                method: 'GET',
                headers: {
                    'User-Agent': userAgent
                },
                json: true
            };

            if(verbose){
                context.log('[GetPageidsByCategoryTitle] options');
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
                    reject(err);
                });
        } catch (e) {
            context.log('[GetPageidsByCategoryTitle] exception');
            context.log(e);
            reject(e);
        }

        if(verbose) context.log('[GetPageidsByCategoryTitle] promise created');
    });
}

function CreatePageidsUrls(pageids){
    if(verbose) context.log('[CreatePageidsUrls] called');
    var urls = [];

    // Process in batches of 20
    var increment = 20;
    var lowerBound = 0;
    var upperBound = increment;
    var remainingPageidsCount = pageids.length;

    while(remainingPageidsCount > 0){
        if(verbose) context.log('[CreatePageidsUrls] remainingPageidsCount ' + remainingPageidsCount);

        if(upperBound > pageids.length) upperBound = remainingPageidsCount + lowerBound;
        var pageidsStr = pageids.slice(lowerBound, upperBound).join("|");
        var url = getPagesByPageidsUrl + encodeURIComponent(pageidsStr);
        urls.push(url);

        if(verbose){
            context.log('[CreatePageidsUrls] lowerBound ' + lowerBound);
           context.log('[CreatePageidsUrls] upperBound ' + upperBound);
            context.log('[CreatePageidsUrls] pageidsStr ' + pageidsStr);
        }

        remainingPageidsCount = remainingPageidsCount - increment;
        lowerBound = lowerBound + increment;
        upperBound = upperBound + increment;
    }
    context.log('[CreatePageidsUrls] completed');
    return urls;
}

// TODO: Turn into it's own azure function. Return a list of documents that then can be iterated over and inserted into document DB
// TODO: Use wikipedia API's' continue functionality instead of custom batching system
function WikiPagesToObjectsByManyUrls(urls){
    context.log('[WikiPagesToObjectsByManyUrls] start async');

    return new Promise(function(resolve, reject){
        // This will return an array of all the results
    Promise.all(
            urls.map(WikiPagesToObjectsByUrl)
        ).then(function(arrayOfResults){
            if(verbose){
                context.log('[WikiPagesToObjectsByManyUrls] resolved urls.map(WikiPagesToObjectsByUrl) promises');
                context.log('[WikiPagesToObjectsByManyUrls] arrayOfResults.length ' + arrayOfResults.length);
            }
            var wikiPageObjects = [];
            // Turn into a single dimensional array
            arrayOfResults.forEach(function(results, index){
                wikiPageObjects = wikiPageObjects.concat(results);
                if(verbose){
                    context.log('[WikiPagesToObjectsByManyUrls] results ' + index);
                    context.log('[WikiPagesToObjectsByManyUrls] results.length ' + results.length);
                    context.log(results);
                    context.log('[WikiPagesToObjectsByManyUrls] concat wikiPageObjects.length ' + wikiPageObjects.length);
                }
            });
            resolve(wikiPageObjects);
        })
        .catch(function(err){
            context.log('[WikiPagesToObjectsByManyUrls] rejected urls.map(WikiPagesToObjectsByUrl) promises');
            context.log(err);
            reject(err);
        });
        if(verbose) context.log('[WikiPagesToObjectsByManyUrls] promise created');
    });
}

function WikiPagesToObjectsByUrl(url){
    if(verbose) context.log('[WikiPagesToObjectsByUrl] start async');

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

                var wikiPageObjects = [];
                if(response.query.pageids){
                    response.query.pageids.forEach(function(element, index) {
                        if(verbose) context.log('[WikiPagesToObjectsByUrl] processing element ' + element + ' at index ' + index);
                        if(response.query.pages[element].pageid
                            && response.query.pages[element].title
                            && response.query.pages[element].extract){
                                if(verbose) context.log('[WikiPagesToObjectsByUrl] pushing ' + response.query.pages[element].title);
                                wikiPageObjects.push(
                                    {
                                        pageid: response.query.pages[element].pageid,
                                        title: response.query.pages[element].title,
                                        extract: response.query.pages[element].extract
                                    }
                                );
                        } else {
                            if(verbose) context.log('[WikiPagesToObjectsByUrl] element missing data ' + element);
                        }
                    });
                }
                if(verbose){
                    context.log('[WikiPagesToObjectsByUrl] response');
                    context.log(response);
                    context.log('[WikiPagesToObjectsByUrl] wikiPageObjects.length ' + wikiPageObjects.length);
                }
                resolve(wikiPageObjects);
            })
            .catch(function(err){
                context.log('[WikiPagesToObjectsByUrl] rejected ' + url);
                context.log(err);
                reject(err);
            });
    });
}
