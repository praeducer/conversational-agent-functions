var request = require('request');

var getPageidsByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=';
var getSubCategoryByCategoryTitleUrl = 'https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtype=subcat&cmtitle='
var getPagesByPageidsUrl = 'https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&pageids=';

// Takes in the string of the category title e.g. "Category:Computer vision"
var getPageidsByCategoryTitle = function(category){
    context.log('[getPageidsByCategoryTitle] start ' + category);

    category = encodeURIComponent(category);
    var pageids = [];

    // TODO: await async?
    return requestPageidsByCategoryTitle(category, 'continue=', pageids);
}

var requestPageidsByCategoryTitle = function(category, continueParam, pageids){
    var url = getPageidsByCategoryTitleUrl.concat(category + "&" + continueParam);
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            context.log('[getPageidsByCategoryTitle] request ' + url);

            body = JSON.parse(body);
            body.query.categorymembers.forEach(function(element) {
                pageids.push(element.pageid);
            });

            // TODO: await async?
            return requestPageidsByCategoryTitle(category, encodeURIComponent(JSON.stringify(body.continue)), pageids);
        }
    });
}

// TODO: Handle continues
var getPagesByPageids = function(pageids){
    context.log('[getPagesByPageids] start');

    var pageidsStr = pageids.join("|");
    var url = getPagesByPageidsUrl.concat(pageidsStr);

    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            context.log('[getPagesByPageids] request ' + url);

            body = JSON.parse(body);
            body.query.pages.forEach(function(element) {
                context.log(element.title);
            });
        }
    });
}

module.exports = function (context, req) {

    context.log('WikipediaCategoryToAIConcepts JavaScript HTTP trigger function processed a request.');

    if (req.query.category || (req.body && req.body.category)) {
        var pageids = getPageidsByCategoryTitle('Category:' + category);
        getPagesByPageids(pageids);
        res = {
            body: "WikipediaCategoryToAIConcepts success"
        }
    }
    else {
        res = {
            status: 400,
            body: "Please pass a category on the query string or in the request body"
        };
    }
    context.done(null, res);
};