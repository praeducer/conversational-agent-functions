var config = require("./config");
const documentClient = require("documentdb").DocumentClient;
var client = new documentClient(config.uri, {
    masterKey: config.key
});
var collectionEndpoint = `dbs/${ config.database }/colls/${ config.collection}`

// TODO: Handle batches of documents
// TODO: Only updated if a revision was made since the last time the script was ran: https://www.mediawiki.org/wiki/API:Revisions
module.exports = function(context, req) {
    context.log(
        "[InsertAIConcept] JavaScript HTTP trigger function processed a request."
    );

    if (
        req.body &&
        req.body.source &&
        req.body.source.pageid &&
        req.body.title &&
        req.body.extract
    ) {
        context.log(
            "[QueryCollection] pageid " +
                req.body.source.pageid +
                " index " +
                config.collection.id
        );

        QueryCollection(req.body.source.pageid)
            .then(function(results) {
                // If there is not an entry already
                if (results instanceof Object && results.length === 0) {
                    context.log.info(
                        "[InsertAIConcept] inserting " + req.body.source.pageid
                    );
                    context.bindings.AIConceptDocument = req.body;
                } else {
                    context.log.info(
                        "[InsertAIConcept] duplicate " + req.body.source.pageid
                    );
                }
            })
            .then(context.done)
            .catch(function(err) {
                context.log(
                    "[InsertAIConcept] insertion failed " +
                        req.body.source.pageid
                );
                context.log.error(err);
            });
    } else {
        context.log("[InsertAIConcept] data missing");
        context.done();
    }
};

// https://docs.microsoft.com/en-us/azure/documentdb/documentdb-nodejs-get-started
function QueryCollection(pageid) {
    return new Promise(function(resolve, reject) {
        client
            .queryDocuments(collectionUrl, {
                query:
                    "SELECT * FROM AIConcept AIC WHERE AIC.active = true AND AIC.source.pageid = @pageid",
                parameters: [{ name: "pageid", value: pageid }]
            })
            .toArray(function(err, results) {
                if (err) reject(err);
                else resolve(results);
            });
    });
}
