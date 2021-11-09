'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var MeasurementUnit = require('../models/measurementUnit');
var {ObjectId} = require('mongodb');
/**
 * @api {post} /measurementUnit Add new measurement unit
 * @apiGroup {measurement Unit}
 * @apiName Add new
 *
 * @apiDescription Long description
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {json} json  measurement unit.
 *
 * @apiParamExample {json} Request-Example:
 * {
 *     "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Cuchara",
 *             "shortName": "Ch."
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "Spoon",
 *             "shortName": "TSpoon."
 *         }
 *     ],
 *     "paretnUnits": [
 *         {
 *             "unit": "578e04a6df598f322f0aa262",
 *             "quantity": 2.22
 *         },
 *         {
 *             "unit": "578e09a6df598f322f0aa262",
 *             "quantity": .5
 *         }
 *     ]
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
    var inMu = req.body;

    inMu.last_account = account._id;
    
    var mu = new MeasurementUnit(inMu);

    mu.save((err) => {
     		if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(mu);
    });


};

/**
 * @api {put} /measurementUnit Edit new measurement unit
 * @apiGroup {measurement Unit}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a measure unit
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {json} json  measurement unit.
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "_id" : "5BA8e04a6df598f322f0aaCD2"
 *     "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Cuchara",
 *             "shortName": "Ch."
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "Spoon",
 *             "shortName": "TSpoon."
 *         }
 *     ],
 *     "parentUnits": [
 *         {
 *             "unit": "578e04a6df598f322f0aa262",
 *             "quantity": 2.22
 *         },
 *         {
 *             "unit": "578e09a6df598f322f0aa262",
 *             "quantity": .5
 *         }
 *     ]
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
    var updateObj = req.body;
    waterfall([
        (cb) => {           

            MeasurementUnit.findById(updateObj._id, (err, doc) => {
                if (err)
                    return cb(err)
                if (!doc)
                    return res.status(400).json({'message': 'no records found'}).end();
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
                cb(null, doc);

            });
        }, (doc, cb) => {
            //updateObj.last_account = userData._id;
            
            if(updateObj.lang) doc.lang = updateObj.lang;
            if(updateObj.parentUnits) doc.parentUnits = updateObj.parentUnits;
            if(updateObj.base) doc.base = updateObj.base;
            if(updateObj.referenceCode) doc.referenceCode = updateObj.referenceCode;
            //if(updateObj.last_account) doc.last_account = updateObj.last_account;

            doc.save(function (err, doc) {
                if (err) {
                    return cb(err);
                }
                cb(null, doc);
            })
        }
    ], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok)
    })
};

/**
 * @api {get} /measurementUnit Get all measurement units
 * @apiGroup {measurement Unit}
 * @apiName Get All
 *
 * @apiDescription Get all measurement units with pagination, ordering and filters
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

    waterfall([
        (cb) => {
            //Construimos los filtros
            //Buscamos primero por textSearch

            MeasurementUnit.find({$text: {$search: params.filterTex}}, {
                last_account: 1,
                updatedAt: 1,
                referenceCode:1,
                parentUnits: 1,
                base: 1,
                lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
            })
                .sort(params.orderBy)
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('parentUnits.unit')
                .exec((err, docs) => {
                        if (docs && docs.length) {
                            return cb(docs)
                        }
                        cb(null, true);//Ejecutaremos la segunda busqueda
                    }
                )
        },
        (useless, cb) => {
            MeasurementUnit.find(
                {
                    $or: [
                        {"lang.name": {$regex: params.filterText, $options: 'i'}},
                        {"lang.shortName": {$regex: params.filterText, $options: 'i'}}
                    ]
                },
                {
                    last_account: 1,
                    updatedAt: 1,
                    referenceCode:1,
                    parentUnits: 1,
                    base: 1,
                    lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
                })
                .sort(params.orderBy)
                .skip(Number(params.perPage) * Number(params.page))
                .limit(Number(params.perPage))
                .populate('parentUnits.unit')
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
            MeasurementUnit.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                $text: {$search: params.filterTex}
            }, (err, count) => {
        				if(err) return res.status(500).json(err.message || 'Error').end();
                data = {
                    'measurementUnits': docs,
                    'totalElements': count
                };

                res.json(data);
            });
        } else if (docsOr) {
            MeasurementUnit.count({
                lang: {$elemMatch: {langCode: userProfile.user.language}},
                $or: [
                    {"lang.name": {$regex: params.filterText, $options: 'i'}},
                    {"lang.shortName": {$regex: params.filterText, $options: 'i'}}
                ]
            }, (err, count) => {
        				if(err) return res.status(500).json(err.message || 'Error').end();
                data = {
                    'measurementUnits': docs,
                    'totalElements': count
                };

                res.status(200).json(data);
            });
        }
    });
};

/**
 * @api {get} /measurementUnit/base Get base measurement units
 * @apiGroup {measurement Unit}
 * @apiName Get Base
 *
 * @apiDescription Get all base measurement units
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getBaseUnits = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;

            //Construimos los filtros


            MeasurementUnit.find({'base': {$ne: null}}, {
                last_account: 1,
                updatedAt: 1,
                referenceCode:1,
                parentUnits: 1,
                lang: {$elemMatch: {langCode: userProfile.user.language}}, //@TODO elemMatch on populated array
            })
                .populate('parentUnits.unit')
                .exec((err, docs) => {
                        if (err) return cb(err)
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
        res.status(200).json({'measurementUnits': data});

    });
};


/**
 * @api {get} /measurementUnit/conversion Get conversion table
 * @apiGroup {measurement Unit}
 * @apiName Get Conversions
 *
 * @apiDescription Get all measurement units conversions
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  All conversion results

 {[
    "baseUnit" : id base unit,
    "conversions" : [{
        "convUnit" : id conversion unit,
        "quantity" : conversion_amount
    }}
 ]}
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getConversionTable = (req, res) => {
    var conversionTable = [];
    var userProfile = req.userData;
    var params = req.query;

    waterfall([
        (cb) => {
            //Find base units
            MeasurementUnit.find({'base': {$ne: null}}, {
                lang: {$elemMatch: {langCode: userProfile.user.language}},
            })
            .exec((err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs)
            })
        }, (baseUnits, cb) => {            
                //Find non base units
                MeasurementUnit.find({'base': {$eq : null}}, {
                    parentUnits: 1,
                    lang: {$elemMatch: {langCode: userProfile.user.language}},
                })
                .populate('parentUnits.unit')
                .exec((err, nonBaseUnits) => {
                    if (err) return res.status(500).json(err).end();

                    //traverse base units    
                    for (var buIndex=0; buIndex<baseUnits.length; buIndex++) {
                        let baseUnitId = new ObjectId(baseUnits[buIndex]._id);

                        let baseUnitConversionsObj = {
                            "baseUnit": baseUnits[buIndex],
                            "conversions": []
                        }
                        //traverse non base units 
                        for (var nonBuIndex=0; nonBuIndex<nonBaseUnits.length; nonBuIndex++) {

                            //traverse conversions of non base unit and record if any of its parentUnits is pointing to the base unit
                            nonBaseUnits[nonBuIndex].parentUnits.find((conv) =>{
                                let conversionId = new ObjectId(conv.unit._id);

                                if (conversionId.equals(baseUnitId)) {
                                    let convObj = {
                                        "convUnit" : nonBaseUnits[nonBuIndex],
                                        "quantity" : conv.quantity
                                    }
                                    baseUnitConversionsObj.conversions.push(convObj);
                                }
                            })
                        }
                        conversionTable.push(baseUnitConversionsObj);
                    }
                    cb(null, conversionTable)                     
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
}

/**
 * @api {get} /measurementUnit/base Get all langs for a unit
 * @apiGroup {measurement Unit}
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
exports.getLangsUnit = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;


            MeasurementUnit.findOne({'_id': params._id}, {
                lang: 1,
                referenceCode:1
            }).exec((err, docs) => {
                    if (err) {
                        return cb(err)
                    }
                    cb(null, docs)
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
 * @api {delete} /measurementUnit Delete measurement Unit
 *@apiGroup {measurement Unit}
 * @apiName Delete measurement
 *
 * @apiDescription Delete a have-no-child measurement unit
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *@apiParamExample {text} Delete-Example:
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiError haveChilds  If the measurement unit have any child it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */
exports.remove = (req, res) => {
    var muToDelete = req.query._id;
    var userData = req.userData;

    waterfall([
      (cb) => {
            //Obtenemos del modelo original el Id de empresa
            MeasurementUnit.findById(muToDelete, (err, doc) => {
                if (err) return cb(err)
                if (!doc) {
                	let err=new Error('Could not find measurement unit.')
                	return cb(err)
                }
                cb(null, doc);
            });

      }, (doc, cb) => {
              doc.remove(function (err, doc) {
                  if (err) return cb(err);
                  cb(null, doc);
              });
      }], (err, ok) => {
      		if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
      })
};


/**
 * @api {delete} /measurementUnit/conversion Delete conversion unit
 * @apiGroup {measurement Unit}
 * @apiName Delete measurement unit conversion
 *
 * @apiDescription Delete a conversion measurement unit
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiVersion 0.1.0
 *
 */
exports.removeConversionUnit = (req, res) => {
    var parentUnitId = req.query.parentUnitId;
    var conversionUnitId = req.query.conversionUnitId;
    var userData = req.userData;

    //TODO: Define when it is possible to remove a conversion unit.
    //For the time being, it is prevented.

    waterfall([
      (cb) => {
      	
      	let err = new Error('Conversion to base unit can not be deleted.')
      	return cb(err)

      }], (err, ok) => {
      		if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
      })
};