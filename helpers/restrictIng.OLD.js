'use strict';

var async = require('async');

/*
 RESTRICT should be a custom plugin that check the referenced schemas for owns ids
 TODO: This function does not search on arrays. It should.
 TODO: Do not work with sub-models. it should.
 */

module.exports = (cb, id, findWhat,relatedModels) => {
   // console.log(relatedModels);
    var matches = [];
    let findCriteria = {};

    findCriteria[findWhat] = id;
    async.each(relatedModels, (Schema, cb) => {
        let schemaName = Schema.modelName;

        Schema.findOne(findCriteria, '_id', (err, doc) => {
            if (err){
                return cb(err)
            }else {
                if (doc){
                    let match = {
                        name: schemaName,
                        doc: doc
                    };
                    matches.push(match);
                }
                cb();
            }
        });
    }, (error) => {
        if( error ) {
            // One of the iterations produced an error.
            // All processing will now stop.
        } else {
            cb(matches);
        }
    });
};