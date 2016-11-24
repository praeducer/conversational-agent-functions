'use strict';

const documentClient = require('documentdb').DocumentClient;
const url = require('url');
const path = require('path');
var config = require(path.resolve(__dirname, 'config'));

var context;
var client = new documentClient(config.endpoint, { 'masterKey': config.primaryKey });
var HttpStatusCodes = { NOTFOUND: 404 };
var databaseUrl = 'dbs/' + config.database.id;
var collectionUrl = databaseUrl + '/colls/' + config.collection.id;

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
                    context.log('[InsertAIConcept] inserting ' + req.body.source.pageid);
                    context.bindings.AIConceptDocument = req.body;
                }
                else
                {
                    context.log('[InsertAIConcept] duplicate ' + req.body.source.pageid);
                }
                context.done();
            })
            .catch(function(err){
                context.log('[InsertAIConcept] rejected ' + req.body.source.pageid);
                context.log(err);
            });
    } else {
        context.log('[InsertAIConcept] missing body');
        context.done();
    }
};

// https://docs.microsoft.com/en-us/azure/documentdb/documentdb-nodejs-get-started
function QueryCollection(pageid) {
    context.log('[QueryCollection] pageid ' + pageid + ' index ' + config.collection.id);

    return new Promise((resolve, reject) => {
        try {
            client.queryDocuments(
                collectionUrl,
                'SELECT * FROM AIConcept AIC WHERE AIC.active = true AND AIC.source.pageid ='+ pageid
            ).toArray((err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        } catch (e) {
            context.log('[QueryCollection] exception');
            context.log(e);
            if(err) context.log(err);
            reject(e);
        }
    });
};