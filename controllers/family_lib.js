'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var Family = require('../models/family');
var async = require('async')
var dbEnums = require('../config/dbEnums');
var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator');
var config = require('../config/config');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.family;

/**
 * @api {post} /family Add new family
 * @apiGroup {family}
 * @apiName Add new
 *
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 *{
 *	"lang":[
 *		{
 *			"langCode": "es",
 *			"name": "Pescado",
 *		},
 *		{
 *			"langCode": "en",
 *			"name": "Fish",
 *		}
 *	],
 *	"subfamilies":[{
 *		"lang":[
 *			{
 *				"langCode": "es",
 *				"name": "Azul",
 *			},
 *			{
 *				"langCode": "en",
 *				"name": "Blue",
 *			}
 *		],
 *	}],
 *	"category": "ingredient",
 *}

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
    var inFam = req.body;

    inFam.last_account = account._id;
    inFam.assigned_location = account.location._id;
    inFam.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.family)
    var family = new Family(inFam);

    family.save((err) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(family);
    });
};

/**
 * @api {post} /family/subfamily Add new subfamily
 * @apiGroup {family}
 * @apiName Add new subfamily
 *
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 *{
 *	"_id": "5BA8e04a6df598f322f0aaCD2" // parent family
 *	"subfamily":{
 *		"lang":[
 *			{
 *				"langCode": "es",
 *				"name": "Azul",
 *			},
 *			{
 *				"langCode": "en",
 *				"name": "Blue",
 *			}
 *		],
 *	},
 *}
 *
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.addSubfamily = (req, res) => {

    var userData = req.userData;
    var inFamSub = req.body;
    inFamSub.subfamily.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.subfamily)

    waterfall([
        (cb) => {
            //Obtenemos del modelo original el Id de empresa
            Family.findOne({'_id': inFamSub._id}, 'assigned_location', (err, doc) => {
                if (err) return cb(err)
                if (!doc)
                    return res.status(400).json(err).end();
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb, doc);
                cb(null,doc);

            });
        }, (param, cb) => {
            inFamSub.last_account = userData._id;

            Family.findOneAndUpdate({"_id": inFamSub._id},
                {
                    "$addToSet": {
                        "subfamilies": inFamSub.subfamily
                    }
                },
                function (err, doc) {
                    if (err) return cb(err);
                    cb(null, inFamSub);
                }
            );

        }
    ], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok)
    })
};


/**
 * @api {put} /family Edit Family
 * @apiGroup {family}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a family
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "id": "5BA8e04a6df598f322f0aaCD2",
 *
 * 	"lang":[
 * 		{
 * 			"langCode": "es",
 * 			"name": "Pescado",
 * 		},
 * 		{
 * 			"langCode": "en",
 * 			"name": "Fish",
 * 		}
 * 	],
 * 	"subfamilies":[{
 * 		"lang":[
 * 			{
 * 				"langCode": "es",
 * 				"name": "Azul",
 * 			},
 * 			{
 * 				"langCode": "en",
 * 				"name": "Blue",
 * 			}
 * 		],
 * 	}],
 * 	"category": "ingredient",
 * }
 *
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
            //Obtenemos del modelo original el Id de empresa
            Family.findOne({'_id': updateObj._id}, 'assigned_location', (err, doc) => {
                if (err)
                    return res.status(500).json(err).end();
                if (!doc)
                    return res.status(400).json(err).end();
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb, doc);
                cb(null, doc);

            });
        }, (param, cb) => {
            updateObj.last_account = userData._id;

            Family.update({_id: updateObj._id}, updateObj, (err) => {
                if (err) return cb(err);
                cb(null, updateObj);
            })
        }
    ], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok)
    })
};

/**
 * @api {put} /family/subfamily Edit subFamily
 * @apiGroup {family}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a subFamily
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 *
 * {
 *      "_id": "57cecdd17102f11022b22326",
 * 		"lang":[
 * 			{
 * 				"langCode": "es",
 * 				"name": "Azul",
 * 			},
 * 			{
 * 				"langCode": "en",
 * 				"name": "Blue",
 * 			}
 * 		],
 * 	}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.editSubfamily = (req, res) => {
    var userData = req.userData;
    let updateObj = req.body;

    waterfall([
        (cb) => {
            //Obtenemos del modelo original el Id de empresa
            Family.findOne({'subfamilies._id': updateObj._id}, 'assigned_location', (err, doc) => {
                if (err) return cb(err)
                if (!doc)
                    return res.status(400).json(err).end();
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb, doc);
                cb(null, doc);

            });
        }, (param, cb) => {
            updateObj.last_account = userData._id;

            Family.findOneAndUpdate({"subfamilies._id": updateObj._id},
                {
                    "$set": {
                        "subfamilies.$": updateObj
                    }
                },
                function (err, doc) {
                    if (err) return cb(err);
                    cb(null, updateObj);
                }
            );

        }
    ], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok)
    })
};


/**
 * @api {get} /family Get all families
 * @apiGroup {family}
 * @apiName Get All
 *
 * @apiDescription Get all families in a category with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {string} category  Family category.
 *  @apiParam {int} perPage  Records per page.
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
exports.getCategoryFamilies = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var filterText = params.filterText || '';
    var sortField = params.sortField || 'lang.name';
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
	var filterLocation;
  	var filterLocationPipeline;
  	var userLocPipeline;
  	var externalPipeline;
  	var externalFamilies;

  	logger.info('Entering getCategoryFamilies. Params are: %s', JSON.stringify(params));

    waterfall([
        (cb) => {

		        if (params.filterLocation) {
		            filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
		        } else {
		            filterLocation = [];
		        }    

		        //If an array of filter locations if provided, build the filter location pipeline
		        filterLocationPipeline = {};
		        if (filterLocation.length > 0 && (params.category == 'recipe' || params.category == 'gastroOffering' || params.category == 'menu'  || params.category == 'season')) {
		            filterLocationPipeline = {'location': {$in: filterLocation}}
		        }

		        userLocPipeline = {};
		        if (params.category == 'recipe' || params.category == 'gastroOffering' || params.category == 'menu'  || params.category == 'season') {
		            userLocPipeline = {'location': {$in: userLocIds}}
		        }

            externalPipeline = {};
            if(params.externalFamilies == 'true') externalFamilies=true;
            else if(params.externalFamilies == 'false') externalFamilies = false;
            if(params.externalFamilies)  externalPipeline = {'externalFamily': externalFamilies}

            Family.aggregate([
                {$unwind: "$lang"},
                {
                    $unwind: {
                        path: "$subfamilies",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: "$subfamilies.lang",
                        preserveNullAndEmptyArrays: true
                    }
                },
				{$match: userLocPipeline},
				{$match: filterLocationPipeline},                    
                {$match: {$or: [{'subfamilies.lang.langCode': userProfile.user.language}, {'subfamilies.lang.langCode': null}]}},
                {$match: {'lang.langCode': userProfile.user.language}},
                {$match: {'category': params.category}},
                {$match: externalPipeline},
                {$match: {'lang.name': {$regex: filterText, $options: 'i'}}},
                {
                    $group: {
                        "_id": "$_id",
                        "lang": {$first: "$lang"},
                        "category": {$first: "$category"},
                        "referenceNumber":{$first: "$referenceNumber"},
                        "externalCode":{$first: "$externalCode"},
                        "subfamilies": {$push: '$subfamilies'},
                        "externalFamily": {$first: '$externalFamily'},
                        "location": {$first: '$location'}                 }
                },
                {$sort: { [sortField] : sortOrder }},
                {$skip: Number(params.perPage)*Number(params.page)},
                {$limit: Number(params.perPage)}
            ], (err, docs) => {
                if (err) {
                    return cb(err)
                }
                cb(null, docs)
            })

        }, (docs, cb) => { //Set externalFamily to false if not defined

        		docs.forEach((doc) => {
        			if(!doc.externalFamily) doc.externalFamily = false;
        		})
        		cb(null, docs)

        }, (docs, cb) => {
            //console.log(docs,'families')
            //Sort subfamilies by name
            docs.forEach((family) => {
                family.subfamilies.sort(function(a,b) {
                    if (a.lang.name < b.lang.name)
                    return -1;
                    if (a.lang.name > b.lang.name)
                        return 1;
                    return 0;
                });
            })
            
            cb(null, docs)

        }, (docs, cb) => {
            //Ahora que tenemos todos los elementos, obtenemos el numero total, para poder hacer la paginación

            // Family.count({
            //     category: params.category,
            //     $or: [
            //         {"lang.name": {$regex: filterText, $options: 'i'}},
            //     ]
            // }, (err, count) => {
            //     if (err) {
            //         return cb(err)
            //     }

            //     docs.forEach((e, i) => {
            //         e.lang = [e.lang]
            //     });

            //     let families = {
            //         'families': docs,
            //         'totalElements': count
            //     };


            //     cb(null, families)
            // })

            Family.aggregate([
                {$unwind: "$lang"},
                {
                    $unwind: {
                        path: "$subfamilies",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: "$subfamilies.lang",
                        preserveNullAndEmptyArrays: true
                    }
                },
				   			{$match: userLocPipeline},
				        {$match: filterLocationPipeline},                    
                {$match: {$or: [{'subfamilies.lang.langCode': userProfile.user.language}, {'subfamilies.lang.langCode': null}]}},
                {$match: {'lang.langCode': userProfile.user.language}},
                {$match: {'category': params.category}},
                {$match: externalPipeline},
                {$match: {'lang.name': {$regex: filterText, $options: 'i'}}},
                {
                    $group: {
                        "_id": "$_id",
                        "lang": {$first: "$lang"},
                        "category": {$first: "$category"},
                        "referenceNumber":{$first: "$referenceNumber"},
                        "externalCode":{$first: "$externalCode"},
                        "subfamilies": {$push: '$subfamilies'},
                        "externalFamily": {$first: '$externalFamily'},
                        "location": {$first: '$location'}                 
                    }
                }
	            ], (err, count) => {
	                if (err) return cb(err)

	                docs.forEach((e, i) => {
			            	e.lang = [e.lang]
			            });

	                let families = {
	                    'families': docs,
	                    'totalElements': count.length
	                };

	                cb(null, families)
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
 * @api {get} /family/details Get all langs for a famly
 * @apiGroup {family}
 * @apiName Get Langs
 *
 * @apiDescription Get all base measurement famly
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
exports.getFamilyLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;


            Family.findOne({'_id': params._id}, {
                lang: 1,
                referenceNumber:1
            }).exec((err, docs) => {
                    if (err) {
                        return cb(err)
                    }
                    console.log('docs',docs)
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
 * @api {get} /family/details/subfamily Get all langs for a Subfamly
 * @apiGroup {family}
 * @apiName Get Subfamily Langs
 *
 * @apiDescription Get all base measurement family
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
exports.getSubFamilyLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;


            Family.findOne({'subfamilies._id': params._id}, {

                //  'subfamilies.lang': 1
            }).exec((err, docs) => {
                    if (err) {
                        return cb(err)
                    }
                    cb(null, docs.subfamilies.id(params._id))
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
 * @api {get} /family/categories Get Categories
 * @apiGroup {family}
 * @apiName Get Categories
 *
 * @apiDescription Get all the available categories for the families
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getFamilyCat = (req, res) => {
    res.status(200).json(dbEnums.families);
};


/**
 * @api {delete} /famly Delete family
 * @apiGroup {family}
 * @apiName Delete family
 *
 * @apiDescription Delete a have-no-child family
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 *
 * @apiError inUse  If the family have any dep it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */

exports.remove = (req, res) => {
    var familyId = req.query._id;
    var userData = req.userData;

    waterfall([
            (cb) => {
                //Obtenemos del modelo original el Id de empresa
                Family.findOne({'_id': familyId}, 'assigned_location', (err, doc) => {
                    if (err)
                        return res.status(500).json(err).end();
                    if (!doc)
                        return res.status(400).json(err).end();
                    //miramos si tiene permisos
                    //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
                    cb(null, doc);
                });

            }, (doc, cb) => {
                if (doc) {
                    doc.remove((err,doc) => {
                        if (err) {
                            cb(err);
                        }
                        cb(null, doc);
                    })
                }
            }
         ], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        }
    )
};

/**
 * @api {delete} /family/subfamily Delete subfamily
 * @apiGroup {family}
 * @apiName Delete subfamily
 *
 * @apiDescription Delete a have-no-child family
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 *
 * @apiError inUse  If the family have any dep it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */

exports.removeSubfamily = (req, res) => {
    var subFamilyId = req.query._id;
    var userData = req.userData;
    var restrict = require('../helpers/familyRestrict');

    waterfall([
            (cb) => {
                //Obtenemos del modelo original el Id de empresa
                Family.findOne({'subfamilies._id': subFamilyId}, '', (err, doc) => {
                    if (err)
                        return cb(err)
                    if (!doc)
                        return res.status(400).json(err).end();
                    cb(null, doc);
                });

            },
            (doc, cb) => {
                if (doc) {
                    Family.findOne({'subfamilies._id': subFamilyId}, '', (err, family) => {
                        if (err) return cb(err)
                        if (!family)
                            return res.status(400).json(err).end();

                        //Verify that there aren't any models that contain this subfamily's family
                        restrict.subfamilyRestrict(subFamilyId, function(err, matches){
                            if(err) return cb(err)
                            if (matches.length > 0) {
                                var err=new Error('Subfamily can not be removed because it is being used.');
                                err.statusCode=400;
                                return cb(err);
                            } else {
                                //Ok to remove subfamily
                                // console.log('ok to remove subfamily')
                                // cb(null, matches);
                                family.subfamilies.id(subFamilyId).remove();

                                family.save((err) => {
                                    if(err) return cb(err);
                                    cb(null, matches); 
                                })
                            }                            
                        })
                        
                    });
                }
            }
        ], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        }
    )
};

//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

 exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator'); 
    var families
    waterfall([
        (cb) => {
            Family.find({}, (err, docs) => {
                if (err) { 
                    return cb(err) 
                }

                families = docs;
                console.log(families.length,'familiesLength',docs.length)
                cb(null,docs);
            });
        }, (docs, cb) => {

                async.eachSeries(families,function(family, cb_async){
                    
                    function generateReferenceNumber() {
                        
                        return function() {

                                let filtered = family.lang.filter((lang)=>{
                                    return lang.name == ""
                                })

                                if(filtered.length > 0){

                                    filtered.forEach((filteredObject)=>{

                                        let index = family.lang.indexOf(filteredObject)
                                        family.lang.splice(index,1)
                                        
                                    })
                                    
                                }

                                family.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.family)  
                                

                              //console.log(family.referenceNumber,'Reference Number of Family',family.lang[0].name,'index:',index,'length:',docs.length)
                              process.nextTick(() => cb_async());
                                
                        }
                    }
                    setTimeout(generateReferenceNumber(), 5);

                },function(err){
                    cb(null,true)
                })

        },(docs,cb) =>{

            //console.log('secondStep to generate referenceNumber of Subfamilies')
                    async.eachSeries(families,function(family, cb_async){

                        if(family.subfamilies.length > 0){
                            
                            async.eachSeries(family.subfamilies, (subfamily,cb_async2)=>{
                                
                                function generateReferenceNumber(){

                                    return function(){

                                        let filtered = subfamily.lang.filter((lang)=>{
                                            return lang.name == ""
                                        })

                                        if(filtered.length > 0){

                                            filtered.forEach((filteredObject)=>{

                                                let index = subfamily.lang.indexOf(filteredObject)
                                                subfamily.lang.splice(index,1)
                                                
                                            })
                                            
                                        }
                                        
                                        subfamily.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.subfamily)
                                        
                                        //console.log(subfamily.referenceNumber,'Reference Number of SubFamily',subfamily.lang[0].name,'subfamilies length:',family.subfamilies.length,'of Family',family.lang[0].name,'with reference Number:',family.referenceNumber)
                                        
                                        process.nextTick(()=> cb_async2()); 
                                    }
                                }
                                setTimeout(generateReferenceNumber(),5)

                            }, (err) => {
                                process.nextTick(() => cb_async());
                            })

                        } else {
                            process.nextTick(() => cb_async());

                        }

                    },function(err){ 
                        cb(null,true) 
                    });

        },(docs,cb)=>{
            //console.log(families.length,'famsLength')
            
            async.eachSeries(families,function(family,cb_async){
                 //console.log(family,'save Family')
                    
                    family.save((err)=>{

                        if(err)return cb_async(err);
                        process.nextTick(()=> cb_async());
                    })
                
            },function(err){
                if(err) return cb(err)
                cb(null,true)
            })

        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
};

//Endpoint created to generate a reference number for each family using Selenta's 9-digit coding system
// 0 		-> Type of family (subproduct or dish). Subproduct is digit 5. This digit will be generated dynamically when data is sent to Selenta. 
// 1-2 	-> Family
// 3-8  -> Subfamily

exports.generateSelentaRecipeFamilyReferenceNumber = (req , res) => {

	var zip = require('express-zip');
	var json2csv = require('json2csv');
	var fs = require('fs');
	var families
	var typeNumber = 5;
	var familiesNumberIndex = 1;
	var subfamiliesNumberIndex;
	var externalCode;
	var familyArray = [];
    var loggerHelper = require('../helpers/logger');
    const logger = loggerHelper.generateSelentaReferenceNumber;

 	logger.info('Entering generateSelentaReferenceNumber...')

	async.waterfall([
		(cb) => {

			Family.find({"category": 'recipe'}, (err, docs) => {
				if (err) return cb(err)

				families = docs;
				cb(null,docs);
			});

		},(docs,cb) => { 

        //console.log('secondStep to generate referenceNumber of Subfamilies')
        families.forEach((family)=>{

        	//Remove families that, for some reason, have empty names.
        	let filtered = family.lang.filter((lang)=>{
        		return lang.name == ""
        	})

        	if(filtered.length > 0){

        		filtered.forEach((filteredObject)=>{

        			let index = family.lang.indexOf(filteredObject)
        			family.lang.splice(index,1)

        		})

        	}

      	  //Assign family code
        	if(familiesNumberIndex < 10)	family.externalCode = '0' + familiesNumberIndex.toString();
					else family.externalCode = familiesNumberIndex.toString();

        	familiesNumberIndex++;

        	//Assign subfamily code
        	if(family.subfamilies.length > 0) {

        		subfamiliesNumberIndex=1001;

        		family.subfamilies.forEach((subfamily)=>{

        			//Remove subfamilies that, for some reason, have empty names.
        			let filtered = subfamily.lang.filter((lang)=>{
        				return lang.name == ""
        			})

        			if(filtered.length > 0){

        				filtered.forEach((filteredObject)=>{

        					let index = subfamily.lang.indexOf(filteredObject)
        					subfamily.lang.splice(index,1)

        				})

        			}

        			externalCode = '00' + subfamiliesNumberIndex;
        			subfamily.externalCode = family.externalCode + externalCode;
        			subfamiliesNumberIndex ++;

        		})

        	} 

        })

        cb(null,docs)

      },(docs,cb)=>{ //Save families

      	 async.eachSeries(families, (family, cb_async) => {

      	 		family.save((err, doc) => {
      	 			if(err) return cb_async(err)
      	 			cb_async()
      	 		})

      	 }, (err) => {

      	 	if(err) return cb(err)
      	 	cb(null, docs)
      	 })

      	 // families.forEach((family) => {
      	 // 		logger.info('Family name: %s, external code: %s ', family.lang[0].name, family.externalCode)
      	 // 		family.subfamilies.forEach((subfamily) => {
      	 // 			logger.info('Subfamily name: %s external code: %s ', subfamily.lang[0].name, subfamily.externalCode)
      	 // 		})
      	 // })

      }], (err, docs) => {

      	if(err) return res.status(err.statusCode || 500).json(err.message || 'Error' ).end()
    		logger.info('generateSelentaReferenceNumber completed successfully.')
    		res.status(200).json({message: 'Family code generation completed successfully'}).end()
      })
}


exports.downloadSelentaRecipeFamilyReferenceNumber = (req , res) => {

	var zip = require('express-zip');
	var json2csv = require('json2csv');
	var fs = require('fs');
	var families
	var typeNumber = 5;
	var familiesNumberIndex = 1;
	var subfamiliesNumberIndex = 1001;
	var externalCode;
	var familyArray = [];

	async.waterfall([
		(cb) => {

			Family.find({"category": 'recipe'}, (err, docs) => {
				if (err) return cb(err)

				families = docs;
				cb(null,docs);
			});

		},(docs,cb) =>{ 

        //console.log('secondStep to generate referenceNumber of Subfamilies')
        families.forEach((family)=>{

        	//Remove lang objects in family that for some reason are empty.
        	let filtered = family.lang.filter((lang)=>{
        		return lang.name == ""
        	})

        	if(filtered.length > 0){

        		filtered.forEach((filteredObject)=>{

        			let index = family.lang.indexOf(filteredObject)
        			family.lang.splice(index,1)

        		})

        	}

        	let dataObject = {
      				familyCode: family.externalCode,
      				familyName: family.lang[0].name,
      				subfamilyCode: typeNumber + family.externalCode + '001000',
      				subfamilyName: '<NO SUBFAMILY>'
      			}

      		familyArray.push(dataObject);

        	//Assign subfamily code
        	if(family.subfamilies.length > 0){

        		family.subfamilies.forEach((subfamily)=>{

        			//Remove lang objects in subfamily that for some reason are empty.
        			let filtered = subfamily.lang.filter((lang)=>{
        				return lang.name == ""
        			})

        			if(filtered.length > 0){

        				filtered.forEach((filteredObject)=>{

        					let index = subfamily.lang.indexOf(filteredObject)
        					subfamily.lang.splice(index,1)

        				})

        			}

        			let dataObject = {
        				familyCode: family.externalCode,
        				familyName: family.lang[0].name,
        				subfamilyCode: typeNumber + subfamily.externalCode,
        				subfamilyName: subfamily.lang[0].name
        			}

        			familyArray.push(dataObject);

        		})

        	}

        })
        cb(null,docs)

      },(docs,cb)=>{
      	var fields = ['familyCode','familyName','subfamilyCode','subfamilyName'];
      	var fieldNames = ['Código família','Nombre família','Código subfamília','Nombre '];

      	json2csv({ data: familyArray, fields: fields }, function(err, csv) {
      		if (err) return cb(err);
      		fs.writeFile('/tmp/reportfamilies.csv', csv, function(err) {
      			if (err) return cb(err);
              // logger.debug('Report Controller --- generateSelentaReferenceNumber --- CSV = { data: familyArray %j , fields: fields %s',familyArray,fields)
              // logger.debug('Report Controller --- generateSelentaReferenceNumber --- We can already download the csv file: %j',csv)
              cb(null, docs)
            });           
      	});

      }], (err, docs) => {

      	if(err) return res.status(500).json(err.message || 'Error' ).end()
      		res.zip([
      			{ path: '/tmp/reportfamilies.csv', name: 'reportfamilies.csv' }
      			], 'FamilyReport-'+'.zip');
      })

 }

	exports.assignFamilyToOrganizationLoc = (req , res) => {

		var Location = require('../models/location')
		var Family = require('../models/family')
		var async = require('async')
		var organizationId;
		var families;

		async.waterfall([

			(cb) => {

				//Get location ids
				Location.find({},{_id:true}, (err, docs) => {
					if(err) return cb(err)
					if(!docs.length) {
						let err = new Error('Could not find any location!')
						return cb(err)
					}
					organizationId = docs[0];
					cb(null, true)
				})

			},(doc,cb)=> {

				//Get families
				Family.find({}, (err, docs) => {
					if(err) return cb(err)
					if(!docs.length) {
						let err = new Error('Could not find any families!')
						return cb(err)
					}
					families = docs;
					cb(null, true)
				})

			},(doc,cb)=> {

				async.eachSeries(families, (family, cb_async) => {

					family.location = []

					if(family.category == 'recipe' || family.category == 'gastroOffering' || family.category == 'menu'  || family.category == 'season') {
							
							family.location = family.location.concat([organizationId])							
					}

					family.save((err)=> {
						if(err) return cb_async(err)
						cb_async()
					})

				}, (err) => { //Finished family loop
					if(err) return cb(err)
					cb(null, true)
				})

			}], (err,doc) => {
      	if(err) return res.status(err.statusCode || 500).json(err.message || 'Error' ).end()
    		res.status(200).json({message: 'Updated family locations successfully'}).end()
		})
	}


	exports.assignFamilyToAllLoc = (req , res) => {

		var Location = require('../models/location')
		var Family = require('../models/family')
		var async = require('async')
		var locations;
		var families;

		async.waterfall([

			(cb) => {

				//Get location ids
				Location.find({},{_id:true}, (err, docs) => {
					if(err) return cb(err)
					if(!docs.length) {
						let err = new Error('Could not find any location!')
						return cb(err)
					}
					locations = docs;
					cb(null, true)
				})

			},(doc,cb)=> {

				//Get families
				Family.find({}, (err, docs) => {
					if(err) return cb(err)
					if(!docs.length) {
						let err = new Error('Could not find any families!')
						return cb(err)
					}
					families = docs;
					cb(null, true)
				})

			},(doc,cb)=> {

				async.eachSeries(families, (family, cb_async) => {

					family.location = []

					if(family.category == 'recipe' || family.category == 'gastroOffering' || family.category == 'menu'  || family.category == 'season') {

						family.location = family.location.concat(locations)

					}

					family.save((err)=> {
						if(err) return cb_async(err)
						cb_async()
					})

				}, (err) => { //Finished family loop
					if(err) return cb(err)
					cb(null, true)
				})

			}], (err,doc) => {
      	if(err) return res.status(err.statusCode || 500).json(err.message || 'Error' ).end()
    		res.status(200).json({message: 'Updated family locations successfully'}).end()
		})
	}

