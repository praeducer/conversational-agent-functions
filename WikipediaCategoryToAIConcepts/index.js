// https://github.com/request/request-promise
var fs = require("fs");
var path = require("path");
var packageJSON = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")
);
var request = require("request-promise");
var wikipedia = require("./wikipedia");
var insertAIConceptUri = process.env["AIConceptURI"];

// Promises: https://developers.google.com/web/fundamentals/getting-started/primers/promises
module.exports = function(context, req) {
  context.log.info(
    "[WikipediaCategoryToAIConcepts] JavaScript HTTP trigger function processed a request."
  );

  var category =
    (req.query instanceof Object && req.query.category) ||
    (req.body instanceof Object && req.body.category);
  // Check that the category is a string.
  if (!(typeof category === "string")) {
    throw new Error(
      "Please pass a category on the query string or in the request body."
    );
  }
  context.log.info(
    "[WikipediaCategoryToAIConcepts] Processing " + category + "."
  );

  var subcategory_pages = [];
  var category_pages = [];

  Promise.all([
    requestSubcategories(category)
      .then(function(categorymembers) {
        return categorymembers.map(function(element) {
          return element.title.slice("Category:".length);
        });
      })
      .then(function(subcategoryTitles) {
        return Promise.all(
          subcategoryTitles.map(function(category) {
            return requestCategoryMembers(category);
          })
        );
      })
      .then(flattenOnce)
      .then(function getPageIds(categorymembers) {
        return categorymembers.map(function(element) {
          return element.pageid;
        });
      }),
    requestCategoryMembers(category)
      .then(flattenOnce)
      .then(function getPageIds(categorymembers) {
        return categorymembers.map(function(element) {
          return element.pageid;
        });
      })
  ])
    .then(flattenOnce)
    .then(function(pageids) {
      return Array.from(new Set(pageids));
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
                response.query.pageids.forEach(function(element, index) {
                  if (
                    response.query.pages[element].pageid &&
                    response.query.pages[element].title &&
                    response.query.pages[element].extract
                  ) {
                    context.log.info(
                      "[WikiPagesToObjectsByUrl] found " +
                        response.query.pages[element].title
                    );
                    wikiPageObjects.push({
                      pageid: response.query.pages[element].pageid,
                      title: response.query.pages[element].title,
                      extract: response.query.pages[element].extract
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
    .then(flattenOnce)
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

function WikipediaResponse(response) {
  if (response.error instanceof Object) {
    throw response.error;
  }
  return response;
}

function onFailure(context) {
  return function(error) {
    var message,
      res = {
        status: 400
      };
    if (error instanceof Object) {
      message =
        "[WikipediaCategoryToAIConcepts] " +
        (error.message || error.info || error.error || error.status);
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

function RequestCategoryMembers(category) {
  context.log.info("[WikipediaCategoryToAIConcepts] category=" + category);
  return request(wikipedia.CategoryMembers(category));
}

function flattenOnce(arr) {
  return [].concat.apply([], arr);
}

function requestCategoryMembers(category) {
  var categoryMembers = [];
  return requestContinued(
    request,
    wikipedia.CategoryMembers.bind(null, category, 20),
    function(response) {
      response = WikipediaResponse(response);
      categoryMembers.push(response.query.categorymembers);
      return (
        response.continue instanceof Object && response.continue.cmcontinue
      );
    },
    200
  )().then(function() {
    return flattenOnce(categoryMembers);
  });
}

function requestSubcategories(category) {
  var subcategories = [];
  return requestContinued(
    request,
    wikipedia.Subcategories.bind(null, category),
    function(response) {
      response = WikipediaResponse(response);
      subcategories.push(response.query.categorymembers);
      return (
        response.continue instanceof Object && response.continue.cmcontinue
      );
    },
    200
  )().then(function() {
    return flattenOnce(subcategories);
  });
}

// Continue the request until it stops.
function requestContinued(
  request,
  continueRequestBuilder,
  parseResponse,
  // Make sure we're not querying the endpoint too fast.
  throttle = 200,
  // Limit the total number of queries.
  limit = Infinity
) {
  var cycles = 0;
  function continueRequest(continueParam) {
    return new Promise(function(resolve) {
      // TODO: This doesn't work for promises in parallel, only for a single continue thread.
      setTimeout(resolve, throttle > 0 ? 1000 / throttle : 0);
    })
      .then(function() {
        return request(continueRequestBuilder(continueParam));
      })
      .then(parseResponse)
      .then(function(nextContinueParam) {
        return typeof nextContinueParam === "string" && cycles < limit
          ? ++cycles && continueRequest(nextContinueParam)
          : cycles;
      });
  }
  return continueRequest;
}
