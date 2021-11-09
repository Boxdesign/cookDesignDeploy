'use strict';

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var costHelper = require('../helpers/cost');
var fs = require('fs');
var async = require('async');
var Ingredient = require('../models/ingredient');
var Article = require('../models/article');
var { ObjectId } = require('mongodb');
var Location = require('../models/location');
var Subproduct = require('../models/subproduct');
var Drink = require('../models/drinks');
var Dish = require('../models/dish');
var Product = require('../models/product');
var config = require('../config/config');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.controllers;

/**
 * @api {post} /ingredient Add new ingredient
 * @apiGroup {ingredient}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Ingredient-Creation:
 * {
 *     "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Tomate",
 *             "description": "Es rojo y redondo",
 *             "equivalenceUnitName": "Matojo",
 *             "tastingNote": "Sabor dulce",
 *             "region": "El Ejido",
 *             "alcoholPercentage":"5º"
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "Tomato",
 *             "description": "Red and Rounded"
 *         }
 *     ],
 *     "active" : true,
 *     "equivalenceQty" : 1.2, //Optional
 *     "measurement_unit" : "57973cca583324f56361e0f2",
 *     "family": "579880396e5381c71f902785",
 *     "subfamily": "579880396e5381c71f902785", //Optional
 *     "allergens" : [
 *         {
 *             "allergen" : "5798dc9faa418daf36993f86",
 *             "level" : 2
 *         }
 *     ]
 * }
 *
 *
 *
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.add = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator');
    var account = req.userData;
    var inIngredient = req.body;

    inIngredient.assigned_location = account.location._id;
    inIngredient.last_account = account._id;
    inIngredient.imagePath = req.file ? req.file.path : undefined;
    inIngredient.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.ingredient)
    var ingredient = new Ingredient(inIngredient);
    //console.log(ingredient,'adding ingredient API')
    ingredient.save((err, doc) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc);
    });
};

/**
 * @api {put} /ingredient Edit ingredient
 * @apiGroup {ingredient}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a ingredient.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Ingredient-Edit:
 * {
 *   "_id": "57ab47cde8378046169688a4",
 *    "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Tomate",
 *             "description": "Es rojo y redondo",
 *             "equivalenceUnitName": "Matojo"
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "Tomato",
 *             "description": "Red and Rounded"
 *         }
 *     ],
 *     "active" : true,
 *     "equivalenceQty" : 1.2, //Optional
 *     "measurement_unit" : "57973cca583324f56361e0f2",
 *     "family": "579880396e5381c71f902785",
 *     "subfamily": "579880396e5381c71f902785", //Optional
 *     "allergens" : [
 *         {
 *             "allergen" : "5798dc9faa418daf36993f86",
 *             "level" : 2
 *         }
 *     ]
 * }
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.edit = (req, res) => {
    var userData = req.userData;
    let ingredient = req.body;
    //console.log(ingredient,'ingredient updated API')
    let IngredientId = new ObjectId(ingredient._id);

    logger.info('Entering ingredient edit controller.');

    waterfall([
        (cb) => {
            //Se ha encontrado el registro a reemplazar            
            Ingredient.findById(IngredientId, function(err, ing) {
                if (err) return cb(err);
                if (!ing) {
                    var err = new Error('Document not found');
                    err.statusCode = 400;
                    return cb(err);
                }
                ing.gallery = ingredient.gallery;
                if (ingredient.lang) ing.lang = ingredient.lang;
                ing.equivalenceQty = ingredient.equivalenceQty;
                if (ingredient.active != null) ing.active = ingredient.active;
                if (ingredient.family) ing.family = ingredient.family;
                if (ingredient.subfamily) ing.subfamily = ingredient.subfamily;
                if (ingredient.measurementUnit) ing.measurementUnit = ingredient.measurementUnit;
                if (ingredient.referenceNumber) ing.referenceNumber = ingredient.referenceNumber;
                if (ingredient.referencePrice) ing.referencePrice = ingredient.referencePrice;
                if (ingredient.averagePrice) ing.averagePrice = ingredient.averagePrice;
                if (ingredient.allergens) ing.allergens = ingredient.allergens;
                if (ingredient.quartering) ing.quartering = ingredient.quartering;
                if (ingredient.netPercentage) ing.netPercentage = ingredient.netPercentage;
                if (ingredient.ingredientPercentage) ing.ingredientPercentage = ingredient.ingredientPercentage;
                if (ingredient.temporality) ing.temporality = ingredient.temporality;
                ing.last_account = userData._id;

                ing.save((err, updatedIng) => {
                    if (err) return cb(err);
                    logger.info('Ingredient updated.')
                    cb(null, updatedIng);
                });
            });
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/**
 * @api {put} /ingredient/bach Edit ingredient
 * @apiGroup {ingredient}
 * @apiName Edit bach
 *
 * @apiDescription Batch updates lots of ingredients
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Ingredient/Quartering-Edit:
 * { "batch":[
 *      {
 *        "_id": "57ab47cde8378046169688a4",//mandatory (any other prop is optional)
 *        "netPercentage" : 25
 *      },
 *      {
 *        "_id": "57ab47cde837804616969fc5",//mandatory (any other prop is optional)
 *        "netPercentage" : 20
 *      }
 *  ]
 * }
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
var userData;
exports.editBatch = (req, res) => {
    userData = req.userData;
    let ingredientBatch = req.body;

    if (Array.isArray(ingredientBatch.batch)) {
        return res.status(400).json({ 'error': "Element provided is not array" });
    }

    async.each(ingredientBatch.batch, updateIngredient, (err) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(true);
    });


};

var updateIngredient = (ingredient, cbAsync) => {
    waterfall([
        (cb) => {

            //Obtenemos del modelo original el Id de empresa
            Ingredient.findOne({ '_id': ingredient._id }, '', (err, doc) => {
                if (err) return cb(err);
                //locHelper.canEdit(userData.location._id, doc.assigned_location, cb, doc);
                cb(null, doc);

            });
        }, (doc, cb) => {
            //Se ha encontrado el registro a reemplazar
            ingredient.last_account = userData._id;

            Ingredient.update({ _id: ingredient._id }, ingredient, (err) => {
                if (err) return cb(err);
                cb(null, ingredient);
            })
        }
    ], (err, ok) => {
        if (err) return cbAsync(err)
        cbAsync()
    })
};

/**s
 * @api {get} /ingredient Get all ingredients
 * @apiGroup {ingredient}
 * @apiName Get All
 *
 * @apiDescription Get all ingredients with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {int} perPage  Recors per page.
 *  @apiParam {int} page  Page number.
 *  @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 *  @apiParam {string} filterText  Text te filter (in name field).
 *  @apiParam {string} filterLocation Locations to use for cost
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
    var filterLocation;
    var activePipeline;
    var quarteringPipeline;

    waterfall([
        (cb) => {
            //Construimos los filtros
            //Buscamos primero por textSearch

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }


            activePipeline = {}
            if (params.active) {
                if (params.active == 'true') activePipeline = { active: true }
                else if (params.active == 'false') activePipeline = { active: false }
            }

            quarteringPipeline = {};
            if (params.noQuartering) quarteringPipeline = { quartering: null }

            Ingredient.aggregate([{ // Alternative to populate to use filters on aggregate
                    "$lookup": {
                        "from": "families",
                        "localField": "family",
                        "foreignField": "_id",
                        "as": "family"
                    }
                },
                { "$unwind": "$family" },
                { "$unwind": "$family.lang" },
                { "$unwind": "$lang" },
                { $match: activePipeline },
                { $match: quarteringPipeline },
                { $match: { 'lang.langCode': userProfile.user.language } },
                { $match: { 'family.lang.langCode': userProfile.user.language } },
                {
                    $match: {
                        $or: [
                            { 'lang.name': { $regex: params.filterText, $options: 'i' } },
                            { 'lang.description': { $regex: params.filterText, $options: 'i' } },
                            { 'family.lang.name': { $regex: params.filterText, $options: 'i' } }
                        ]
                    }
                },
                {
                    $sort: {
                        [sortField]: sortOrder
                    }
                },
                { $skip: Number(params.perPage) * Number(params.page) },
                { $limit: Number(params.perPage) }
            ], (err, docs) => {
                if (err) return cb(err);
                //docs.forEach((doc) => { console.log(doc.family.lang) })

                Ingredient.populate(docs, { path: "assigned_location last_account gallery measurementUnit quartering" }, (err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs)
                });

            })

        }, (docs, cb) => {

            //For those ingredients that have a price for filterLocation location, replace referencePrice field with average location-based price
            if (filterLocation.length) {
                costHelper.calculateAvgArticleLocCostAndAllergens(docs, filterLocation)
            }

            cb(null, docs)

        }, (docs, cb) => {

            let data;

            Ingredient.aggregate([{ // Alternative to populate to use filters on aggregate
                    "$lookup": {
                        "from": "families",
                        "localField": "family",
                        "foreignField": "_id",
                        "as": "family"
                    }
                },
                { "$unwind": "$family" },
                { "$unwind": "$family.lang" },
                { "$unwind": "$lang" },
                { $match: activePipeline },
                { $match: quarteringPipeline },
                { $match: { 'lang.langCode': userProfile.user.language } },
                { $match: { 'family.lang.langCode': userProfile.user.language } },
                {
                    $match: {
                        $or: [
                            { 'lang.name': { $regex: params.filterText, $options: 'i' } },
                            { 'lang.description': { $regex: params.filterText, $options: 'i' } },
                            { 'family.lang.name': { $regex: params.filterText, $options: 'i' } }
                        ]
                    }
                }
            ], (err, docsCount) => {
                if (err) return cb(err)
                data = {
                    'ingredients': docs,
                    'totalElements': docsCount.length
                };
                cb(null, data)
            });

        }
    ], (err, data) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(data).end();
    });
};

/**
 * @api {get} /ingredient/detail Get Ingredient Details
 * @apiGroup {ingredient}
 * @apiName Get ingredit
 *
 * @apiDescription Get all ingredients with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {String} _id  The object ID.
 * @apiParam {string} filterLocation Location to use for cost
 *
 * @apiSuccess {Object} .  The ingredient
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getDetail = (req, res) => {
    let params = req.query;
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
            Ingredient.findOne({ '_id': _id })
                //TODO: Hay un bug al popular family y measurement_unit
                .populate('allergens assigned_location last_account gallery measurementUnit')
                .exec((err, doc) => {
                    if (err) return cb(err)
                    cb(null, doc)
                })

        }, (doc, cb) => {

            //For those ingredients that have a price for filterLocation location, replace averagePrice field with location-based price
            if (filterLocation.length) {

                if (doc.locationCost && doc.locationCost.length) {

                    let docClone = JSON.parse(JSON.stringify(doc));

                    costHelper.calculateAvgArticleLocCostAndAllergens([docClone], filterLocation); //Updates referencePrice in docClone with location cost average cost.
                    doc.averagePrice = docClone.referencePrice.toFixed(2);
                    cb(null, doc)
                } else { //If there is no location cost, location based cost is equal to reference cost
                    doc.averagePrice = doc.referencePrice;
                    cb(null, doc)
                }
            } else { //No location filter, just calculate the average of all articles without considering location.

                costHelper.calculateAveragePrice(_id, (err, res) => {
                    if (err) return cb(err)
                    doc.averagePrice = res.toFixed(2);
                    cb(null, doc)
                })
            }

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
 * @api {get} /ingredient/lang Get all langs for a unit
 * @apiGroup {utensil}
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
exports.getLang = (req, res) => {
    waterfall([
        (cb) => {
            let userProfile = req.userData;
            let params = req.query;

            Ingredient.findOne({ '_id': params._id }, (err, doc) => {
                if (err) return cb(err);
                return cb(null, doc);
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
 * @api {delete} /ingredient Delete ingredient
 * @apiGroup {ingredient}
 * @apiName Delete ingredient
 *
 * @apiDescription Delete a have-no-child ingredient
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {String} _id  The ingredient ID.
 *
 * @apiParamExample {text} Get-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 *
 * @apiVersion 0.1.0
 *
 */

exports.remove = (req, res) => {
    var ingId = new ObjectId(req.query._id);
    var userData = req.userData;

    waterfall([
        (cb) => {
            Ingredient.findById(ingId, (err, doc) => {
                if (err) {
                    return cb(err)
                }
                if (!doc) {
                    var err = new Error('Document not found');
                    err.statusCode = 400;
                    return cb(err);
                }
                cb(null, doc);
            });
        }, (doc, cb) => {
            doc.remove(function(err, doc) {
                if (err) {
                    return cb(err);
                }
                cb(null, doc);
            });
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};

/**
 * @api {get} /ingredient/locprices Get ingredient's price by location
 * @apiGroup {ingredient}
 * @apiName Get ingredient's location prices
 *
 * @apiDescription Get ingredient's location prices. First price in the array is the referencePrice.
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
    var ingId = new ObjectId(req.query._id);
    var userData = req.userData;
    var locationCost = [];
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var ingredient;

    waterfall([
        (cb) => {

            Ingredient.findById(ingId, (err, doc) => {
                if (err) return cb(err)
                if (!doc) {
                    var err = new Error('Document not found or empty');
                    err.statusCode = 400;
                    return cb(err);
                }
                ingredient = doc;
                ingredient.locationCost = [];
                cb(null, doc)
            })

        }, (doc, cb) => {

            Ingredient.aggregate([
                { $match: { _id: ingId } },
                {
                    $unwind: {
                        path: "$locationCost",
                        preserveNullAndEmptyArrays: true
                    }
                },
                { $match: { "locationCost.location": { $in: userLocIds } } },
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
                        "referencePrice": { $addToSet: "$referencePrice" }
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
                    var err = new Error('Document not found or empty');
                    err.statusCode = 400;
                    return cb(err);
                }
                if (!doc.length) cb(null, ingredient)
                else cb(null, doc[0]);
            });

        }, (doc, cb) => {

            if (doc.locationCost && doc.locationCost.length) locationCost = locationCost.concat(doc.locationCost) //add location prices to array

            locationCost = locationCost.filter((item) => { //remove items with price zero
                return item.unitCost != 0;
            })

            //Add ref price as first element in the array
            let refPriceObject = {
                location: { name: 'Reference Cost' },
                unitCost: doc.referencePrice
            }
            locationCost.unshift(refPriceObject); //add ref price to array            

            cb(null, locationCost)

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};
/**
 * @api {get} /ingredient/locprices Get ingredient's price by location
 * @apiGroup {ingredient}
 * @apiName Get ingredient's location prices
 *
 * @apiDescription Get ingredient's location prices. First price in the array is the referencePrice.
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

exports.getLocAllergens = (req, res) => {
    var ingId = new ObjectId(req.query._id);
    console.log(ingId, 'ingId')
    var userData = req.userData;
    var locationAllergens = [];
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var ingredient;
    let Allergen = require('../models/allergen');
    let Gallery = require('../models/gallery');

    waterfall([
        (cb) => {

            Ingredient.findById(ingId, (err, doc) => {
                if (err) return cb(err)
                if (!doc) {
                    var err = new Error('Document not found or empty');
                    err.statusCode = 400;
                    return cb(err);
                }
                ingredient = doc;
                // console.log(ingredient, 'ingredient')
                ingredient.locationAllergens = [];
                cb(null, doc)
            })

        }, (doc, cb) => {

            Ingredient.aggregate([
                { $match: { _id: ingId } },
                { $project: { locationAllergens: 1 } },
                {
                    $unwind: {
                        path: "$locationAllergens",
                        preserveNullAndEmptyArrays: true
                    }
                },
                { $match: { "locationAllergens.location": { $in: userLocIds } } },

                {
                    "$group": {
                        "_id": "$_id",
                        "locationAllergens": { "$push": "$locationAllergens" },
                    }
                }

            ], (err, doc) => {


                if (err) return cb(err)
                if (!doc) {
                    var err = new Error('Document not found or empty');
                    err.statusCode = 400;
                    return cb(err);
                }
                if (!doc.length) cb(null, locationAllergens)
                else cb(null, doc[0].locationAllergens);
            });

        }, (doc, cb) => {

            Location.populate(doc, { path: "location" }, (err, doc) => {
                if (err) return cb(err)
                cb(null, doc);
            });
        }, (doc, cb) => {
            Allergen.populate(doc, { path: "allergens.allergen" }, (err, doc) => {
                if (err) return cb(err)
                cb(null, doc);
            });
        }, (doc, cb) => {

              Gallery.populate(doc, { path: "allergens.allergen.gallery" }, (err, doc) => {
                if (err) return cb(err)
                cb(null, doc);
            });

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};

/**
 * @api {get} /ingredient/ingredientinrecipes get Active Version of ingredient there are in recipes
 * @apiGroup {ingredient}
 * @apiName get Ingredient Active Version in Recipes
 *
 * @apiDescription get Ingredient Version in Recipes
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _ingredientId _versionId Ingredient id Ingredient version id 
   
 *
 * @apiSuccess {Object} List of Recipes that contains ingredient active version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getIngredientInRecipes = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    let sortField = params.sortField || 'versions.lang.name';
    if (sortField == '') sortField = 'versions.lang.name'
    let sortOrder = Number(params.sortOrder) || 1;
    let ingredientId = new ObjectId(params._id);
    let userLocations = req.userData.location;
    let page = params.page
    let perPage = params.perPage
    let userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    let Model = [Subproduct, Product, Dish, Drink];
    let recipesObjects = {
        elements: [],
        totalElements: 0
    }    
    let filterLocation;
    let filterLocationPipeline;

    waterfall([
        (cb) => { //Count totals
            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }
            //If an array of filter locations if provided, build the filter location pipeline
            filterLocationPipeline = {};
            if (filterLocation.length > 0) {
                filterLocationPipeline = { 'location': { $in: filterLocation } }
            }

            async.eachSeries(Model, function(Model, cb_async) {

                Model.aggregate([
                    { $match: { 'versions.composition.element.item': ingredientId } },
                    { $match: filterLocationPipeline },    
                    { $match: { 'location': { $in: userLocIds } } },                    
                    { $project: { versions:1 } }, 
                    { $unwind:  "$versions" },
                    { $unwind: {
                        path: "$versions.lang",
                        preserveNullAndEmptyArrays: true
                        }
                    },
                    { $match: { 'versions.lang.langCode': userProfile.user.language } },
                    {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
                    { $project: 
                        { 
                            'versions._id' : 1 ,
                            'versions.lang' : 1 ,
                            'versions.updatedAt' : 1 ,
                            'versions.active' : 1 
                        }
                    },
                    { $sort: { 'versions.updatedAt': -1 } },
                    { $group: { 
                        "_id": "$_id",
                        "versions": { $push: "$versions" }

                    } },
                ], (err, docs) => {

                    recipesObjects.totalElements += docs.length;
                    if (err) return cb_async(err)  
                    docs.map((object)=> {
                        object.activeVersion = object.versions.shift()
                        if (Model == Subproduct) object.type = 'Subproduct'
                        if (Model == Product) object.type = 'Product'
                        if (Model == Dish) object.type = 'Dish'
                        if (Model == Drink) object.type = 'Drink'                        
                    })                    
                    recipesObjects.elements = recipesObjects.elements.concat(docs)    

                    cb_async();
                })

            }, function(err) {
                if (err) return cb(err)
                cb(null, recipesObjects)
            })
        }, (recipesObjects, cb) => {
            if (page && perPage) {
                recipesObjects.elements = recipesObjects.elements.slice( (Number(page) * Number(perPage)) , ((Number(page) * Number(perPage)) + Number(perPage)) )
            }
            cb(null, recipesObjects)

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
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
exports.deleteIngredientInRecipeVersion = (req, res) => {

    let userProfile = req.userData;
    let params = req.query;
    var ingredientId = new ObjectId(params.ingredientId);
    var recipeId = new ObjectId(params.recipeId);
    var recipeVersionId = new ObjectId(params.recipeVersionId);
    var type = params.type
    var userLocations = req.userData.location;
    var page = params.page
    var perPage = params.perPage
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var ingredientInRecipes = [];
    var Model;
    var recipe;
    let arrayIndex = []

    if (type == 'subproduct') Model = Subproduct
    if (type == 'product') Model = Product
    if (type == 'dish') Model = Dish
    if (type == 'drink') Model = Drink

    async.waterfall([

        (cb) => {

            Model.findOne({ '_id': recipeId })
                .exec((err, doc) => {

                    if (err) return cb(err)
                    if (!doc) cb(null, true)
                    if (doc) {
                        console.log(doc, 'doc')

                        doc.versions.forEach((version) => {

                            if (version._id.equals(recipeVersionId)) {

                                version.composition.forEach((composition, index) => {

                                    let i = index
                                    //console.log(composition.element.item,'element.item ==', ingredientId,'ingredientId')
                                    if (composition.element.item.equals(ingredientId)) {
                                        console.log(index, 'index')
                                        indexArray.push(i)
                                    }

                                })

                                indexArray.forEach((index) => {
                                    version.composition.splice(index, 1)
                                })

                            }

                        })

                        cb(null, doc)
                    }

                })

        }, (doc, cb) => {
            //console.log(recipe.versions.composition,'recipe')
            //console.log(doc.versions.composition,'doc')

            Model.update({ _id: doc._id }, doc, (err) => {
                if (err) return cb(err)
                cb(null, doc)
            })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
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

exports.deleteAllIngredientInRecipes = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    console.log(req.body, 'reqBody')
    console.log(req.query, 'reqQuery')
    var ingredient = new ObjectId(params.ingredientId);
    var recipe = new ObjectId(params.recipeId);
    var type = params.type
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var ingredientInRecipes = [];
    var recipe;
    let indexArray;

    if (type == 'subproduct') Model = Subproduct
    if (type == 'product') Model = Product
    if (type == 'dish') Model = Dish
    if (type == 'drink') Model = Drink

    async.waterfall([

        (cb) => {
            //console.log(gastroOffer,'gastroOfferAPI')
            Model.findOne({ '_id': recipe })
                .populate("versions.composition")
                .sort({ 'versions.updatedAt': -1 })
                .exec((err, doc) => {

                    if (err) return cb(err)
                    if (!doc) cb(null, true)
                    if (doc) {
                        console.log(doc.versions.length, 'docInit')

                        doc.versions.forEach((version, index) => {

                            if (version.composition.length) {

                                version.composition.forEach((composition) => {

                                    if (composition.element.item.equals(ingredient)) {
                                        //console.log(version,'versionMatchToDeleted')
                                        if (version.active == false) indexArray.push(index)
                                    }

                                })

                            }


                        })

                        indexArray.forEach((index) => {
                            doc.versions.splice(index, 1)
                        })
                        console.log(indexArray, 'indexArray')
                        console.log(doc.versions.length, 'docFinish')

                        cb(null, doc)
                    }

                })

        }, (doc, cb) => {
            //console.log(recipe.versions.composition,'recipe')
            //console.log(doc.versions.composition,'doc')
            // Model.update({_id: doc[0]._id},doc[0],(err)=>{
            //   if(err) return cb(err)
            //     cb(null,doc)
            // })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}


/**
 * @api {get} /ingredient/updatelocationcost update an ingredient location cost based on provider articles associated to it.
 * @apiGroup {ingredient}
 * @apiName update ingredient location cost
 *
 * @apiDescription update ingredient location cost by launching a task
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _ingredientId Ingredient id 
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.updateLocCost = (req, res) => {

    var async = require('async');
    var singleArticleLocCostUpdateQueue = require('../queues/singleArticleLocCostUpdate')
    var params = req.query;

    logger.info('Entering update location cost for ingredient.')

    async.waterfall([

        (cb) => {

            if (!params.id) {
                logger.error('Ingredient location cost update - No id provided!')
                let err = new Error('No id provided!')
                return cb(err)
            } else {
                cb(null, true)
            }

        }, (doc, cb) => {

            var job = singleArticleLocCostUpdateQueue.create({
                title: 'singleArticleLocCostUpdate - Calculate ingredient location cost array.',
                model: 'ingredient',
                articleId: params.id
            });

            cb(null, true)

        }
    ], (err, doc) => {

        if (err) {
            logger.error('Error trying to start task: %s', err.message);
            return res.status(500).json(err.message || 'Error').end();
        } else {
            logger.info('Task to update location costs started successfully.');
            res.status(200).json({ message: 'Task to update location costs started successfully.' }).end();
        }

    })
}

/**********************    QUARTERINGS  ****************************************

/**
 * @api {post} /ingredient/quartering Add new Quartering
 * @apiGroup {ingredient}
 * @apiName Add new
 *
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Ingredient-Creation:
 * {
 *     "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Bistec",
 *         },
 *     ],
 *     "quartering": "57b723ba5556871a52888438",
 *     "active" : true,
 *     "ingredientPercentage": 25,
 *     "netPercentage" : 50
 * }
 *
 *
 *
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.addQuartering = (req, res) => {

    var quarteringHelper = require('../helpers/quartering');
    var newQuartering;
    var locationLoop = [];
    var ingredient;

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator');
    var account = req.userData;
    var inQuarter = req.body;
    inQuarter.assigned_location = account.location._id;
    inQuarter.last_account = account._id;
    inQuarter.imagePath = req.file ? req.file.path : undefined;

    logger.info('Entering addQuartering method...')

    async.waterfall([

        (cb) => {

            if (!inQuarter.quartering) {
                let err = new Error("req.quartering must be a valid parent ingredient")
                return cb(err)
            }
            cb(null, true)

        }, (doc, cb) => { //Save new quartering

            ingredient = new Ingredient(inQuarter);
            ingredient.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.ingredient)

            ingredient.save((err, doc) => {
                if (err) return cb(err)
                newQuartering = doc;
                logger.info('successfully saved new quartering.')
                cb(null, doc)
            });

        }, (doc, cb) => { //Find parent ingredient to calculate location loop

            //Get parent ingredient 
            Ingredient.findOne({ _id: newQuartering.quartering }, (err, doc) => {
                let refObject = {
                    location: null,
                    unitCost: doc.referencePrice
                }
                locationLoop.push(refObject);
                if (doc.locationCost) locationLoop = locationLoop.concat(doc.locationCost)

                logger.info('Computed location loop to update quartering cost: %j', locationLoop)

                cb(null, true)
            });

        }, (doc, cb) => { //Update quartering costs. It will trigger post-save hooks.

            quarteringHelper.updateQuarteringsCost(newQuartering, false, locationLoop, (err, res) => {
                if (err) return cb(err)
                logger.info('Updated costs of quartering and quartering siblings.')
                cb(null, true)
            })

        }
    ], (err, doc) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(newQuartering);

    })


    //Note: location costs of quartering are calculated in post-save hook.
};


/**
 * @api {put} /ingredient/quartering Edit Quartering
 * @apiGroup {ingredient}
 * @apiName Edit quartering
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 */

exports.editQuartering = (req, res) => {

    var account = req.userData;
    var inQuarter = req.body;
    var quarteringHelper = require('../helpers/quartering');
    var locationLoop = [];
    var editedQuartering;

    async.waterfall([

        (cb) => {

            Ingredient.findOneAndUpdate({
                _id: inQuarter._id
            }, {
                $set: {
                    ingredientPercentage: inQuarter.ingredientPercentage,
                    netPercentage: inQuarter.netPercentage,
                    lang: inQuarter.lang,
                    gallery: inQuarter.gallery
                }
            }, (err, doc) => {
                if (err) return cb(err);
                editedQuartering = doc;
                logger.info('Successfully updated quartering %j', editedQuartering)
                cb(null, doc);
            });

        }, (doc, cb) => { //Find parent ingredient to calculate location loop

            //Get parent ingredient 
            Ingredient.findOne({ _id: inQuarter.quartering }, (err, doc) => {
                let refObject = {
                    location: null,
                    unitCost: doc.referencePrice
                }
                locationLoop.push(refObject);
                if (doc.locationCost) locationLoop = locationLoop.concat(doc.locationCost)

                logger.info('Computed location loop to update quartering cost: %j', locationLoop)

                cb(null, true)
            });

        }, (doc, cb) => { //Update quartering costs. It will trigger post-save hooks.

            quarteringHelper.updateQuarteringsCost(editedQuartering, false, locationLoop, (err, res) => {
                if (err) return cb(err)
                logger.info('Updated costs of quartering and quartering siblings.')
                cb(null, true)
            })

        }
    ], (err, doc) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(editedQuartering);
    })

};

/**
 * @api {delete} /ingredient/quartering Delete Quartering
 * @apiGroup {ingredient}
 * @apiName Delete quartering
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 */

exports.deleteQuartering = (req, res) => {

    var params = req.query;
    var id = params.id;
    var removedQuartering;
    var locationLoop = [];
    var quarteringHelper = require('../helpers/quartering');

    logger.info('Entering deleteQuartering method to delete quartering with id %s', id)

    async.waterfall([

        (cb) => {

            Ingredient.findOne({ _id: id }, (err, doc) => {
                if (err) return cb(err)
                removedQuartering = JSON.parse(JSON.stringify(doc));
                cb(null, doc)
            });

        }, (doc, cb) => {

            doc.remove((err, doc) => {
                if (err) return cb(err)
                logger.info('Successfully removed quartering %j', removedQuartering)
                cb(null, true)
            })


        }, (doc, cb) => { //Find parent ingredient to calculate location loop

            //Get parent ingredient 
            Ingredient.findOne({ _id: removedQuartering.quartering }, (err, doc) => {
                let refObject = {
                    location: null,
                    unitCost: doc.referencePrice
                }
                locationLoop.push(refObject);
                if (doc.locationCost) locationLoop = locationLoop.concat(doc.locationCost)

                logger.info('Computed location loop to update quartering cost: %j', locationLoop)

                cb(null, true)
            });

        }, (doc, cb) => { //Update quartering costs. It will trigger post-save hooks.

            quarteringHelper.updateQuarteringsCost(removedQuartering, false, locationLoop, (err, res) => {
                if (err) return cb(err)
                logger.info('Updated costs of quartering and quartering siblings.')
                cb(null, true)
            })

        }
    ], (err, doc) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(removedQuartering);
    })

};


/**
 * @api {get} /ingredient/quarter Get all despieces for a ingredient
 * @apiGroup {ingredient}
 * @apiName Get All
 *
 * @apiDescription Get all despieces for a ingredient with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} ingredientId the _id of the parent ingredient
 * @apiParam {int} perPage  Recors per page.
 * @apiParam {int} page  Page number.
 * @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 * @apiParam {string} filterText  Text te filter (in name field).
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getAllQuarter = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var filterText = params.filterText || '';
    var sortField = params.sortField || 'lang.name';
    var sortOrder = Number(params.sortOrder) || 1;
    var filterLocation;

    waterfall([
        (cb) => {

            //ToDo: filter price by location based on param

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }


            Ingredient.find({
                    $text: { $search: params.filterTex },
                    quartering: params.ingredientId
                }, {
                    last_account: 1,
                    updatedAt: 1,
                    gallery: 1,
                    family: 1,
                    subfamily: 1,
                    referenceNumber: 1,
                    ingredientPercentage: 1,
                    netPercentage: 1,
                    quartering: 1,
                    active: 1,
                    locationCost: 1,
                    lang: { $elemMatch: { langCode: userProfile.user.language } } //@TODO elemMatch on populated array
                })
                .sort({
                    [sortField]: sortOrder
                })
                .limit(Number(params.perPage))
                .skip(Number(params.perPage) * Number(params.page))
                .populate('assigned_location last_account gallery family subfamily')
                .exec((err, docs) => {
                    if (docs && docs.length) {
                        return cb(docs)
                    }
                    cb(null, true); //Ejecutaremos la segunda busqueda
                })
        },
        (useless, cb) => {
            Ingredient.find({
                    $or: [
                        { "lang.name": { $regex: params.filterText, $options: 'i' } },
                        { "lang.description": { $regex: params.filterText, $options: 'i' } }
                    ],
                    quartering: params.ingredientId
                }, {
                    last_account: 1,
                    updatedAt: 1,
                    gallery: 1,
                    family: 1,
                    subfamily: 1,
                    ingredientPercentage: 1,
                    netPercentage: 1,
                    referenceNumber: 1,
                    quartering: 1,
                    active: 1,
                    locationCost: 1,
                    lang: { $elemMatch: { langCode: userProfile.user.language } } //@TODO elemMatch on populated array
                })
                .sort({
                    [sortField]: sortOrder
                })
                .limit(Number(params.perPage))
                .skip(Number(params.perPage) * Number(params.page))
                .populate('assigned_location last_account gallery family')
                .exec((err, docs) => {
                    if (err) {
                        return cb(err)
                    }
                    cb(null, docs)
                })
        }
    ], (docsText, docsOr) => {
        if (false) {
            return res.status(500).json(err).end();
        }

        let docs = docsText || docsOr;
        let data;

        //For those quarterings that have a price for filterLocation location, replace referencePrice field with average location-based price
        if (filterLocation.length) {
            costHelper.calculateAvgArticleLocCostAndAllergens(docs, filterLocation)
        }

        //Ahora que tenemos todos los elementos, obtenemos el numero total, para poder hacer la paginación

        //Si el $text ha funcionado, hacemos un count con el $text, si no usaremos el $or
        if (docsText) {
            Ingredient.count({
                lang: { $elemMatch: { langCode: userProfile.user.language } },
                $text: { $search: params.filterTex },
                quartering: params.ingredientId

            }, (err, count) => {
                if (err) return res.status(500).json(err.message || 'Error').end();

                docs.forEach((e, i) => {
                    e.family.subfamilies = e.family.subfamilies.id(e.subfamily);
                });

                data = {
                    'ingredients': docs,
                    'totalElements': count
                };

                res.status(200).json(data);
            });
        } else if (docsOr) {
            Ingredient.count({
                lang: { $elemMatch: { langCode: userProfile.user.language } },
                $or: [
                    { "lang.name": { $regex: params.filterText, $options: 'i' } },
                    { "lang.shortName": { $regex: params.filterText, $options: 'i' } }
                ],
                quartering: params.ingredientId
            }, (err, count) => {
                if (err) return res.status(500).json(err.message || 'Error').end();

                data = {
                    'ingredients': docs,
                    'totalElements': count
                };

                res.status(200).json(data);
            });
        }
    });
};


/********************************************  UTILS ********************************************/


//Endpoint created to set prices to zero in case an ingredient has a price not defined. This is a one-off endpoint created 
//to resolve an issue when it was possible to create an ingredient with price not defined.

exports.resetNullPrices = (req, res) => {
    var ingId = new ObjectId(req.query._id);
    var userData = req.userData;

    waterfall([
        (cb) => {
            Ingredient.find({ 'referencePrice': null }, (err, docs) => {
                if (err) {
                    return cb(err)
                }
                cb(null, docs);
            });
        }, (docs, cb) => {
            docs.forEach((ingredient) => {
                if (ingredient.referencePrice == null) {
                    ingredient.referencePrice = 0;
                }
                ingredient.save((err) => {
                    if (err) return cb(err)
                })
            })
            cb(null, true)
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


//Endpoint created to force a save of all ingredients and trigger an automatic price refresh.
//It is intented to be used with the ingredient post save updated so that it does not check whether price has changed
//before executing an automatic price calculation.

exports.forceRefresh = (req, res) => {
    var ingId = new ObjectId(req.query._id);
    var userData = req.userData;

    waterfall([
        (cb) => {
            Ingredient.find({}, (err, docs) => {
                if (err) {
                    return cb(err)
                }
                cb(null, docs);
            });
        }, (docs, cb) => {
            docs.forEach((ingredient) => {
                ingredient.save((err) => {
                    if (err) return cb(err)
                })
            })
            cb(null, true)
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


//Endpoint created calculate ingredients' price based on location.

exports.ingLocBasedPricing = (req, res) => {
    // 1. Get the list of all ingredients and locations
    // 2. Loop all ingredients,
    // 3. For each ingredient, loop all locations
    // 3. Find provider's articles for that ingredient which include this location
    // 4. If there are any, calculate average price and save it in price array
    // 6. If there are no provider articles, move on to the next location.

    var ingId = new ObjectId(req.query._id);
    var ingredients;
    var locations;
    var userData = req.userData;

    waterfall([
        (cb) => {
            //Find all ingredients
            Ingredient.find({}, (err, docs) => {
                if (err) return cb(err)
                ingredients = docs;
                cb(null, docs);
            });

        }, (docs, cb) => {
            //Find all locations
            Location.find({}, (err, docs) => {
                if (err) return cb(err)
                locations = docs;
                cb(null, docs);
            })

        }, (docs, cb) => {

            async.eachSeries(ingredients, function(ing, cb_ing) {

                ing.locationCost = [];

                async.eachSeries(locations, (loc, cb_loc) => {

                    Article.find({ //Search provider articles for ingredient (ing) and that include the location (loc)
                        'category.item': ing._id,
                        'location': { $in: [loc._id] }
                    }, (err, articles) => {
                        if (err) return cb(err)

                        let total = 0;
                        let avgPrice = 0;
                        if (articles.length > 0) {
                            articles.forEach((article) => {
                                total += article.netPrice;
                            })
                            avgPrice = total / articles.length;
                            let priceObj = {
                                location: loc._id,
                                unitCost: avgPrice
                            }
                            ing.locationCost.push(priceObj)
                            ing.save((err, doc) => {
                                if (err) return cb(err)
                                console.log('saved ingredient')
                                cb_loc(); //continue location loop
                            })
                        } else {
                            //set price to zero for that location
                            let priceObj = {
                                location: loc._id,
                                unitCost: 0
                            }
                            ing.locationCost.push(priceObj)

                            ing.save((err, doc) => {
                                if (err) return cb(err)
                                cb_loc(); //continue location loop
                            })
                        }
                    })
                }, (err) => { //finished location async
                    cb_ing(); //Continue ingredient loop
                })

            }, function(err) { //finished ingredient async
                cb(null, true)
            })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};



//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator');

    waterfall([
        (cb) => {
            Ingredient.find({}, (err, docs) => {
                if (err) {
                    return cb(err)
                }
                cb(null, docs);
            });
        }, (docs, cb) => {
            var filtered;
            var index;
            async.eachSeries(docs, function(ingredient, cb_async) {

                function generateReferenceNumber() {

                    return function() {

                        filtered = ingredient.lang.filter((lang) => {
                            return lang.name == ""
                        })

                        if (filtered.length > 0) {

                            filtered.forEach((filteredObject) => {

                                index = ingredient.lang.indexOf(filteredObject)
                                ingredient.lang.splice(index, 1)

                            })

                        }

                        ingredient.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.ingredient)
                        if (ingredient.referenceNumber) {

                            console.log(ingredient.referenceNumber, 'Reference Number of Ingredient', ingredient.lang[0].name)

                            ingredient.save((err) => {
                                if (err) return cb_async(err)
                                cb_async();
                            })
                        }
                    }
                }
                setTimeout(generateReferenceNumber(), 1);

            }, function(err) {
                cb(null, true)
            })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


exports.refreshLocationCost = (req, res) => {

    var refreshArticleLocCostQueue = require('../queues/refreshArticleLocCost')

    refreshArticleLocCostQueue.refreshArticleLocCost({
        title: 'Refresh Ingredients Location Costs ',
        model: 'ingredient'
    });
    res.status(200).end();
}


//Refresh quartering cost of all ingredients
exports.refreshQuarteringsCost = (req, res) => {

    var refreshQuarteringCostsQueue = require('../queues/refreshQuarteringCosts')

    refreshQuarteringCostsQueue.refreshQuarteringCosts({
        title: 'Refresh Quartering Costs '
    });
    res.status(200).end();
}

exports.refreshIngLocAllergens = (req, res) => {

    var refreshIngLocAllergensQueue = require('../queues/refreshIngLocAllergens')

    refreshIngLocAllergensQueue.refreshIngLocAllergens({
        title: 'Refresh Ingredients Location Allergens ',
        model: 'ingredient'
    });
    res.status(200).end();
}