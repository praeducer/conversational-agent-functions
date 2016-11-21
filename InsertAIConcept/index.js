"use strict";

const documentClient = require("documentdb").DocumentClient;
const url = require('url');
const path = require('path');
var config = require(path.resolve(__dirname, 'config'));

var context;
var client = new documentClient(config.endpoint, { "masterKey": config.primaryKey });
var HttpStatusCodes = { NOTFOUND: 404 };
var databaseUrl = `dbs/${config.database.id}`;
var collectionUrl = `${databaseUrl}/colls/${config.collection.id}`;

// TODO: Handle batches of documents
// TODO: Only updated if a revision was made since the last time the script was ran: https://www.mediawiki.org/wiki/API:Revisions
module.exports = function (cntxt, req) {
    context = cntxt;
    context.log('[InsertAIConcept] JavaScript HTTP trigger function processed a request.');

    if (req.body && req.body.source && req.body.source.pageid && req.body.title && req.body.extract) {
        QueryCollection(req.body.source.pageid)
            .then(function(results){
                // If there is not an entry already         
                if(results && results.length == 0){
                    context.log("[InsertAIConcept] inserting " + req.body);
                    context.res = {
                        // status: 200, /* Defaults to 200 */
                        body: "[InsertAIConcept] inserting " + req.body
                    };
                    context.bindings.AIConceptDocument = req.body;
                }
                else
                {
                    context.log("[InsertAIConcept] duplicate " + JSON.stringify(req.body));
                    context.res = {
                        // TODO: A duplicate is ok but we should let the client know through a more useful status code
                        status: 200,
                        body: "[InsertAIConcept] duplicate " + req.body
                    };
                }
                context.done(null, context.res);
            })
            .catch(function(err){
                context.log('[InsertAIConcept] rejected ' + JSON.stringify(req.body));
                context.log(err);
                context.done(null, context.res);
            });
    }
    else {
        context.res = {
            status: 400,
            body: "Missing source.pageid or title or extract in the request body"
        };
        context.done(null, context.res);
    }
};

// https://docs.microsoft.com/en-us/azure/documentdb/documentdb-nodejs-get-started
function QueryCollection(pageid) {
    context.log('[QueryCollection] pageid ' + pageid + ' index ' + config.collection.id);

    return new Promise((resolve, reject) => {
        client.queryDocuments(
            collectionUrl,
            'SELECT VALUE r.children FROM root r WHERE r.source.pageid = "'+ pageid + '"'
        ).toArray((err, results) => {
            if (err) reject(err)
            else {
                for (var queryResult of results) {
                    let resultString = JSON.stringify(queryResult);
                    context.log('[QueryCollection] returned ${resultString}');
                }
                resolve(results);
            }
        });
    });
};