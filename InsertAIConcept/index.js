// TODO: Handle batches of documents
module.exports = function (context, req) {
    context.log('InsertAIConcept JavaScript HTTP trigger function processed a request.');

    if (req.body && req.body.source && req.body.source.pageid && req.body.title && req.body.extract) {
        res = {
            // status: 200, /* Defaults to 200 */
            body: "inserting " + req.body
        };
        context.bindings.AIConceptDocument = req.body;
    }
    else {
        res = {
            status: 400,
            body: "Missing source.pageid or title or extract in the request body"
        };
    }
    context.done(null, res);
};