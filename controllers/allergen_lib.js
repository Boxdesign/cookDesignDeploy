'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var Allergen = require('../models/allergen');
var s3Uploader = require('../helpers/s3_uploader');
var fs = require('fs');
var async = require ('async')
var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator'); 
var config = require('../config/config');

/**
 * @api {post} /allergen Add new allergen
 * @apiGroup {allergen}
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
 *             "name": "Marisco",
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "shellfish",
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
    waterfall([
            (cb) => {
                var inAll = req.body;

                inAll.last_account = account._id;
                inAll.assigned_location = account.location._id;
                inAll.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.allergen)
                var allergen = new Allergen(inAll);
                console.log('allergen',allergen)
                allergen.save((err) => {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, allergen);
                });
            }
        ],
        (err, ok) => {
            if (err) {
                return res.status(500).json(err).end();
            }
            return res.status(200).json(ok)
        }
    );
};


/**
 * @api {put} /allergen Edit allergen
 * @apiGroup {allergen}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a allergen
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
 *             "name": "Frutos secos",
 *             "description": "Lorem Ipsum"
 *         },
 *         {
 *             "lang": "en",
 *             "name": "nuts",
 *             "description": "Lorem Ipsum"
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
    let allergen = req.body;

    waterfall([
        (cb) => {
            Allergen.findById(allergen, function (err, allgn) {
                if (err) return cb(err);
                if (!allgn) {
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);
                }
                allgn.gallery = allergen.gallery;
                if(allergen.lang) allgn.lang = allergen.lang; 
                allgn.last_account = userData._id;
                allgn.save((err, updatedIng) => {
                    if (err) return cb(err);
                    cb(null, updatedIng);
                });
            });
        }
    ], (err, ok) => {

        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end()
    })

};

/**
 * @api {get} /allergen Get all allergens
 * @apiGroup {allergen}
 * @apiName Get All
 *
 * @apiDescription Get all allergens with pagination, ordering and filters
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
    params.filterText = params.filterText || '';
    var sortField = params.sortField || 'lang.name';
    var sortOrder = Number(params.sortOrder) || 1;

    waterfall([
        (cb) => {
            //Construimos los filtros
            //Buscamos primero por textSearch

            Allergen.find({$text: {$search: params.filterTex}}, {
                last_account: 1,
                updatedAt: 1,
                parentUnits: 1,
                referenceNumber:1,
                base: 1,
                gallery: 1,
                lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
            })
                .sort({[sortField] : sortOrder})
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('assigned_location last_account parentUnits.unit gallery')
                .exec((err, docs) => {
                        if (docs && docs.length) {
                            return cb(docs)
                        }
                        cb(null, true);//Ejecutaremos la segunda busqueda
                    }
                )
        },
        (useless, cb) => {
            Allergen.find(
                {
                    $or: [
                        {"lang.name": {$regex: params.filterText, $options: 'i'}},
                        {"lang.description": {$regex: params.filterText, $options: 'i'}}
                    ]
                },
                {
                    last_account: 1,
                    updatedAt: 1,
                    parentUnits: 1,
                    referenceNumber:1,
                    base: 1,
                    gallery: 1,
                    lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
                })
                .sort({[sortField] : sortOrder})
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('assigned_location last_account parentUnits.unit gallery')
                .exec((err, docs) => {
                        if (err) {
                            return cb(err)
                        }
                        cb(null, docs)
                    }
                )
        }
    ], (docsText, docsOr) => {
        if (false) {
            return res.status(500).json(err).end();
        }

        let docs = docsText || docsOr;
        let data;
        //Ahora que tenemos todos los elementos, obtenemos el numero total, para poder hacer la paginación

        //Si el $text ha funcionado, hacemos un count con el $text, si no usaremos el $or
        if (docsText) {
            Allergen.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                $text: {$search: params.filterText}
            }, (err, count) => {
        				if(err) return res.status(500).json(err.message || 'Error').end();
                data = {
                    'allergens': docs,
                    'totalElements': count
                };

                res.status(200).json(data);
            });
        } else if (docsOr) {
            Allergen.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                $or: [
                    {"lang.name": {$regex: params.filterText, $options: 'i'}},
                    {"lang.shortName": {$regex: params.filterText, $options: 'i'}}
                ]
            }, (err, count) => {
        				if(err) return res.status(500).json(err.message || 'Error').end();
                data = {
                    'allergens': docs,
                    'totalElements': count
                };

                res.status(200).json(data);
            });
        }
    });
};

/**
 * @api {get} /allergen/details Get all langs for a unit
 * @apiGroup {allergen}
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
exports.getAllergenLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;


            Allergen.findOne({'_id': params._id}, {
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
 * @api {delete} /allergen Delete allergen
 * @apiGroup {allergen}
 * @apiName Delete allergen
 *
 * @apiDescription Delete a have-no-child allergen
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 *
 * @apiError inUse  If the allergen have any dep it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */

exports.remove = (req, res) => {
    var allergen_id = req.query._id;
    var userData = req.userData;

    waterfall([
        (cb) => {
            //Obtenemos del modelo original el Id de empresa
            Allergen.findOne({'_id': allergen_id}, (err, doc) => {
                if (err) cb(err)
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    cb(err);
                }
                cb(null, doc)
            });
        },
        (doc, cb) => {
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
};

//Endpoint created to generate a reference number for each allergen
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

 exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator'); 

    waterfall([
        (cb) => {
            Allergen.find({}, (err, docs) => {
                if (err) { 
                    cb(err) 
                }
                cb(null,docs);
            });
        }, (docs, cb) => {

                async.eachSeries(docs,function(allergen, cb_async){
                    
                    function generateReferenceNumber() {
                        
                        return function() {
                                let filtered = allergen.lang.filter((lang)=>{
                                    return lang.name == ""
                                })

                                if(filtered.length > 0){

                                    filtered.forEach((filteredObject)=>{
                                        let index = allergen.lang.indexOf(filteredObject)
                                        allergen.lang.splice(index,1)
                                    })
                                }

                                allergen.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.allergen)  
                                if(allergen.referenceNumber){

                                    console.log(allergen.referenceNumber,'Reference Number of allergen',allergen.lang[0].name)
                                    
                                    allergen.save((err)=>{
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