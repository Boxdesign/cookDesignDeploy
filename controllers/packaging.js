'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var Packaging = require('../models/packaging');
var Product = require('../models/product');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost'); 
var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator');
var async = require('async'); 
var config = require('../config/config');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.controllers;

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
    inPack.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.packaging)
    var packaging = new Packaging(inPack);
    packaging.save((err,doc) => {
     		if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc);
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
    var packaging = req.body;

    waterfall([
        (cb) => {
            //Obtenemos del modelo original el Id de empresa
            Packaging.findOne({'_id': packaging._id}, 'assigned_location', (err, doc) => {
                if (err) return cb(err)
                if (!doc) {
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);
                }                    
                cb(null, doc);
            });
        }, (param, cb) => {
            packaging.last_account = userData._id;

            Packaging.findById(packaging._id, function (err, pack) {
                if (err) return cb(err);

                pack.gallery = packaging.gallery;
                if(packaging.lang) {pack.lang = packaging.lang; }
                if(packaging.active!=null) {pack.active = packaging.active;}
                if(packaging.family) {pack.family = packaging.family;}
                if(packaging.subfamily) {pack.subfamily = packaging.subfamily;}
                if(packaging.referenceNumber) {pack.referenceNumber = packaging.referenceNumber;}
                if(packaging.measurementUnit) {pack.measurementUnit = packaging.measurementUnit;}
                if(packaging.referencePrice) {pack.referencePrice = packaging.referencePrice;}
                if(packaging.averagePrice) {pack.averagePrice = packaging.averagePrice;}

                pack.save(function (err, doc) {
                     if (err) return cb(err);
                     cb(null, doc);
                }); 
            });            
        }
    ], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
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
 *  @apiParam {string} noQuartering Removes quarterings from the list
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
    var sortPipeline;
    var filterLocation;
    var activePipeline;

    waterfall([
        (cb) => {
            //Construimos los filtros
            //Buscamos primero por textSearch

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }            

            activePipeline={}
            if (params.active)  {
            	if(params.active == 'true') activePipeline =  { active: true }
            	else if (params.active == 'false') activePipeline =  { active: false }
            }

            Packaging.aggregate([
                { // Alternative to populate to use filters on aggregate
                  "$lookup": {
                     "from": "families",
                     "localField": "family",
                     "foreignField": "_id",
                     "as": "family"
                  }
                },
                {"$unwind": "$family" },
                {"$unwind": "$family.lang"},
              	{"$unwind": "$lang" },
                {$match: activePipeline},
                {$match: {'lang.langCode': userProfile.user.language}},
                {$match: {'family.lang.langCode': userProfile.user.language}},
                {$match: {$or:[
                        {'lang.name': {$regex: params.filterText, $options: 'i'}},
                        {'lang.description': {$regex: params.filterText, $options:'i'}},
                        {'family.lang.name' : {$regex: params.filterText, $options: 'i'}}
                    ]
                }}, 
                {$sort: { [sortField] : sortOrder }},
                {$skip: Number(params.perPage)*Number(params.page)},
                {$limit: Number(params.perPage)}
            
            ],(err,docs)=>{
                if(err) return cb(err);
                
                Packaging.populate(docs, {path: "assigned_location last_account gallery measurementUnit"}, (err, docs) => {
                    if(err) return cb(err)
                     cb(null,docs) 

                });

            })


	    },(docs, cb) => {

	        //For those packagings that have a price for filterLocation location, replace referencePrice field with average location-based price
	        if(filterLocation.length) {
	            costHelper.calculateAvgArticleLocCostAndAllergens(docs, filterLocation)
	        }

	        cb(null, docs)

	    },(docs, cb) => {

	    		let data;

	        Packaging.aggregate([
	            //{$match: searchPipeline},
                { // Alternative to populate to use filters on aggregate
                  "$lookup": {
                     "from": "families",
                     "localField": "family",
                     "foreignField": "_id",
                     "as": "family"
                  }
                },
                {"$unwind": "$family" },
                {"$unwind": "$family.lang"},
              	{"$unwind": "$lang" },
                {$match: activePipeline},
                {$match: {'lang.langCode': userProfile.user.language}},
                {$match: {'family.lang.langCode': userProfile.user.language}},
                {$match: {$or:[
                        {'lang.name': {$regex: params.filterText, $options: 'i'}},
                        {'lang.description': {$regex: params.filterText, $options:'i'}},
                        {'family.lang.name' : {$regex: params.filterText, $options: 'i'}}
                    ]
                }}	        
             ],(err,docsCount)=>{
							if(err) return cb(err)

	            data = {
	                'packagings': docs,
	                'totalElements': docsCount.length
	            };
	            cb(null, data)
	        });

	    }], (err, data) => {

	     		if(err) return res.status(500).json(err.message || 'Error').end();
	     		res.status(200).json(data).end();
	    });
};

/**
 * @api {get} /packaging/detail Get Packaging Details
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
    var params = req.query;
    var costHelper = require('../helpers/cost');
    var _id = params._id;
    var filterLocation;

    waterfall([

        (cb) => {

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }

            let userProfile = req.userData;
            //Construimos los filtros

            Packaging.findOne({'_id': _id}, {
                measurementUnit: 1,
                family: 1,
                gallery: 1,
                subfamily: 1,
                referencePrice: 1,
                referenceNumber:1,
                averagePrice: 1,
                locationCost: 1,
                last_account: 1,
                lang: 1,
                active: 1,
            })
            //TODO: Hay un bug al popular family y measurement_unit
            .populate('assigned_location last_account gallery measurementUnit')
            .exec((err, doc) => {
                    if (err) {
                        return cb(err)
                    }
                    return cb(null, doc)
                }
            )

        }, (doc, cb) => {

            //For those ingredients that have a price for filterLocation location, replace averagePrice field with location-based price
            if(filterLocation.length) {

            		if(doc.locationCost && doc.locationCost.length) {

            				let docClone = JSON.parse(JSON.stringify(doc));
            				
            				costHelper.calculateAvgArticleLocCostAndAllergens([docClone], filterLocation); //Updates referencePrice in docClone with location cost average cost.
            				doc.averagePrice = docClone.referencePrice.toFixed(2);
         						cb(null, doc)
                } 
                else 
                { //If there is no location cost, location based cost is equal to reference cost
										doc.averagePrice = doc.referencePrice;
										cb(null, doc)
                }
            } 
            else 
            { //No location filter, just calculate the average of all articles without considering location.

								costHelper.calculateAveragePrice(_id, (err, res)=>{
				        		if(err) return cb(err)
				        		doc.averagePrice = res.toFixed(2);
				        		cb(null, doc)
		        		})
            }

      }], (err, data) => {
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
exports.getPackagingLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;


            Packaging.findOne({'_id': params._id}, {
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
            Packaging.findOne({'_id': utToDelete}, 'assigned_location', (err, doc) => {
                if (err) cb(err)                        
                if (!doc) {
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    cb(err); }
                cb(null, doc);
            });
        },
        (doc, cb) => {
            doc.remove(function (err, doc) {
                if (err) {
                    cb(err);
                }
                cb(null, doc);
            });
        }
    ], (err, ok) => {
         if (err) res.status(500).json(err.message).end();
         res.status(200).json(ok).end();
    })
};

/**
 * @api {get} /packaging/locprices Get packaging's price by location
 * @apiGroup {packaging}
 * @apiName Get packaging's location prices
 *
 * @apiDescription Get packaging's location prices
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getLocPrices = (req, res) => {
    var packId = new ObjectId(req.query._id);
    var userData = req.userData;
    var locationCost = [];
 		var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var packaging;

    waterfall([
        (cb) => {

        		Packaging.findById(packId, (err, doc) => {
        			if(err) return cb(err)
        			if(!doc) {
                var err=new Error('Document not found or empty');
                err.statusCode=400;
                return cb(err);
                }
                packaging = doc;
                packaging.locationCost = [];
                cb(null, doc)
        		})

        }, (doc, cb) => {

        		Packaging.aggregate([
        			{$match: {_id: packId}},
			   			{
			   				$unwind: {
			   					path: "$locationCost",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{$match: {"locationCost.location": {$in: userLocIds}}},
			        { // Alternative to populate
			          "$lookup": {
			              "from": "locations",
			              "localField": "locationCost.location",
			              "foreignField": "_id",
			              "as": "locationCost.location"
			          }
        			},
							{
			   				$unwind: {
			   					path: "$locationCost.location",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{ 
        				"$group": {
									"_id": "$_id",
									"locationCost": { "$push": "$locationCost" },
									"referencePrice" : { $addToSet: "$referencePrice" }
								}
							},
							{
			   				$unwind: {
			   					path: "$referencePrice"
			   				}
			   			},
        		], (err, doc) => {      
                if (err) return cb(err) 
                if (!doc) { 
                    var err=new Error('Document not found or empty');
                    err.statusCode=400;
                    return cb(err);
                }
                
                if(!doc.length) cb(null, packaging)
                else cb(null,doc[0]);                
            });

        }, (doc, cb) => {

            if(doc.locationCost&&doc.locationCost.length) locationCost = locationCost.concat(doc.locationCost) //add location prices to array

            locationCost = locationCost.filter((item) => { //remove items with price zero
              return item.unitCost!=0;
            })

            //Add ref price as first element in the array
            let refPriceObject = {
              location: {name: 'Reference Cost'},
              unitCost: doc.referencePrice
            } 
            
            locationCost.unshift(refPriceObject); //add ref price to array            

            cb(null, locationCost)

        }], (err, ok) => {
            if (err) res.status(err.statusCode).json(err.message).end();
            res.status(200).json(ok).end();
        })
}

/**
 * @api {get} /packaging/packaginginproducts get Version of packaging there are in products
 * @apiGroup {packaging}
 * @apiName get Packaging Version in Product
 *
 * @apiDescription get Packaging Version in Products
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _packagingId _versionId Packaging id Packaging version id 
   
 *
 * @apiSuccess {Object} List of Products that contains our packaging versions
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getPackagingInProducts=(req,res)=>{

    let userProfile = req.userData;
    let params = req.query;
    var packagingId = new ObjectId(params._id);
    params.filterText = params.filterText || '';
    var sortField = params.sortField || 'versions.lang.name';
    if(sortField == '') sortField = 'versions.lang.name'
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
    var page = params.page
    var perPage = params.perPage
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var packagingInProducts=[];
    let object;
    var totalItems = 0;
    var inPackaging = []
    var totalElements = []
    let filteredInPackagings;
    let filterProducts;
    let recipesObjects = []
    var Product = require('../models/product');
    var filterLocation;
    var filterLocationPipeline;    

    waterfall([
        (cb) => {

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }

		        //If an array of filter locations if provided, build the filter location pipeline
		        filterLocationPipeline = {};
		        if (filterLocation.length > 0) {
		            filterLocationPipeline = {'location': {$in: filterLocation}}
		        }


            Product.aggregate([
            {
                $unwind: {
                    path: "$versions",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: "$versions.lang",
                    preserveNullAndEmptyArrays: true
                }
            },
            { // Alternative to populate to use filters on aggregate
              "$lookup": {
                 "from": "families",
                 "localField": "family",
                 "foreignField": "_id",
                 "as": "family"
              }
            },
            { 
              $unwind: {
                path: "$family",
                preserveNullAndEmptyArrays: true
              }
            },
            {$match: {'versions.packaging.packaging' : packagingId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'location': {$in: userLocIds}}},
            {$match: filterLocationPipeline},
            {
               $group: {
                   "_id": "$_id",
                   "family": {$push: "$family"},
                   "measurementUnit": {$push:"$measurementUnit"},
                   "subfamily": {$push:"$subfamily"},
                   "referenceNumber": {$push:"$referenceNumber"},
                   "active": {$push:"$active"},
                   "kitchens": {$push:"$kitchens"},
                   "caducityFresh": {$push:"$caducityFresh"},
                   "caducityFreeze": {$push:"$caducityFreeze"},
                   "daysToUse": {$push:"$daysToUse"},
                   "location": {$push:"$location"},
                   "versions": {$push: "$versions"}
               }
           }], (err, count) => {
                if(err) return cb_async(err)
                totalItems += count.length
                 cb(null,totalItems)  
              })

        },(doc,cb)=>{

            Product.aggregate([
            {
                $unwind: {
                    path: "$versions",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: "$versions.lang",
                    preserveNullAndEmptyArrays: true
                }
            },
            { // Alternative to populate to use filters on aggregate
              "$lookup": {
                 "from": "families",
                 "localField": "family",
                 "foreignField": "_id",
                 "as": "family"
              }
            },
            { 
              $unwind: {
                path: "$family",
                preserveNullAndEmptyArrays: true
              }
            },
            {$match: {'versions.packaging.packaging' : packagingId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'location': {$in: userLocIds}}},
            {$match: filterLocationPipeline},
            {$sort:  {['versions.active']: -1}},
            {
               $group: {
                   "_id": "$_id",
                   "family": {$push: "$family"},
                   "measurementUnit": {$push:"$measurementUnit"},
                   "subfamily": {$push:"$subfamily"},
                   "referenceNumber": {$push:"$referenceNumber"},
                   "active": {$push:"$active"},
                   "kitchens": {$push:"$kitchens"},
                   "caducityFresh": {$push:"$caducityFresh"},
                   "caducityFreeze": {$push:"$caducityFreeze"},
                   "daysToUse": {$push:"$daysToUse"},
                   "location": {$push:"$location"},
                   "versions": {$push: "$versions"}
               }
            },
            {$sort: { [sortField] : sortOrder }},
            {$skip: Number(params.perPage)*Number(params.page)},
            {$limit: Number(params.perPage)} // este aggregate no peta al hacer el primer sort porque la collection packaging no contiene muchos documentos, si se empieza a llenar, hacer $skip y $limit antes del $group
            ], (err, docs) => {
                    if (err) return cb(err)

                      if(docs && docs.length){

                        recipesObjects = [];
                        //console.log(docs.length,'docsPackaging')

                        docs.forEach((product)=>{

                          let activeVersion = product.versions.shift();
                          //console.log(activeVersion,'productPackaging')

                          let object = {
                            _id: product._id,
                            family: product.family[0],
                            subfamily: product.subfamily[0],
                            measurementUnit: product.measurementUnit[0],
                            referenceNumber: product.referenceNumber[0],
                            active: product.active[0],
                            kitchens: product.kitchens[0] || [],
                            caducityFresh: product.caducityFresh[0] || [],
                            caducityFreeze: product.caducityFreeze[0] || [],
                            daysToUse: product.daysToUse[0] || [],
                            location: product.location[0],
                            activeVersion: activeVersion,
                            versions: product.versions
                          }
                          recipesObjects.push(object)
                          
                        })

                        object = {
                            suproducts:[],
                            products: recipesObjects,
                            dishes:[],
                            drinks:[],
                            totalElements: totalItems
                        }

                        packagingInProducts.push(object)

                        cb(null,packagingInProducts)

                      } else {

                        packagingInProducts = [{suproducts:[],products: [],dishes:[],drinks:[],totalElements:0}]

                        cb(null,packagingInProducts)
                      }
             
            })

        }], (err, ok) => {
            if (err) res.status(err.statusCode || 500).json(err.message).end();
            res.status(200).json(ok).end();
        })
 }

/**
 * @api {delete} /ingredient/ingredientInRecipes delete an ingredient associated to subproduct,product,dish or drink.
 * @apiGroup {ingredient}
 * @apiName delete ingredient 
 *
 * @apiDescription delete ingredient in recipe composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} ingredientId Ingredient id recipeId Recipe id RecipeVersionId Recipe Versions id 
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.deletePackagingInProductVersion=(req,res)=>{
    console.log('packagingInProducts')
    let userProfile = req.userData;
    let params = req.query;
    var packagingId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var productId = new ObjectId(params.productId);
    var productVersionId = new ObjectId(params.productVersionId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var packagingInRecipes=[];
    var recipe;
    var Product = require('../models/product');
    let indexArray = []

      async.waterfall([

        (cb)=>{

          Product.findOne({'_id': productId})
               .exec((err,doc)=>{

                  if(err) return cb(err)
                  if(!doc) cb(null,true)
                  if(doc){
                    console.log(doc,'doc')

                    doc.versions.forEach((version)=>{

                      if(version._id.equals(productVersionId)){

                        version.packaging.forEach((packaging, index)=>{
                          let i = index
                          //console.log(composition.element.item,'element.item ==', ingredientId,'ingredientId')
                          if(packaging.packaging.equals(packagingId)) {
                            console.log(index,'index')
                            indexArray.push(i)
                          }

                        })

                        indexArray.forEach((index)=>{
                            version.packaging.splice(index,1)
                        })

                      }

                    })
                    
                    cb(null,doc)
                  }

               })

        },(doc,cb)=>{
          //console.log(recipe.versions.composition,'recipe')
          //console.log(doc.versions.composition,'doc')

          Product.update({_id: doc._id},doc,(err)=>{
            if(err) return cb(err)
              cb(null,doc)
          })

        }],(err, ok)=>{
            console.log(err,'err')
            if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
 }


/**
 * @api {delete} /drink/drinkingastrooffers delete a drink associated to gastroOffer.
 * @apiGroup {drink}
 * @apiName delete drink in gastroOffer 
 *
 * @apiDescription delete drink in gastroOffer composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} drinkId drink id gastroOfferId gastroOffer id gastroOfferVersionId gastroOffer Versions _id
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.deleteAllPackagingInRecipes=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    console.log(req.body,'reqBody')
    console.log(req.query,'reqQuery')
    var packaging = new ObjectId(params.packagingId);
    var recipe = new ObjectId(params.recipeId);
    var type = params.type
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var ingredientInRecipes=[];
    var recipe;
    let indexArray = [];

    if(type == 'subproduct') Model = Subproduct
    if(type == 'product') Model = Product
    if(type == 'dish') Model = Dish
    if(type == 'drink') Model = Drink

      async.waterfall([

        (cb)=>{
            //console.log(gastroOffer,'gastroOfferAPI')
          Model.findOne({'_id': recipe})
                     .populate("versions.composition")
                     .sort({'versions.updatedAt': -1})
               .exec((err,doc)=>{

                  if(err) return cb(err)
                  if(!doc) cb(null,true)
                  if(doc){
                    console.log(doc.versions.length,'docInit')

                    doc.versions.forEach((version, index)=>{

                        if(version.composition.length){

                            version.composition.forEach((composition)=>{
                                let i = index

                                if(composition.element.item.equals(packaging)) {
                                    //console.log(version,'versionMatchToDeleted')
                                    if(version.active == false) indexArray.push(i)
                                }

                            })

                        } 

                        
                    })
                    console.log(indexArray,'indexArray')
                    console.log(doc.versions.length,'docFinish')
                    // doc.versions.forEach((version)=>{

                    //   if(version._id.equals(recipeVersionId)){

                    //     version.composition.forEach((composition, index)=>{
                    //       //console.log(composition.element.item,'element.item ==', ingredientId,'ingredientId')
                    //       if(composition.element.item.equals(subproductId)) {
                    //         console.log(index,'index')
                    //         version.composition.splice(index,1)
                    //       }

                    //     })

                    //   }

                    // })
                    
                    //cb(null,doc)
                    cb(null,doc)
                  }

               })

        },(doc,cb)=>{
          //console.log(recipe.versions.composition,'recipe')
          //console.log(doc.versions.composition,'doc')

          // Model.update({_id: doc._id},doc,(err)=>{
          //   if(err) return cb(err)
          //     cb(null,doc)
          // })

        }],(err, ok)=>{
          console.log(err,'err')
            if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
 }


 /**
 * @api {get} /packaging/updatelocationcost update an packaging location cost based on provider articles associated to it.
 * @apiGroup {packaging}
 * @apiName update packaging location cost
 *
 * @apiDescription update packaging location cost by launching a task
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} id packaging id 
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.updateLocCost=(req,res) => {
    
		var async = require('async');
		var singleArticleLocCostUpdateQueue = require('../queues/singleArticleLocCostUpdate')
	  var params = req.query;

		logger.info('Entering update location cost for packaging.')

	 	async.waterfall([

	 		(cb) => {

	 			if(!params.id) {
	 				logger.error('Packaging location cost update - No id provided!')
	 				let err = new Error('No id provided!')
	 				return cb(err)
	 			} else {
	 				cb(null, true)
	 			}

	 		}, (doc, cb) => {

				var job = singleArticleLocCostUpdateQueue.create(
					{
						title: 'singleArticleLocCostUpdate - Calculate packaging location cost array.',
						model: 'packaging',
						articleId: params.id
					}
				);

				cb(null, true)	

	 		}], (err, doc) => {

				if(err) { 
					 logger.error('Error trying to start task: %s', err.message);
					 return res.status(500).json(err.message || 'Error').end();
				} else {
					 logger.info('Task to update location costs started successfully.');
					 res.status(200).json({message: 'Task to update location costs started successfully.'}).end();
				}

	 		})
 }


//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

 exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator')
    waterfall([
        (cb) => {
            Packaging.find({}, (err, docs) => {
                //console.log(docs,'DOCS')
                if (err) { 
                    cb(err) 
                }
                cb(null,docs);
            });
        }, (docs, cb) => {
                async.eachSeries(docs,function(packaging, cb_async){
                    //console.log(packaging,'each packaging')
                    function generateReferenceNumber() {
                        
                        return function() {
                            //console.log('inside Function',packaging,'packaging')
                              packaging.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.packaging)
                              //console.log(packaging,'referenceNumber')
                                if(packaging.referenceNumber){

                                    //console.log(packaging.referenceNumber,'Reference Number of Ingredient',packaging.lang[0].name)
                                   
                                    packaging.save((err)=>{
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
            if (err) res.status(err.statusCode).json(err.message).end();
            res.status(200).json(ok).end();
        })
};

 exports.refreshLocationCost = (req, res) => {

  	var refreshArticleLocCostQueue = require('../queues/refreshArticleLocCost')

    refreshArticleLocCostQueue.refreshArticleLocCost(
      {
        title: 'Refresh Packagings Location Costs ',
        model: 'packaging'
      }
    ); 
    res.status(200).end();
 }