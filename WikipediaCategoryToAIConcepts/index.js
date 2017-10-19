// For testing
var test = false;
// TODO: setup to run local: context = console, var res, var req, hide all dones, call instead of exporting the main function
var local = false;

// https://github.com/request/request-promise
const request = require("request-promise");
const fs = require("fs");
const path = require("path");

var appRoot = process.cwd();
var packageJSON = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")
);

var wikipedia = require("./wikipedia");
// TODO: Store in an environment variable e.g. process.env[code];
var insertAIConceptUri = "<YOUR AIConcept ENDPOINT HERE>"

// TODO: Make this recursive for subcategories. Can call itself. Have it take in another param for depth, stop after depth is 0.
// TODO: Make sure this does not stop all requests after a single request fails
// TODO: Config this so it can run locally or on azure
// TODO: Turn into its own azure function but take a batch of wikiPageObjects. Call it and leave it.
// TODO: Insert category as well, especially after refactoring so this script is recursive to subcategories
// Category must be valid for a url. All spaces replaced with '_', underscore.
// Promises: https://developers.google.com/web/fundamentals/getting-started/primers/promises
module.exports = function(context, req) {
    function onFailure(context) {
        return function(error) {
            var message,
                res = {
                    status: 400
                };
            if (error instanceof Object) {
                message =
                    "[WikipediaCategoryToAIConcepts] " +
                    (error.message ||
                        error.info ||
                        error.error ||
                        error.status);
                Object.assign(res, error);
            } else {
                message = "[WikipediaCategoryToAIConcepts] " + error;
                res.body = message;
            }
            context.log.error(message);
            context.log.error(error);
            context.done(error, res);
        };
    }

    function WikipediaResponse(response) {
        if (response.error instanceof Object) {
            throw response.error;
        }
        return response;
    }

    context.log.info(
        "[WikipediaCategoryToAIConcepts] JavaScript HTTP trigger function processed a request."
    );

    new Promise(function CheckRequestForCategory(fulfill, reject) {
        var category =
            (req.query instanceof Object && req.query.category) ||
            (req.body instanceof Object && req.body.category);
        // Check that the category is a string.
        if (typeof category === "string") {
            fulfill(category);
        } else {
            reject(
                "Please pass a category on the query string or in the request body."
            );
        }
    })
        .then(function RequestCategoryMembers(category) {
            context.log.info(
                "[WikipediaCategoryToAIConcepts] category=" + category
            );
            return request(wikipedia.CategoryMembers(category));
        })
        .then(WikipediaResponse)
        .then(function ParseCategoryMembersPageIds(response) {
            // Collect the pageids from the categorymember's response.
            return response.query.categorymembers.map(function(element) {
                return element.pageid;
            });
        })
        .then(function BatchPageIds(pageids) {
            var batches = [];
            // Process in batches of 20
            var increment = 20;
            var position = 0;
            var upperBound = pageids.length;
            while (position < upperBound) {
                var batchSize = Math.min(upperBound - position, increment);
                batches.push(pageids.slice(position, position + batchSize));
                position = position + batchSize;
            }
            return batches;
        })
        .then(function RequestPagesInBatches(pageidsBatches) {
            // Get the page object for each pageid.
            return Promise.all(
                pageidsBatches.map(function RequestPagesBatch(pageids) {
                    return request(wikipedia.Pages(pageids))
                        .then(WikipediaResponse)
                        .then(function ParsePageObjects(response) {
                            var wikiPageObjects = [];
                            // Keep only the objects that contain pageid, extract, and title.
                            if (response.query.pageids) {
                                response.query.pageids.forEach(function (
                                    element,
                                    index
                                ) {
                                    if (
                                        response.query.pages[element].pageid &&
                                        response.query.pages[element].title &&
                                        response.query.pages[element].extract
                                    ) {
                                        context.log.info(
                                            "[WikiPagesToObjectsByUrl] found " +
                                                response.query.pages[element]
                                                    .title
                                        );
                                        wikiPageObjects.push({
                                            pageid:
                                                response.query.pages[element]
                                                    .pageid,
                                            title:
                                                response.query.pages[element]
                                                    .title,
                                            extract:
                                                response.query.pages[element]
                                                    .extract
                                        });
                                    } else {
                                        context.log.warn(
                                            "[WikiPagesToObjectsByUrl] page " +
                                                element +
                                                " missing data."
                                        );
                                    }
                                });
                            }
                            return wikiPageObjects;
                        })
                        .catch(function PageRequestFailure() {
                            // Log page request failure.
                            context.log.warn(
                                "[WikiPagesToObjectsByUrl] page request failure."
                            );
                            return [];
                        });
                })
            );
        })
        .then(function FlattenBatches(batches) {
            // Flatten the batches.
            return batches.reduce(function(flat, batch) {
                return flat.concat(batch);
            }, []);
        })
        .then(function InsertAIConcept(pageObjects) {
            return Promise.all(
                pageObjects.map(function(wikiPageObject) {
                    // Insert AI concept
                    var requestOptions = {
                        method: "POST",
                        uri: insertAIConceptUri,
                        body: {
                            source: {
                                pageid: wikiPageObject.pageid,
                                name: "wikipedia",
                                accessedDate: Date.now(),
                                scriptVersion: packageJSON.version
                            },
                            title: wikiPageObject.title,
                            extract: wikiPageObject.extract,
                            active: true
                        },
                        json: true
                    }; // Automatically stringifies the body to JSON
                    return request(requestOptions);
                })
            );
        })
        .then(function Conclude() {
            context.done(null, { status: 200 });
        })
        .catch(onFailure(context));
};
