'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
require('../models/checkpoint');
var Checkpoint = require('../models/checkpoint');
var async = require('async')
var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator'); 
var config = require('../config/config');

/**
 * @api {post} /checkpoint Add new checkpoint
 * @apiGroup {checkpoint}
 * @apiName Add new
 *
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *     "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Temperatura",
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "pan",
 *         }
 *     ],
 *     "critical": true //Boolean
 * }
 *
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.add = (req, res) => {


    var account = req.userData;
    var inCheckp = req.body;

    inCheckp.last_account = account._id;
    inCheckp.assigned_location = account.location._id;
    inCheckp.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.checkpoint)
    var checkpoint = new Checkpoint(inCheckp);
    console.log(checkpoint,'checkpoint')
    checkpoint.save((err) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(checkpoint);
    });
};


/**
 * @api {put} /checkpoint Edit checkpoint
 * @apiGroup {checkpoint}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a checkpoint
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "_id": "5BA8e04a6df598f322f0aaCD2"
 *     "lang":[
 *         {
 *             "lang": "es",
 *             "name": "Temperatura",
 *         },
 *         {
 *             "lang": "en",
 *             "name": "Temp",
 *         }
 *     ],
 *     "critical": true //Boolean
 * }
 *
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.edit = (req, res) => {
    var userData = req.userData;
    waterfall([
        (cb) => {
            let updateObj = req.body;

            //Obtenemos del modelo original el Id de empresa
            Checkpoint.findOne({'_id': updateObj._id}, 'assigned_location', (err, doc) => {
                if (err)
                    return res.status(500).json(err).end();
                if (!doc)
                    return res.status(400).json(doc).end();
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
                cb(null, doc);

            });
        }, (param, cb) => {
            let updateObj = req.body;
            updateObj.last_account = userData._id;


            Checkpoint.update({_id: updateObj._id}, updateObj, (err) => {
                if (err) {
                    cb(err);
                }
                cb(null, updateObj);
            })
        }
    ], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok)
    })
};

/**
 * @api {get} /checkpoint Get all checkpoints
 * @apiGroup {checkpoint}
 * @apiName Get All
 *
 * @apiDescription Get all checkpoints with type, pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {string} type  Type of checkpoint: critical or gastronomic.
 *  @apiParam {int} perPage  Recors per page.
 *  @apiParam {int} page  Page number.
 *  @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 *  @apiParam {string} filterText  Text te filter (in name field).
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getAll = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var sortField = params.sortField || 'lang.name';
    var sortOrder = Number(params.sortOrder) || 1;

    waterfall([
        (cb) => {
            //Construimos los filtros

            Checkpoint.aggregate([
                {$unwind: "$lang"},
                {$match: {'lang.langCode': userProfile.user.language}},
                {$match: {'type': params.type}},
                {$match: {'lang.name': {$regex: params.filterText, $options: 'i'}}},
                {$sort: { [sortField] : sortOrder }},
                {$skip: Number(params.page)*Number(params.perPage)},
                {$limit: Number(params.perPage)},
               
            ], (err, docs) => {
                if (err) {
                    return cb(err)
                }
                cb(null, docs)
            })
        },
        (docs, cb) => {
            //Ahora que tenemos todos los elementos, obtenemos el numero total, para poder hacer la paginación

            Checkpoint.count({
                type: params.type,
                $or: [
                    {"lang.name": {$regex: params.filterText, $options: 'i'}},
                ]
            }, (err, count) => {
                if (err) {
                    return cb(err)
                }

                // docs.forEach((e, i) => {
                //     e.lang = [e.lang]
                // });

                let checkpoints = {
                    'checkpoints': docs,
                    'totalElements': count
                };


                cb(null, checkpoints)
            })
        }
    ], (err, data) => {
        if (err) {
            return res.status(500).json(err).end();
        } else if (!data) {
            return res.status(400).json(data).end();
        }
        res.status(200).json(data);

    });
};

/**
 * @api {get} /checkpoint/details Get all langs for a unit
 * @apiGroup {checkpoint}
 * @apiName Get Langs
 *
 * @apiDescription Get all base measurement units
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {text} Get-Example:
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getCheckpointLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;


            Checkpoint.findOne({'_id': params._id}, {
                lang: 1
            }).exec((err, docs) => {
                    if (err) {
                        return cb(err)
                    }
                    cb(null, docs)
                }
            )
        }
    ], (err, data) => {
        if (err) {
            return res.status(500).json(err).end();
        } else if (!data) {
            return res.status(400).json(data).end();
        }
        res.status(200).json(data);

    });
};

/**
 * @api {delete} /checkpoint Delete checkpoint
 * @apiGroup {checkpoint}
 * @apiName Delete checkpoint
 *
 * @apiDescription Delete a have-no-child checkpoint
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Delete-Example:
 * {
 *    "_id": "57973cca583324f56361e0f2"
 * }
 *
 * @apiError inUse  If the checkpoint have any dep it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */

exports.remove = (req, res) => {
    var utToDelete = req.query._id;
    var userData = req.userData;

    waterfall([
        (cb) => {
            //Obtenemos del modelo original el Id de empresa
            Checkpoint.findOne({'_id': utToDelete}, 'assigned_location', (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                	let err = new Error('Error')
                	return cb(err)
                }
                    
                //miramos si tiene permisos
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
                cb(null, doc);
            });

        },(doc, cb) => {
            if (doc) {
                doc.remove((err, doc) => {
                    if (err) return cb(err);
                    cb(null, doc);
                })
            }
        }
        ], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })

    //     (ok, cb) => {
    //         //miramos si no tiene ninguna unidad de meida asignada
    //         //todo mirar si tiene alguna depencencia
    //         // MeasurementUnit.findOne()
    //         //     .elemMatch('parentUnits', {unit: utToDelete})
    //         //     .exec((err, doc) => {
    //         //         if (err)
    //         //             return cb(true);
    //         //         if (doc)
    //         //             return cb('inUse');
    //         //         cb(null, true)
    //         //     });
    //         cb(null, true)

    //     },
    //     (canDelete, cb) => {
    //         if (canDelete) {
    //             Checkpoint.remove({_id: utToDelete}, (err) => {
    //                 if (err) {
    //                     return cb(err);
    //                 }
    //                 cb(null, true);
    //             })
    //         }
    //     }
    // ], (err, ok) => {
    //     if (err) {
    //         switch (err) {
    //             case  'inUse':
    //                 res.status(400).json({'message': err}).end();

    //                 break;
    //             default:
    //                 res.status(500).json(err).end();
    //                 break;
    //         }
    //     }

    //     res.json({'deleted': 'ok'}).end();
    // })
};

//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

 exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator'); 

    waterfall([
        (cb) => {
            Checkpoint.find({}, (err, docs) => {
                if (err) { 
                    cb(err) 
                }
                cb(null,docs);
            });
        }, (docs, cb) => {

                async.eachSeries(docs,function(checkpoint, cb_async){
                    
                    function generateReferenceNumber() {
                        
                        return function() {

                                let filtered = checkpoint.lang.filter((lang)=>{
                                    return lang.name == ""
                                })

                                if(filtered.length > 0){

                                    filtered.forEach((filteredObject)=>{

                                        let index = checkpoint.lang.indexOf(filteredObject)
                                        checkpoint.lang.splice(index,1)
                                        
                                    })
                                    
                                }
                                
                                checkpoint.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.checkpoint)  
                                if(checkpoint.referenceNumber){

                                		let name = '';
                                		if(checkpoint.lang && checkpoint.lang.length) name = checkpoint.lang[0].name;

                                    console.log(checkpoint.referenceNumber,'Reference Number of Checkpoint',name)
                                    
                                    checkpoint.save((err)=>{
                                        if(err) return cb_async(err)
                                        cb_async();
                                    })
                                }
                        }
                    }
                    setTimeout(generateReferenceNumber(), 1);

                },function(err){
                    cb(null,true)
                })
                           
        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
};

exports.deleteCheckpointsInCookingSteps = (req,res) => {

    var cookingStepsHelper = require('../helpers/cookingSteps')
    var checkpoints;
    var loggerHelper = require('../helpers/logger');
    const logger = loggerHelper.removeCheckpoints;

    console.log('Entering deleteCheckpointsInCookingSteps')

    logger.info('Entering Delete checkpoints Method in Checkpoint_lib')
    
    waterfall([

    	(cb) => {
    
            cookingStepsHelper.deleteCheckpoints((err,ok)=>{
                if(err) return cb(err)
                cb(null,true)
            })

        }],(err, ok) => {
            if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })

}