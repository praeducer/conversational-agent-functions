var request = require('request');

module.exports = function (context, req) {

    context.log('WikipediaCategoryToAIConcepts JavaScript HTTP trigger function processed a request.');

    if (req.query.category || (req.body && req.body.category)) {

        var url = 'https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=';
        var category = encodeURIComponent(req.query.category || req.body.category);
        url = url.concat(category);

        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                context.log('Request successful for category: ' + category);
                res = {
                    // status: 200, /* Defaults to 200 */
                    body: body
                };
            }
        })
    }
    else {
        res = {
            status: 400,
            body: "Please pass a category on the query string or in the request body"
        };
    }
    context.done(null, res);
};