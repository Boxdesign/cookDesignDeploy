'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var Packformat = require('../models/packFormat');
var async = require('async')
var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator');
var config = require('../config/config');

/**
 * @api {post} /packaging Add new packaging
 * @apiGroup {packaging}
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
 *             "name": "Bote",
 *             "description" : "Lorem ipsum" // Optional
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "pot",
 *         }
 *     ],
 *     "family": "57d692393315c162e7d45366",
 *     "subfamily" : "57d692393315c162e7d45366" // Optional
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
    var inPack = req.body;

    inPack.last_account = account._id;
    inPack.assigned_location = account.location._id;
    inPack.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.packFormat)
    var packFormat = new Packformat(inPack);
    //console.log(packFormat,'packFormat')
    packFormat.save((err) => {
     		if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(packFormat);
    });
};


/**
 * @api {put} /packaging Edit packaging
 * @apiGroup {packaging}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a packaging
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *     "_id" : "57d692393315c162e7d45366",
 *     "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Bote",
 *             "description" : "Lorem ipsum" // Optional
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "pot",
 *         }
 *     ],
 *     "family": "57d692393315c162e7d45366",
 *     "subfamily" : "57d692393315c162e7d45366" // Optional
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
    let updateObj = req.body;
    waterfall([
        (cb) => {
            Packformat.findById(updateObj, function (err, packFormat) {
                if (err) return cb(err);
                if (!packFormat) {
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);
                }
                packFormat.gallery = updateObj.gallery;
                if(updateObj.lang) packFormat.lang = updateObj.lang; 
                packFormat.last_account = userData._id;
                packFormat.save((err, updatedIng) => {
                    if (err) return cb(err);
                    cb(null, updatedIng);
                });
            });
        }
    ], (err, ok) => {
     		if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok)
    })
};

/**
 * @api {get} /packaging Get all packagings
 * @apiGroup {packaging}
 * @apiName Get All
 *
 * @apiDescription Get all packagings with pagination, ordering and filters
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

           
            Packformat.find({$text: {$search: params.filterText}}, {
                last_account: 1,
                updatedAt: 1,
                referenceNumber:1,
                gallery: 1,
                lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
            })
                .sort({[sortField] : sortOrder})
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('assigned_location last_account gallery')
                .exec((err, docs) => {
                        if (docs && docs.length) {
                            return cb(docs)
                        }
                        cb(null, true);//Ejecutaremos la segunda busqueda
                    }
                )
        },
        (useless, cb) => {
            Packformat.find(
                {
                    $or: [
                        {"lang.name": {$regex: params.filterText, $options: 'i'}},
                        {"lang.shortName": {$regex: params.filterText, $options: 'i'}}
                    ]
                },
                {
                    last_account: 1,
                    updatedAt: 1,
                    referenceNumber:1,
                    gallery: 1,
                    lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
                })
                .sort({[sortField] : sortOrder})
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('assigned_location last_account gallery')
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
            Packformat.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                $text: {$search: params.filterText}
            }, (err, count) => {

        				if(err) return res.status(500).json(err.message || 'Error').end();

                // docs.forEach((e, i) => {
                //     e.family.subfamilies = e.family.subfamilies.id(e.subfamily);
                // });

                data = {
                    'packagings': docs,
                    'totalElements': count
                };

                res.status(200).json(data);
            });
        } else if (docsOr) {
            Packformat.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                $or: [
                    {"lang.name": {$regex: params.filterText, $options: 'i'}},
                    {"lang.shortName": {$regex: params.filterText, $options: 'i'}}
                ]
            }, (err, count) => {
		        		if(err) return res.status(500).json(err.message || 'Error').end();
                data = {
                    'packagings': docs,
                    'totalElements': count
                };

                res.status(200).json(data);
            });
        }
    });
};

/**
 * @api {get} /packaging/detail Get Packformat Details
 * @apiGroup {packaging}
 * @apiName Get packaging
 *
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {String} _id  The object ID.
 *
 * @apiSuccess {Object} .  The packaging
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getDetail = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let _id = req.query._id;

            //Construimos los filtros

            Packformat.findOne({'_id': _id}, {
                last_account: 1,
                referenceNumber:1,
                lang: 1,
            })
            //TODO: Hay un bug al popular family y measurement_unit
                .populate('assigned_location last_account gallery')
                .exec((err, docs) => {
                        if (err) {
                            return cb(err)
                        }
                        return cb(null, docs)
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
 * @api {get} /packaging/lang Get all langs for a package
 * @apiGroup {packaging}
 * @apiName Get Langs
 *
 * @apiDescription Get all translates for a package
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
exports.getPackFormatLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;


            Packformat.findOne({'_id': params._id}, {
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
 * @api {delete} /packaging Delete packaging
 * @apiGroup {packaging}
 * @apiName Delete packaging
 *
 * @apiDescription Delete a have-no-child packaging
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Delete-Example:
 * {
 *    "_id": "57973cca583324f56361e0f2"
 * }
 *
 * @apiError inUse  If the packaging have any dep it cannot be deleted
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
            Packformat.findOne({'_id': utToDelete}, 'assigned_location', (err, doc) => {
                if (err)
                    return res.status(500).json(err).end();
                if (!doc)
                    return res.status(400).json(err).end();
                //miramos si tiene permisos
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
                cb(null, doc);

            });

        },
        (ok, cb) => {
            //miramos si no tiene ninguna unidad de meida asignada
            //todo mirar si tiene alguna depencencia
            // Packformat.findOne()
            //     .elemMatch('parentUnits', {unit: utToDelete})
            //     .exec((err, doc) => {
            //         if (err)
            //             return cb(true);
            //         if (doc)
            //             return cb('inUse');
            //         cb(null, true)
            //     });
            cb(null, true)

        },
        (canDelete, cb) => {
            if (canDelete) {
                Packformat.remove({_id: utToDelete}, (err) => {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, true);
                })
            }
        }
    ], (err, ok) => {
        if (err) {
            switch (err) {
                case  'inUse':
                    return res.status(400).json({'message': err}).end();

                    break;
                default:
                    return res.status(500).json(err).end();
                    break;
            }
        }

        res.status(200).json({'deleted': 'ok'}).end();
    })
};

//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

 exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator'); 

    waterfall([
        (cb) => {
            Packformat.find({}, (err, docs) => {
                if (err) { 
                    return cb(err) 
                }
                cb(null,docs);
            });
        }, (docs, cb) => {

                async.eachSeries(docs,function(packFormat, cb_async){
                    
                    function generateReferenceNumber() {
                        
                        return function() {
                                let filtered = packFormat.lang.filter((lang)=>{
                                    return lang.name == ""
                                })

                                if(filtered.length > 0){

                                    filtered.forEach((filteredObject)=>{

                                        let index = packFormat.lang.indexOf(filteredObject)
                                        packFormat.lang.splice(index,1)
                                        
                                    })
                                    
                                }

                                packFormat.referenceNumber =  referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.packFormat)  
                                if(packFormat.referenceNumber){

                                    //console.log(packFormat.referenceNumber,'Reference Number of PackFormat',packFormat.lang[0].name)
                                    
                                    packFormat.save((err)=>{
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