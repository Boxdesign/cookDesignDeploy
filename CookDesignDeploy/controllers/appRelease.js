 var async = require('async');
 var AppRelease = require('../models/appRelease');
 var {ObjectId} = require('mongodb');
 var mongoose = require('../node_modules/mongoose');

/**
 * @api {get} /apprelase/getAll Get all app releases ordered by date
 * @apiGroup {apprelase}
 * @apiName Get app releases
 *
 * @apiDescription Get app releases
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} App relase list
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getAll = (req, res) => {
    //Get account information.

    async.waterfall([
        (cb) => {	

            AppRelease.find()
            .sort({published_at: -1})
            .exec((err, docs) => {
                if(err) return cb(err)
                cb(null, docs)
            })

         }], (err, docs) => {
            if (err) return res.status(500).json(err).end();
            res.status(200).json(docs);
    });
};