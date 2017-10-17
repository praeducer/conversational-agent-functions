// For testing
var test = false;
var verbose = false;
// TODO: setup to run local: context = console, var res, var req, hide all dones, call instead of exporting the main function
var local = false;

// https://github.com/request/request-promise
const request = require('request-promise')
const fs = require('fs');
const path = require('path');

var appRoot = process.cwd();
var packageJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

// TODO: Store in an environment variable e.g. process.env[code];
var insertAIConceptUri = 'https://conversational-agent-functions.azurewebsites.net/api/InsertAIConcept?code=XERJ0r6B3fgO2KjhagBIisPi/f6kRlrhRHujcyGkaCybNtFL4Rzjig==';

// TODO: Make this recursive for subcategories. Can call itself. Have it take in another param for depth, stop after depth is 0.
// TODO: Make sure this does not stop all requests after a single request fails
// TODO: Config this so it can run locally or on azure
// Category must be valid for a url. All spaces replaced with '_', underscore.
// Promises: https://developers.google.com/web/fundamentals/getting-started/primers/promises
module.exports = function (context, req) {
    var wikipedia = require("./wikipedia")
    var GetPagesByCategoryTitle = wikipedia.GetPagesByCategoryTitle;
    var CreatePageidsUrls= wikipedia.CreatePageidsUrls;
    var WikiPagesToObjectsByManyUrls= wikipedia.WikiPagesToObjectsByManyUrls;
    context.log('[WikipediaCategoryToAIConcepts] JavaScript HTTP trigger function processed a request.');

    var category = req.query instanceof Object && req.query.category || req.body instanceof Object && req.body.category;
    if (category) {
        context.log('[WikipediaCategoryToAIConcepts] category ' + category);

        GetPagesByCategoryTitle('Category:' + category)
            .then(function(pageids){
                if(pageids && pageids.length > 1){
                    if(verbose) context.log('[WikipediaCategoryToAIConcepts] resolved GetPagesByCategoryTitle promise');
                    context.log('[WikipediaCategoryToAIConcepts] processing ' + pageids.length + ' pageids.');

                    var urls = CreatePageidsUrls(pageids);
                    WikiPagesToObjectsByManyUrls(urls)
                        .then(function(wikiPageObjects){
                            context.log('[WikipediaCategoryToAIConcepts] resolved ikiPagesToObjectsByManyUrls promise');

                            wikiPageObjects.map(InsertAIConcept);
                            if(verbose) context.log('[WikipediaCategoryToAIConcepts] wikiPageObjects.map completed');
                            context.log('[WikipediaCategoryToAIConcepts] success. Inserted ' + wikiPageObjects.length + ' pageids.');
                            res = {
                                body: "WikipediaCategoryToAIConcepts success. Inserted " + wikiPageObjects.length + " pageids."
                            };
                            context.done(null, res);
                        })
                        .catch(function(err){
                            context.log('[WikipediaCategoryToAIConcepts] rejected WikiPagesToObjectsByManyUrls promise');
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
                context.log('[WikipediaCategoryToAIConcepts] caught err');
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

    if(verbose) context.log('[WikipediaCategoryToAIConcepts] async fired');
};

// TODO: Turn into its own azure function but take a batch of wikiPageObjects. Call it and leave it.
// TODO: Insert category as well, especially after refactoring so this script is recursive to subcategories
function InsertAIConcept(wikiPageObject){
    if(verbose) context.log('[InsertAIConcept] pageid ' + wikiPageObject.pageid);

    try{
        var postOptions = {
            method: 'POST',
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

        // TODO: Change to verbose/wikiPageObject
        if(verbose){
            context.log('[InsertAIConcept] postOptions');
            context.log(postOptions);
        }

        request(postOptions);

    } catch (e) {
        // TODO: Consider printing everything after its all returned in calling methods to prevent strange async stuff.
        context.log('[InsertAIConcept] exception');
        context.log(e);
        reject(e);
    }

    if(verbose) context.log('[InsertAIConcept] completed request ' + wikiPageObject.pageid);
}