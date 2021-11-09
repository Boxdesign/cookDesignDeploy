'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var Process = require('../models/process');
var async = require ('async');
var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator');
var config = require('../config/config');

/**
 * @api {post} /process Add new process
 * @apiGroup {process}
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
 *             "name": "Proceso 1",
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "Process 1",
 *         }
 *     ],
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
    var inProcess = req.body;

    inProcess.last_account = account._id;
    inProcess.assigned_location = account.location._id;
    inProcess.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.process)
    var process = new Process(inProcess);

    process.save((err) => {
     		if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(process);
    });
};


/**
 * @api {put} /process Edit process
 * @apiGroup {process}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a process
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
 *             "name": "Proceso 1",
 *         },
 *         {
 *             "lang": "en",
 *             "name": "Process 1",
 *         }
 *     ],
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
            Process.findOne({'_id': updateObj._id}, 'assigned_location', (err, doc) => {
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


            Process.update({_id: updateObj._id}, updateObj, (err) => {
                if (err) {
                    return cb(err);
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
 * @api {get} /process Get all process
 * @apiGroup {process}
 * @apiName Get All
 *
 * @apiDescription Get all process with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
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
    var filterText = params.filterText || '';
    var sortField = params.sortField || 'lang.name';
    var sortOrder = Number(params.sortOrder) || 1;

    waterfall([
        (cb) => {
            //Construimos los filtros
            //Buscamos primero por textSearch

            Process.find(
                {
                    $text: {$search: "\"filterText\""}
                }, 
                {
                last_account: 1,
                updatedAt: 1,
                referenceNumber:1,
                parentUnits: 1,
                videos: 1,
                images: 1,
                lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
            })                
                .sort({[sortField] : sortOrder})
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('assigned_location last_account images')
                .exec((err, docs) => {
                        if (docs && docs.length) {
                            return cb(docs)
                        }
                        cb(null, true);//Ejecutaremos la segunda busqueda
                        //console.log(docs,'docs1')
                    }
                )
                
        },
        (useless, cb) => {
            Process.find(
                {
                    "lang.name": {$regex: filterText, $options: 'i'}
                },
                {
                    last_account: 1,
                    updatedAt: 1,
                    parentUnits: 1,
                    referenceNumber:1,
                    videos: 1,
                    images: 1,                    
                    lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
                })
                .sort({[sortField] : sortOrder})
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('assigned_location last_account images')
                .exec((err, docs) => {
                        if (err) {
                            return cb(err)
                        }
                        cb(null, docs)
                        //console.log(docs,'docs2')
                    }
                )

        }
    ], (docsText, docsOr) => {
        if (false) {
            return res.status(500).json(err).end();
        }
        // console.log(docsText,'docsText');
        // console.log(docsOr,'docsOr')
        let docs = docsText || docsOr;
        let data;
        //Ahora que tenemos todos los elementos, obtenemos el numero total, para poder hacer la paginación

        //Si el $text ha funcionado, hacemos un count con el $text, si no usaremos el $or
        if (docsText) {
            Process.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                $text: {$search: "\"filterText\""}
            }, (err, count) => {
		        		if(err) return res.status(500).json(err.message || 'Error').end();

                data = {
                    'process': docs,
                    'totalElements': count
                };

                res.status(200).json(data).end();
            });
        } else if (docsOr) {
            Process.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                "lang.name": {$regex: filterText, $options: 'i'}
            }, (err, count) => {
		        		if(err) return res.status(500).json(err.message || 'Error').end();
                
                data = {
                    'process': docs,
                    'totalElements': count
                };

                res.status(200).json(data).end();
            });
        }
    });
};

/**
 * @api {get} /process/details Get all langs for a unit
 * @apiGroup {process}
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
exports.getProcessLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;

            Process.findOne({'_id': params._id}, {
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
 * @api {delete} /process Delete process
 * @apiGroup {process}
 * @apiName Delete process
 *
 * @apiDescription Delete a have-no-child process
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Delete-Example:
 * {
 *    "_id": "57973cca583324f56361e0f2"
 * }
 *
 * @apiError inUse  If the process have any dep it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */

exports.remove = (req, res) => {
    var process_id = req.query._id;
    var userData = req.userData;

    waterfall([
        (cb) => {
            //Obtenemos del modelo original el Id de empresa
            Process.findOne({'_id': process_id}, 'assigned_location', (err, doc) => {
                if (err)
                    return res.status(500).json(err).end();
                if (!doc)
                    return res.status(400).json(err).end();
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
    //         // Process.findOne()
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
    //             Process.remove({_id: utToDelete}, (err) => {
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
    //})
};

//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

 exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator'); 

    waterfall([
        (cb) => {
            Process.find({}, (err, docs) => {
                if (err) { 
                    return cb(err) 
                }
                cb(null,docs);
            });
        }, (docs, cb) => {

                async.eachSeries(docs,function(process, cb_async){
                    
                    function generateReferenceNumber() {
                        
                        return function() {

                                let filtered = process.lang.filter((lang)=>{
                                    return lang.name == ""
                                })

                                if(filtered.length > 0){

                                    filtered.forEach((filteredObject)=>{

                                        let index = process.lang.indexOf(filteredObject)
                                        process.lang.splice(index,1)
                                        
                                    })
                                    
                                }
                                process.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.process)  
                                if(process.referenceNumber){

                                    console.log(process.referenceNumber,'Reference Number of Process',process.lang[0].name)
                                    
                                    process.save((err)=>{
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