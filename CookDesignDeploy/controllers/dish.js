'use strict';


var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var costHelper = require('../helpers/cost');
var allergenHelper = require('../helpers/allergen');
var mongoose = require('../node_modules/mongoose');
var fs = require('fs');
var async = require('async');
require('../models/dish');
var Dish = require('../models/dish');
var Subproduct = require('../models/subproduct');
var Ingredient = require('../models/ingredient');
var Gallery = require('../models/gallery');
var Allergen = require('../models/allergen');
var Drink = require('./drinks');
var Product = require('./product');
var Location = require('../models/location');
var User = require('../models/user');
var GastroOffer = require('../models/gastroOffer');
var PricingRate = require('../models/pricingRate');
var { ObjectId } = require('mongodb');
var config = require('../config/config');
var assert = require('assert');
var elementsHelper = require('../helpers/getElements');
var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.controllers;
/**
 * @api {post} /dish Add new dish
 * @apiGroup {dish}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Dish-Creation:
 {  
    "family" : "57e245e373c49608114fd4c9",
    "subfamily" : "57e245f273c49608114fd4cb",
    "location" : ["57e557b687ae842825ae6d22","57e5573f87ae842825ae6d1f", "57e53fabf9475a721f6e2c6f"],
    "active" : "true",
    "versions": [
        {
            "lang" :[
                {
                    "langCode": "es",
                    "name" : "Plato 22",
                    "description" : "Descripción del plato 22"
                },
                {
                    "langCode": "en",
                    "name" : "Dish 22",
                    "description" : "Description of dish 22"
                }
            ],
            "composition" : null,
            "cookingSteps" : null,
            "gallery" : "57e5578487ae842825ae6d20"
        }
    ]
}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 **/

exports.add = (req, res) => {
    var account = req.userData;
    var inDish = req.body;
    var dishLocations = inDish.location || null;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });

    waterfall([
        (cb) => { //location check: each dish location should have at least one user location in its upper path. Each dish's location
            // includes its upper path.

            if (dishLocations != null) {

                //Check whether list of dish locations includes at least one customer location.
                var match = dishLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for (var i = 0; i < userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });

                if (match) { cb(null, match); } else {
                    var err = new Error('Access to dish location is not allowed');
                    err.statusCode = 400;
                    return cb(err);
                }
            } else {
                let error = new Error('Must specify a valid location');
                err.statusCode = 400;
                return cb(err)
            }
        }, (doc, cb) => {
            inDish.versions.last_account = account._id;
            inDish.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.dish)
            var dish = new Dish(inDish);
            //console.log('adding Dish',dish)
            dish.save((err) => {
                if (err) return cb(err)
                cb(null, dish);
            });
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}

/**
 * @api {post} /dish Add new dish version
 * @apiGroup {dish}
 * @apiName Add new verion
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Dish-Creation:
 * {
    "_id": "57ea7dfe991de2ce2d211fc3",
    "versions": [
        {
            "lang" :[
                {
                    "langCode": "es",
                    "name" : "Subproducto 1",
                    "description" : "Descripción del plato 22"
                },
                {
                    "langCode": "en",
                    "name" : "Subproduct 1",
                    "description" : "Description of dish 22"
                }
            ],
            "active" : "false",
            "numServings" : "10.45",
            "composition" : null,
            "cookingSteps" : null
        }
    ]
}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.addVersion = (req, res) => {
    var account = req.userData;
    var inDish = req.body;
    var dishLocations;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var sortField = 'updatedAt';
    var sortOrder = 1;
    var activeVersion;
    var locationWarning = false;
    var Model;
    var Subproduct = require('../models/subproduct');

    logger.info('Dish Controller - add Version - Entering method.')

    async.waterfall([

        (cb) => { //Verify maximum number of versions
            Dish.findById(inDish._id, (err, doc) => {

                if (err) return cb(err);

                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }

                if (doc.versions.length >= config.maxNumVersionsRecipes) {
                    doc.versions.sort(function(a, b) { return (a[sortField] > b[sortField]) ? sortOrder : ((b[sortField] > a[sortField]) ? -sortOrder : 0); }).shift();
                }
                logger.info('Dish Controller - add Version - Verified number of versions has not reached limit. Total versions: %s', doc.versions.length)
                cb(null, doc)
            })

        }, (doc, cb) => {
            //location check: each dish location should have at least one user location in its upper path. Each dish's location
            // also includes its upper path.

            dishLocations = doc.location;
            //Check whether list of dish locations includes at least one customer location.

            var match = dishLocations.find((id) => {
                let locId = new ObjectId(id);
                for (var i = 0; i < userLocIds.length; i++) {
                    if (userLocIds[i].equals(locId)) return true;
                }
            });

            if (match) {

                logger.info('Dish Controller - add Version - Checked that list of product locations includes at least one customer location')
                cb(null, doc);

            } else {

                var err = new Error('Access to dish location is not allowed');
                err.statusCode = 400;
                return cb(err);

            }

        }, (doc, cb) => {

            //Update previous active version to not active
            doc.versions.forEach(function(version) {
                if (version.active == true) version.active = false;
            })

            logger.info('Dish Controller - add Version - Updated previous active version to not active.')

            inDish.version.last_account = account._id;
            logger.info('Dish Controller - add Version - Set last_account.')

            doc.measurementUnit = inDish.measurementUnit;
            doc.family = inDish.family;
            doc.subfamily = inDish.subfamily;
            doc.active = inDish.active;
            doc.location = inDish.location;
            doc.kitchens = inDish.kitchens;
            doc.workRoom = inDish.workRoom;
            doc.caducityFresh = inDish.caducityFresh;
            doc.caducityFreeze = inDish.caducityFreeze;
            doc.daysToUse = inDish.daysToUse;

            logger.info('Dish Controller - add Version - Set additional new version fields.')
            cb(null, doc)

        }, (doc, cb) => {

            //Calculate dish composition reference and location cost for aggregate locations in composition list
            costHelper.calculateRecipeCompLocationCosts(inDish.version, inDish.location, Dish, (err, res) => {
                if (err) return cb(err)
                inDish.version.locationCost = res.locationCost;
                inDish.version.costPerServing = res.costPerServing;

                logger.info('Dish Controller - add Version - Calculated dish composition reference and location cost for aggregate locations in composition list.')
                logger.info('Dish Controller - add Version - locationCost: %j', res.locationCost)
                logger.info('Dish Controller - add Version - compositionCost: %s', res.costPerServing)

                cb(null, doc)
            })

        }, (doc, cb) => {

            allergenHelper.calculateRecipeLocationAllergens(inDish.version, inDish.location, (err, res) => {
                if (err) return cb(err)

                inDish.version.locationAllergens = res.locationAllergens;
                inDish.version.allergens = res.referenceAllergens;
                logger.info('Dish Controller - add Version - Recalculated dish reference allergens and location allergens');

                cb(null, doc)
            })

        }, (doc, cb) => {

            doc.versions.push(inDish.version);

            doc.save(function(err, savedDoc) {
                if (err) return cb(err)
                logger.info('Dish Controller - add Version - Successfully saved dish with new version.')
                cb(null, savedDoc);
            });

        }, (savedDoc, cb) => { //Populate composition elements

            activeVersion = savedDoc.versions.find(function(version) {
                return version.active == true;
            })

            if (activeVersion) {
                //Populate subproduct composition elements
                async.eachSeries(activeVersion.composition, (compElement, cb_async) => {

                    if (compElement.element.kind == 'subproduct') {
                        Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
                            if (err) return cb_async(err)
                            cb_async();
                        });
                    } else {
                        process.nextTick(() => cb_async())
                    }

                }, (err) => { //finished async loop
                    if (err) return cb(err)
                    logger.info('Populated dish offer composition items.')
                    cb(null, savedDoc);
                    //console.log(doc,'docGOgetVersion')
                });

            } else {
                logger.error('Could not find active version of dish.')
                cb(null, savedDoc)
            }


        }, (savedDoc, cb) => { //Check all composition element's location include the gastro offer's locations

            if (activeVersion) {
                activeVersion.composition.forEach((compElement) => {

                    if (compElement.element.item && compElement.element.kind == 'subproduct') {
                        let included = savedDoc.location.every((l1) => {
                            let loc1 = new ObjectId(l1);
                            return compElement.element.item.location.some((l2) => {
                                let loc2 = new ObjectId(l2)
                                return loc2.equals(loc1)
                            })
                        })
                        if (!included) locationWarning = true;
                    }
                })
                cb(null, savedDoc)
            } else {
                cb(null, savedDoc)
            }

        }, (savedDoc, cb) => {

            let res = {
                id: savedDoc._id,
                activeVersionId: activeVersion._id,
                locationWarning: locationWarning
            }

            cb(null, res)

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}

/**
 * @api {delete} /dish Delete dish
 * @apiGroup {dish}
 * @apiName Delete Dish
 *
 * @apiDescription Delete a dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 *
 * @apiSuccess {Object} Dish removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.remove = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishLocations;
    let dishId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the dish's locations      

            if (mongoose.Types.ObjectId.isValid(params._id)) {
                Dish.findById(dishId, (err, doc) => {
                    if (err) return cb(err);
                    if (!doc) {
                        var err = new Error('Document not found')
                        err.statusCode = 404;
                        return cb(err);
                    }
                    //Check whether list of dish locations includes at least one customer location.
                    dishLocations = doc.location;

                    var match = dishLocations.find((id) => {
                        let locId = new ObjectId(id);
                        for (var i = 0; i < userLocIds.length; i++) {
                            if (userLocIds[i].equals(locId)) return true;
                        }
                    });

                    if (match) { cb(null, doc); } else {
                        var err = new Error('Access to dish location is not allowed');
                        err.statusCode = 400;
                        return cb(err);
                    }
                })
            } else {
                var err = new Error('Invalid Object Id');
                err.statusCode = 400;
                return cb(err)
            }
        }, (doc, cb) => {
            //remove dish
            doc.remove(function(err, doc) {
                if (err) return cb(err)
                cb(null, doc);
            });
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}

/**
 * @api {delete} /dish/version Delete dish version
 * @apiGroup {dish}
 * @apiName Get Dish
 *
 * @apiDescription Delete a dish version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 * @apiParam {string} _versionId  Dish version id
 *
 * @apiSuccess {Object} Dish version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.removeVersion = (req, res) => {
    //Can't delete an active version
    //Can't delete if there is only one version left
    //Can't delete if the dish is not within the user's location zone
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishLocations;
    let dishId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //Verify dish exists

            if (mongoose.Types.ObjectId.isValid(params._id) && mongoose.Types.ObjectId.isValid(params._versionId)) {
                Dish.findById(dishId, (err, doc) => {
                    if (err) return cb(err);
                    if (!doc) {
                        let err = new Error("Document not found");
                        err.statusCode = 404;
                        return cb(err)
                    }
                    cb(null, doc)
                })
            } else {
                let err = new Error("ObjectId not valid");
                err.statusCode = 400;
                return cb(err)
            }
        }, (doc, cb) => { //Verify there are at least 2 versions

            if (doc.versions.length < 2) {
                let err = new Error("It is not possible to remove the only version of the dish");
                err.statusCode = 400;
                return cb(err)
            } else {
                cb(null, doc);
            }

        }, (doc, cb) => { //location check. Verify that at least one user location is within the dish's locations

            //Check whether list of dish locations includes at least one customer location.
            dishLocations = doc.location;

            var match = dishLocations.find((id) => {
                let locId = new ObjectId(id);
                for (var i = 0; i < userLocIds.length; i++) {
                    if (userLocIds[i].equals(locId)) return true;
                }
            });

            if (match) { cb(null, doc); } else {
                var err = new Error('Access to dish location is not allowed');
                err.statusCode = 400;
                return cb(err);
            }

        }, (doc, cb) => {

            //remove version
            for (var i = 0; i < doc.versions.length; i++) {
                let obj = doc.versions[i];
                let id = new ObjectId(obj._id)
                if (id.equals(versionId)) {
                    doc.versions.splice(i, 1);
                }
            }

            doc.save(function(err) {
                if (err) return cb(err)
                cb(null, doc);
            });
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}

/**
 * @api {put} /dish/version Set version as active
 * @apiGroup {dish}
 * @apiName Set As Active
 *
 * @apiDescription Set a dish version as active
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 * @apiParam {string} _versionId  Dish version id
 *
 * @apiSuccess {Object} Dish active version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.setAsActiveVersion = (req, res) => {
    //sets dish version as active
    //Location check
    //Must make the previous version not active
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishLocations;
    let dishId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 
    let activeDishVersion;
    var MeasUnit = require('../models/measurementUnit')
    var Dish = require('../models/dish');

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the dish's locations       

            if (mongoose.Types.ObjectId.isValid(dishId) && mongoose.Types.ObjectId.isValid(versionId)) {
                Dish.findById(dishId, (err, doc) => {

                    if (err) cb(err);
                    if (!doc) {
                        let err = new Error("Document not found");
                        err.statusCode = 404;
                        return cb(err)
                    }
                    dishLocations = doc.location;
                    //Check whether list of dish locations includes at least one customer location.

                    var match = dishLocations.find((id) => {
                        let locId = new ObjectId(id);
                        for (var i = 0; i < userLocIds.length; i++) {
                            if (userLocIds[i].equals(locId)) return true;
                        }
                    });
                    if (match) { cb(null, doc); } else {
                        var err = new Error('Access to dish location is not allowed');
                        err.statusCode = 400;
                        return cb(err);
                    }
                });
            } else {
                let err = new Error("ObjectId not valid");
                err.statusCode = 400;
                return cb(err)
            }
        }, (doc, cb) => {

            //Update previous active version to not active
            doc.versions.forEach(function(version) {
                if (version.active == true) version.active = false;
            })

            //Update version to active
            doc.versions.forEach(function(version) {
                let id = new ObjectId(version._id)
                if (id.equals(versionId)) {
                    version.active = true;
                    activeDishVersion = version;
                }
            })
            cb(null, doc);

        }, (doc, cb) => {

            //Filter ingredient or subproduct lang field based on user language
            async.each(activeDishVersion.composition, function(compElement, cb_async) {
                if (compElement.element.kind == 'subproduct') { //composition element is a subproduct
                    Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
                        if (err) return cb(err)
                        if (compElement.element.item != null) {
                            //Filter active version
                            let activeVersion = compElement.element.item.versions.filter((version) => {
                                return version.active == true;
                            })
                            if (activeVersion.length) {
                                compElement.element.item.versions = activeVersion;
                                //Store location of subproduct
                                //console.log(compElement, 'compElement')
                                compElement.location = compElement.element.item.location;
                                //Update unit cost and locationCost of drink
                                compElement.unitCost = compElement.element.item.versions[0].unitCost;
                                if (compElement.element.item.versions[0].locationCost) {
                                    compElement.locationCost = compElement.element.item.versions[0].locationCost;
                                } else {
                                    compElement.locationCost = [];
                                }
                                let baseUnit = new ObjectId(compElement.baseUnit);
                                let measurementUnit = new ObjectId(compElement.element.item.measurementUnit);

                                if (!baseUnit.equals(measurementUnit)) {
                                    compElement.measuringUnit = compElement.element.item.measurementUnit
                                    compElement.baseUnit = compElement.element.item.measurementUnit

                                    MeasUnit.findById(measurementUnit, (err, doc) => {
                                        if (err) return cb(err)
                                        compElement.measuringUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
                                        compElement.baseUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
                                        // and the request can't be accessed from a Mongoose hook
                                        logger.info('Retrieved new measurement unit short name')
                                        cb_async()
                                    })
                                } else {
                                    cb_async()
                                }

                            } else {
                                logger.error('Could not retrive active version of dish in recipe composition. Dish id: %s', dishId, ' and version id: ', versionId);
                                cb_async()
                            }
                        } else {
                            logger.error('Could not populate subproduct in dish recipe. Dish id: %s', dishId, ' and version id: ', versionId);
                            cb_async()
                        }
                    });
                } else { //composition element is an ingredient
                    Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
                        if (err) return cb(err)
                        if (compElement.element.item != null) {
                            //Udpdate unit cost and locationCost of ingredient
                            compElement.unitCost = compElement.element.item.referencePrice;

                            if (compElement.element.item.locationCost) {
                                compElement.locationCost = compElement.element.item.locationCost;
                            } else {
                                compElement.locationCost = [];
                            }

                            let baseUnit = new ObjectId(compElement.baseUnit);
                            let measurementUnit = new ObjectId(compElement.element.item.measurementUnit);

                            if (!baseUnit.equals(measurementUnit)) {
                                compElement.measuringUnit = compElement.element.item.measurementUnit
                                compElement.baseUnit = compElement.element.item.measurementUnit

                                MeasUnit.findById(measurementUnit, (err, doc) => {
                                    if (err) return cb(err)
                                    compElement.measuringUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
                                    compElement.baseUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
                                    // and the request can't be accessed from a Mongoose hook
                                    logger.info('Retrieved new measurement unit short name')
                                    cb_async()
                                })
                            } else {
                                cb_async()
                            }

                        } else {
                            logger.error('Could not populate ingredient in dish recipe. Dish id: %s', dishId, ' and version id: ', versionId)
                            cb_async();
                        }
                    });
                }
            }, (err) => { //finished async loop
                cb(null, doc);
            });
        }, (doc, cb) => {
            //Filter ingredient or subproduct lang field based on user language
            activeDishVersion.composition.forEach((compElement) => {
                compElement.element.item = compElement.element.item? compElement.element.item._id : null;
            })
            cb(null, doc)
        }, (doc, cb) => {

            //Calculate drink composition reference and location cost for aggregate locations in composition list

            costHelper.calculateRecipeCompLocationCosts(activeDishVersion, dishLocations, Dish, (err, res) => {
                if (err) return cb(err)
                activeDishVersion.locationCost = res.locationCost;
                activeDishVersion.costPerServing = res.costPerServing;

                logger.info('Dish Controller - add Version - Calculated dish composition reference and location cost for aggregate locations in composition list.')
                logger.info( 'Dish Controller - add Version - locationCost: %j', res.locationCost )
                logger.info( 'Dish Controller - add Version - compositionCost: %s', res.costPerServing )

                cb(null, doc)
            })

        }, (doc, cb) => {

            allergenHelper.calculateRecipeLocationAllergens(activeDishVersion, dishLocations, (err, res) => {
                if (err) return cb(err)

                activeDishVersion.locationAllergens = res.locationAllergens;
                activeDishVersion.allergens = res.referenceAllergens;
                logger.info('Dish Controller - add Version - Recalculated dish reference allergens and location allergens');

                cb(null, doc)
            })

        }, (doc, cb) => {

            //save doc
            doc.save(function(err) {
                if (err) {
                	logger.error('Dish Controller - add Version - error saving recipe')
                	return cb(err);
                }
                cb(null, doc);
            });

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}




/**
 * @api {get} /dish Get all dishes within the user's locations with pagination and filter
 * @apiGroup {dish}
 * @apiName Get All
 *
 * @apiDescription Get all families in a category with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {int} perPage  Records per page.
 *  @apiParam {int} page  Page number.
 *  @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 *  @apiParam {string} filterText  Text to filter (in name field).
 *  @apiParam {string} filterLocation  Location id to filter.
 *  @apiParam {string} family  Family id to filter.
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getAll = (req, res) => {
    //Gets the active version of all dishes that are in the user's zone.
    let userProfile = req.userData;
    let params = req.query;
    var filterText = params.filterText || '';
    var sortField = params.sortField || 'versions.lang.name';
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var filterLocation;
    var filterFamilyPipeline;
    var filterLocationPipeline;
    var Dish = require('../models/dish');
    var activePipeline;
    var addModal = false
    var filterExcludes = false;

    if (params.filterExcludes && params.filterExcludes == 'true') filterExcludes = true;
    if (params.addModal && params.addModal == 'true') addModal = true;

    //console.log(params,'PARAMS')
    waterfall([
        (cb) => {

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

            filterLocationPipeline = {};
            if (filterLocation.length > 0) {

                if (filterExcludes == true) {

                    let jsonObj = [];
                    filterLocation.forEach((loc) => {
                        let item = {}
                        item["location"] = { "$in": [loc] };
                        jsonObj.push(item);
                    })
                    filterLocationPipeline = { '$and': jsonObj };

                } else {
                    filterLocationPipeline = { 'location': { $in: filterLocation } }
                }


            }

            //If a family id is provided for filtering, build the filter family pipeline.
            filterFamilyPipeline = {};
            if (mongoose.Types.ObjectId.isValid(params.family)) {
                filterFamilyPipeline = { 'family': new ObjectId(params.family) }
            }
            //console.log(filterFamilyPipeline,'filterFamilyPipeline')
            Dish.aggregate([{
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
                { $match: activePipeline },
                { $match: { 'versions.active': true } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } },
                { $match: { 'location': { $in: userLocIds } } },
                { $match: filterLocationPipeline },
                { $match: filterFamilyPipeline },
                {
                    $match: {
                        $or: [
                            { 'versions.lang.name': { $regex: filterText, $options: 'i' } },
                            { 'family.lang.name': { $regex: filterText, $options: 'i' } }
                        ]
                    }
                },
                { $sort: {
                        [sortField]: sortOrder } },
                { $skip: Number(params.perPage) * Number(params.page) },
                { $limit: Number(params.perPage) }
            ], (err, docs) => {
                if (err) {
                    return cb(err)
                }
                //console.log(docs,'docsBeforePopulate')
                Dish.populate(docs, { path: "measurementUnit kitchens.kitchen versions.gallery location" }, (err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs)
                });
            })

        }, (docs, cb) => { //Create location text list

            let locationList;

            docs.forEach((dish) => {

                locationList = '';

                dish.location.forEach((loc, index) => {

                    if (index < dish.location.length - 1)
                        locationList = locationList + loc.name + ', '
                    else
                        locationList = locationList + loc.name
                })
                dish.locationList = locationList;
            })

            cb(null, docs)

        }, (docs, cb) => { //Map location array back to _ids

            docs.forEach((dish) => {
                dish.location = dish.location.map((loc) => {
                    return loc._id;
                })
            })

            cb(null, docs)

        }, (docs, cb) => { //Update average location cost based on filterLocation

            if (addModal) costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Dish, filterLocation);
            else costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Dish);

            cb(null, docs)

        }, (docs, cb) => { //Dish count

            Dish.aggregate([{
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
                { $match: activePipeline },
                { $match: { 'versions.active': true } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } },
                { $match: { 'location': { $in: userLocIds } } },
                { $match: filterLocationPipeline },
                { $match: filterFamilyPipeline },
                {
                    $match: {
                        $or: [
                            { 'versions.lang.name': { $regex: filterText, $options: 'i' } },
                            { 'family.lang.name': { $regex: filterText, $options: 'i' } }
                        ]
                    }
                },
                { $project: { _id: 1 } }
            ], (err, count) => {
                if (err) {
                    console.log(err)
                    return cb(err)
                }
                //console.log(docs,'docs',count.length,'countLength')
                let dishes = {
                    'dishes': docs,
                    'totalElements': count.length
                };

                cb(null, dishes)
            })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });

};

/**
 * @api {get} /dish/lang Get user lang field of dish version
 * @apiGroup {dish}
 * @apiName Get dish user lang
 *
 * @apiDescription Get user lang of dish version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 * @apiParam {string} versionId  Product version id
 *
 * @apiSuccess {Object} dish user lang
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getUserLang = (req, res) => {
    //Todo: update all composition elements name in case name has changed
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishLocations;
    let dishId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the dish's locations

            if (mongoose.Types.ObjectId.isValid(dishId) && mongoose.Types.ObjectId.isValid(versionId)) {

                Dish.findById(dishId, (err, doc) => {
                    if (err) return cb(err);
                    if (!doc) {
                        let err = new Error("Document not found");
                        err.statusCode = 404;
                        return cb(err)
                    }
                    dishLocations = doc.location;
                    //Check whether list of dish locations includes at least one customer location.

                    var match = dishLocations.find((id) => {
                        let locId = new ObjectId(id);
                        for (var i = 0; i < userLocIds.length; i++) {
                            if (userLocIds[i].equals(locId)) return true;
                        }
                    });
                    if (match) { cb(null, match); } else {
                        var err = new Error('Access to dish location is not allowed');
                        err.statusCode = 400;
                        return cb(err);
                    }
                });
            } else {
                let err = new Error("ObjectId not valid");
                err.statusCode = 400;
                return cb(err)
            }

        }, (doc, cb) => {
            Dish.aggregate([{
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
                { $match: { '_id': dishId } },
                { $match: { 'versions._id': versionId } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } },
            ], (err, doc) => {
                if (err) return cb(err)

                let userLangObj = {
                    userLang: doc[0].versions.lang
                }
                cb(null, userLangObj);
            })
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};


/**
 * @api {get} /dish/version/cooksteps Get cooking steps of dish version
 * @apiGroup {dish}
 * @apiName Get Dish
 *
 * @apiDescription Get a dish version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 * @apiParam {string} versionId  Dish version id
 *
 * @apiSuccess {Object} Dish version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getCookingSteps = (req, res) => {
    //Gets the active version of all dishes that are in the user's zone.
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishLocations;
    let dishId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the dish's locations

            if (mongoose.Types.ObjectId.isValid(dishId) && mongoose.Types.ObjectId.isValid(versionId)) {

                Dish.findById(dishId, (err, doc) => {
                    if (err) return cb(err);
                    if (!doc) {
                        let err = new Error("Document not found");
                        err.statusCode = 404;
                        return cb(err)
                    }
                    dishLocations = doc.location;
                    //Check whether list of dish locations includes at least one customer location.

                    var match = dishLocations.find((id) => {
                        let locId = new ObjectId(id);
                        for (var i = 0; i < userLocIds.length; i++) {
                            if (userLocIds[i].equals(locId)) return true;
                        }
                    });
                    if (match) { cb(null, match); } else {
                        var err = new Error('Access to dish location is not allowed');
                        return err.statusCode = 400;
                        cb(err);
                    }
                });
            } else {
                let err = new Error("ObjectId not valid");
                err.statusCode = 400;
                return cb(err)
            }

        }, (doc, cb) => {
            Dish.aggregate([{
                    $unwind: {
                        path: "$versions",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: "$versions.cookingSteps",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $unwind: {
                        path: "$versions.cookingSteps.lang",
                        preserveNullAndEmptyArrays: true
                    }
                },
                { $match: { '_id': dishId } },
                { $match: { 'versions._id': versionId } },
                { $match: { 'versions.cookingSteps.lang.langCode': userProfile.user.language } },
                //{$match: {'versions.lang.langCode': userProfile.user.language}},
                // {
                //     $group: {
                //         "_id": "$versions.cookingSteps"
                //     }
                // },
                {
                    $group: {
                        "_id": "$_id",
                        "cookingSteps": { $push: "$cookingSteps" }
                    }
                },
            ], (err, doc) => {
                if (err) return cb(err)
                Dish.populate(doc, {
                    path: "process _id.utensil _id.gastroCheckpoint _id.criticalCheckpoint images"
                    //,match: {'versions.cookingSteps.lang.langCode': userProfile.user.language}
                }, (err, doc) => {
                    if (err) return cb(err)
                    cb(null, doc)
                });
            })
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};

/**
 * @api {get} /dish/version Get dish version
 * @apiGroup {dish}
 * @apiName Get Dish
 *
 * @apiDescription Get a dish version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 * @apiParam {string} versionId  Dish version id
 *
 * @apiSuccess {Object} Dish version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getVersion = (req, res) => {
    //Todo: update all composition elements name in case name has changed
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishLocations;
    let dishId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 
    var Ingredient = require('../models/ingredient');
    var Subproduct = require('../models/subproduct');
    var Model;

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the dish's locations

            if (mongoose.Types.ObjectId.isValid(dishId) && mongoose.Types.ObjectId.isValid(versionId)) {

                Dish.findById(dishId, (err, doc) => {
                    if (err) return cb(err);
                    if (!doc) {
                        let err = new Error("Document not found");
                        err.statusCode = 404;
                        return cb(err)
                    }
                    dishLocations = doc.location;
                    //Check whether list of dish locations includes at least one customer location.

                    var match = dishLocations.find((id) => {
                        let locId = new ObjectId(id);
                        for (var i = 0; i < userLocIds.length; i++) {
                            if (userLocIds[i].equals(locId)) return true;
                        }
                    });
                    if (match) { cb(null, match); } else {
                        var err = new Error('Access to dish location is not allowed');
                        err.statusCode = 400;
                        return cb(err);
                    }
                });
            } else {
                let err = new Error("ObjectId not valid");
                err.statusCode = 400;
                return cb(err)
            }

        }, (doc, cb) => {
            Dish.aggregate([{
                    $unwind: {
                        path: "$versions",
                        preserveNullAndEmptyArrays: true
                    }
                },
                { $match: { '_id': dishId } },
                { $match: { 'versions._id': versionId } },
                //{$match: {'versions.lang.langCode': userProfile.user.language}},
                // {
                //     $group: {
                //         "_id": "$_id",
                //         "cookingSteps": {$push: "$cookingSteps"}
                //     }
                // },
            ], (err, doc) => {
                if (err) return cb(err)
                Dish.populate(doc, {
                    path: "versions.gallery measurementUnit kitchens.kitchen versions.cookingSteps.process versions.cookingSteps.utensil versions.cookingSteps.gastroCheckpoint versions.cookingSteps.criticalCheckpoint versions.cookingSteps.images"
                    //,match: {'versions.cookingSteps.lang.langCode': userProfile.user.language}
                }, (err, doc) => {
                    if (err) return cb(err)
                    cb(null, doc)
                });
            })

        }, (doc, cb) => {

            //Filter ingredient or subproduct lang field based on user language
            async.each(doc[0].versions.composition, function(compElement, cb_async) {

                if (compElement.element.kind == 'subproduct') { //composition element is a subproduct

                    Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
                        if (err) return cb(err)

                        if (compElement.element.item != null) {

                            //Filter active version
                            let activeVersion = compElement.element.item.versions.filter((version) => {
                                return version.active == true;
                            })

                            if (activeVersion.length) {

                                compElement.element.item.versions = activeVersion;
                                compElement.active = compElement.element.item.active;
                                //Store location of subproduct
                                compElement.location = compElement.element.item.location;

                                //Update unit cost and locationCost of drink
                                compElement.unitCost = compElement.element.item.versions[0].unitCost;
                                if (compElement.element.item.versions[0].locationCost) {
                                    compElement.locationCost = compElement.element.item.versions[0].locationCost;
                                } else {
                                    compElement.locationCost = [];
                                }

                                if (compElement.element.item.versions[0].locationAllergens) {
                                    compElement.locationAllergens = compElement.element.item.versions[0].locationAllergens;
                                } else {
                                    compElement.locationAllergens = [];
                                }

                                //Update composition element unitCost with average location cost based on filterLocation
                                costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc[0].location, Subproduct);

                                //Filter user language
                                let userLang = [];

                                userLang = compElement.element.item.versions[0].lang.filter((langItem) => {
                                    return langItem.langCode == userProfile.user.language;
                                })

                                if (userLang.length) {
                                    //The client assumes item is not populated. Must de-populate it.
                                    compElement.element.item = compElement.element.item._id;
                                    compElement.name = userLang[0].name;
                                }

                            } else {
                                logger.error('Could not retrive active version of dish in recipe composition. Dish id: %s', dishId, ' and version id: ', versionId);
                                let err = new Error('Could not retrive active version of dish in recipe composition')
                                return cb_async(err)
                            }
                        } else {
                            compElement.itemNull = true;
                            logger.error('Could not populate subproduct in dish recipe. Dish id: %s', dishId, ' and version id: ', versionId);
                            let err = new Error('Could not populate subproduct in dish recipe')
                            return cb_async(err)
                        }

                        cb_async();
                    });

                } else { //composition element is an ingredient

                    Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {

                        if (err) return cb(err)

                        if (compElement.element.item != null) {
                            compElement.active = compElement.element.item.active;
                            //Udpdate unit cost and locationCost of ingredient
                            compElement.unitCost = compElement.element.item.referencePrice;

                            if (compElement.element.item.locationCost) {
                                compElement.locationCost = compElement.element.item.locationCost;
                            } else {
                                compElement.locationCost = [];
                            }

                            if (compElement.element.item.locationAllergens) {
                                compElement.locationAllergens = compElement.element.item.locationAllergens;
                            } else {
                                compElement.locationAllergens = [];
                            }

                            //Update composition element unitCost with average location cost based on filterLocation
                            costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc[0].location, Ingredient);

                            //Filter user language
                            let userLang = [];

                            userLang = compElement.element.item.lang.filter((langItem) => {
                                return langItem.langCode == userProfile.user.language;
                            })

                            if (userLang.length) {
                                //The client assumes item is not populated. Must de-populate it.
                                compElement.temporality = compElement.element.item.temp;
                                compElement.element.item = compElement.element.item._id;
                                compElement.name = userLang[0].name;
                            }
                        } else {
                            compElement.itemNull = true;
                            logger.error('Could not populate ingredient in dish recipe. Dish id: %s', dishId, ' and version id: ', versionId)
                        }

                        cb_async();
                    });
                }

            }, (err) => { //finished async loop
                cb(null, doc);
            });


        }, (doc, cb) => { //Check all composition element's location include the gastro offer location

            doc[0].versions.composition.forEach((compElement) => {

                if (compElement.element.item != null && compElement.element.kind == 'subproduct' && compElement.location && compElement.location.length) {

                    let included = doc[0].location.every((l1) => {
                        let loc1 = new ObjectId(l1);
                        return compElement.location.some((l2) => {
                            let loc2 = new ObjectId(l2)
                            return loc2.equals(loc1)
                        })
                    })

                    if (!included) compElement.locationWarning = true;
                    else compElement.locationWarning = false;

                } else {
                    compElement.locationWarning = false;
                }
            })

            cb(null, doc)

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};


/**
 * @api {get} /dish/versions Get all dish's versions
 * @apiGroup {dish}
 * @apiName Get Dish Versions
 *
 * @apiDescription Get all dish's versions
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 *
 * @apiSuccess {Object} Dish version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getAllVersions = (req, res) => {
    //Gets the active version of all dishes that are in the user's zone.
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    let dishId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var filterLocation;
    var activePipeline;

    waterfall([
        (cb) => {

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }

            params.sort = { 'versions.updatedAt': -1 };

            Dish.aggregate([{
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
                { $match: { '_id': dishId } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } },
                { $match: { 'versions.lang.name': { $regex: params.filterText, $options: 'i' } } },
                { $sort: params.sort },
                { $skip: Number(params.perPage) * Number(params.page) },
                { $limit: Number(params.perPage) }
            ], (err, docs) => {
                if (err) return cb(err)
                Dish.populate(docs, { path: "measurementUnit kitchens.kitchen versions.gallery versions.last_account" }, (err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs)
                });
            })

        }, (docs, cb) => { //Populate user in last_account

            User.populate(docs, { path: 'versions.last_account.user' }, (err, docs) => {
                if (err) return cb(err)
                cb(null, docs)
            })

        }, (docs, cb) => { //Update average location cost based on filterLocation

            costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Dish);

            cb(null, docs)

        }, (docs, cb) => { //Get total number of elements for pagination

            Dish.aggregate([{
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
                { $match: { '_id': dishId } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } },
                { $match: { 'versions.lang.name': { $regex: params.filterText, $options: 'i' } } },
            ], (err, docsCount) => {
                if (err) return cb(err)

                let length = docsCount.length;

                let versions = {
                    'versions': docs,
                    'totalElements': length
                };

                cb(null, versions)
            })


        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};

/**
 * @api {get} /dish/elements Gets ordered list of ingredients and subproducts
 * @apiGroup {dish}
 * @apiName Get Dish's Elements
 *
 * @apiDescription Gets ordered list of ingredients and subproducts that can be included in a dish recipe
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getElements = (req, res) => {

    elementsHelper.getElements(req, (err, doc) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc).end();
    })
};
exports.getIngredientsFilter = (req, res) => {

    elementsHelper.getIngredientsFilter(req, (err, doc) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc).end();
    })
};
exports.getSubproductsFilter = (req, res) => {

    elementsHelper.getSubproductsFilter(req, (err, doc) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc).end();
    })
};

/**
 * @api {get} /dish/activeversion Gets active version of dish
 * @apiGroup {dish}
 * @apiName Get Dish's Active Version
 *
 * @apiDescription Gets our active Version of Dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getActiveVersion = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    let dishId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId

    waterfall([
        (cb) => {
            Dish.aggregate([{
                    $unwind: { path: "$versions" }
                },
                { $match: { '_id': dishId } },
                { $match: { 'versions.active': true } }
            ], (err, doc) => {
                if (err) return cb(err)
                cb(null, doc)
            })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/**
 * @api {get} /dish/duplicate Duplicates dish
 * @apiGroup {dish}
 * @apiName Duplicates active version of dish
 *
 * @apiDescription Duplicates active version of dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  dish id to be duplicated
 * @apiParam {string} name  New dish name (in user's language)
 * @apiParam {string} location  Location for new dish
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.duplicate = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var updateSubproductsLocation = params.updateSubproductsLocation;
    var updateSubproductsLocationFlag = false;
    if (updateSubproductsLocation == 'true') updateSubproductsLocationFlag = true
    let dishId = new ObjectId(params._id);
    var account = req.userData;
    var activeVersion;
    let newGallery;

    var AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;

    logger.info('Dish controller :: duplicate - Entering method...');

    waterfall([

        (cb) => { //Get active version of dish to be duplicated, without _id

            if (mongoose.Types.ObjectId.isValid(dishId)) {

                Dish.findOne({
                        _id: dishId
                    }, {
                        _id: 0,
                        active: 1,
                        family: 1,
                        subfamily: 1,
                        measurementUnit: 1,
                        kitchens: 1,
                        workRoom: 1,
                        caducityFresh: 1,
                        caducityFreeze: 1,
                        daysToUse: 1,
                        location: 1,
                        versions: { $elemMatch: { active: true } }
                    })
                    .populate('versions.pricing')
                    .exec((err, doc) => {
                        if (err) cb(err)
                        cb(null, doc)
                    })

            } else {
                let err = new Error("Must provide a valid Dish id")
                err.statusCode = 402
                return cb(err)
            }

        }, (doc, cb) => {

            //Must convert doc to JSON otherwise mongo throws error

            doc = doc.toJSON();

            activeVersion = doc.versions[0];

            if (activeVersion.gallery) {

                Gallery.findById(activeVersion.gallery, (err, gallery) => {
                    if (err) return cb(err)
                    if (!gallery) {
                        let err = new Error('Document not found')
                        err.statusCode = 404;
                        return cb(err)
                    }

                    newGallery = new Gallery({
                        originalName: gallery.originalName,
                        sizes: gallery.sizes
                    })

                    cb(null, doc)

                })
            } else {
                cb(null, doc)
            }
        }, (doc, cb) => {

            if (!newGallery) return cb(null, doc)

            let sizes = [];
            //Generate number to save new gallery
            let random_name = referenceNumberGeneratorHelper.generateReferenceNumber('')

            async.eachSeries(newGallery.sizes, (size, cb_async) => {

                let extension = size.url.split('.').pop()
                let key = 'imgs/dish/' + random_name + '-' + size.sizeCode + '.' + extension
                let s3Url = 'https://s3-' + config.awsBucket.region + '.amazonaws.com/'
                let url = s3Url + config.awsBucket.bucketName + '/' + key

                var params = {
                    Bucket: config.awsBucket.bucketName,
                    CopySource: size.url,
                    Key: key,
                    ACL: 'public-read'

                };
                var s3 = new AWS.S3;

                s3.copyObject(params, function(err, data) {
                    if (err) return cb_async(err);
                    sizes.push({
                        sizeCode: size.sizeCode,
                        url: url
                    });
                    cb_async();
                });

            }, (err) => {
                newGallery.sizes = sizes;

                if (err) return cb(err)
                newGallery.save((err, galle) => {
                    if (err) return cb(err);
                    cb(null, doc);
                });
            })


        }, (doc, cb) => {

            //Filter lang by user language
            let userLang = activeVersion.lang.filter((lang) => {
                return lang.langCode == userProfile.user.language
            })        

            logger.info('Dish controller :: duplicate - Retrieved dish lang: %s', JSON.stringify(userLang));	

            if (params.name) {

                //Set lang to [] before re-setting it
                activeVersion.lang = [];

                let langObj = {
                    langCode: userProfile.user.language,
                    name: params.name,
                    description: userLang[0].description,
										gastroComment: userLang[0].gastroComment,
										gastroCommentLabel: userLang[0].gastroCommentLabel,
										diet: userLang[0].diet,
										dietLabel: userLang[0].dietLabel,
										tasting: userLang[0].tasting,
										tastingLabel: userLang[0].tastingLabel
                }

            		logger.info('Dish controller :: duplicate - Created new dish lang: %s', JSON.stringify(langObj));	
                activeVersion.lang.push(langObj)

            } else {

                let name = 'copy of ' + userLang[0].name;

                activeVersion.lang = [];

                let langObj = {
                    langCode: userProfile.user.language,
                    name: name.toUpperCase(),
                    description: userLang[0].description,
										gastroComment: userLang[0].gastroComment,
										gastroCommentLabel: userLang[0].gastroCommentLabel,
										diet: userLang[0].diet,
										dietLabel: userLang[0].dietLabel,
										tasting: userLang[0].tasting,
										tastingLabel: userLang[0].tastingLabel
                }

            		logger.info('Dish controller :: duplicate - Created new dish lang: %s', JSON.stringify(langObj));	
                activeVersion.lang.push(langObj)
            }

            cb(null, doc)

        }, (doc, cb) => { //Duplicate pricing rates

            let pricingRates = [];

            activeVersion.pricing.forEach((pricingRate) => {

                let rate = new PricingRate();

                rate.name = pricingRate.name;
                rate.costOverPricePercentage = pricingRate.costOverPricePercentage;
                rate.price = pricingRate.price;
                rate.active = pricingRate.active;

                pricingRates.push(rate)

            })

            activeVersion.pricing = pricingRates;
            cb(null, doc)

        }, (doc, cb) => {
            if (newGallery) activeVersion.gallery = newGallery._id;
            doc.versions = [];
            doc.versions.push(activeVersion)

            //If params.location provided, set the new location of the duplicate document
            if (params.location) {
                let location = JSON.parse(params.location).map(function(doc) { return new ObjectId(doc); });
                doc.location = location;
            }

            cb(null, doc)

        }, (doc, cb) => {

            //Calculate subproduct composition reference and location cost
            costHelper.calculateRecipeCompLocationCosts(activeVersion, doc.location, Dish, (err, res) => {
                if (err) return cb(err)

                doc.versions[0].locationCost = res.locationCost;
                doc.versions[0].costPerServing = res.costPerServing;

                cb(null, doc)
            })

        }, (doc, cb) => {

            allergenHelper.calculateRecipeLocationAllergens(activeVersion, doc.location, (err, res) => {
                if (err) return cb(err)

                doc.versions[0].locationAllergens = res.locationAllergens;
                doc.versions[0].allergens = res.referenceAllergens;

                cb(null, doc)
            })


        }, (doc, cb) => {
            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber('004')
            let duplicate = new Dish(doc);

            //console.log('duplicate Dish',duplicate)
            duplicate.save((err, dup) => {
                cb(null, dup)
            })

        }, (dup, cb) => {

            if (updateSubproductsLocationFlag) {

                if (!dup.versions[0].composition.length) return cb(null, dup)
                let parent = [];

                locHelper.computeRecipeLocationsRecursively(dup._id, dup.location, Dish, parent, (err, res) => {
                    cb(null, dup)
                })

            } else {
                cb(null, dup)
            }

        }
    ], (err, dup) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(dup).end();
    })

};



/**
 * @api {get} /dish/duplicateIntoSubproduct Duplicates dish into subproduct
 * @apiGroup {dish}
 * @apiName Duplicates active version of dish into subproduct
 *
 * @apiDescription Duplicates active version of dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  dish id to be duplicated
 * @apiParam {string} name  New subproduct name (in user's language)
 * @apiParam {string} location  Location for new subproduct
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.duplicateIntoSubproduct = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    let dishId = new ObjectId(params._id);
    var updateSubproductsLocation = params.updateSubproductsLocation;
    var updateSubproductsLocationFlag = false;
    if (updateSubproductsLocation == 'true') updateSubproductsLocationFlag = true
    var account = req.userData;
    var activeVersion;
    var subproductActiveVersion;
    var Subproduct = require('../models/subproduct');
    var costHelper = require('../helpers/cost');
    let newGallery;

    var AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;

    waterfall([

        (cb) => { //Get active version of dish to be duplicated, without _id

            if (mongoose.Types.ObjectId.isValid(dishId)) {

                Dish.findOne({
                        _id: dishId
                    }, {
                        _id: 0,
                        active: 1,
                        family: 1,
                        subfamily: 1,
                        measurementUnit: 1,
                        kitchens: 1,
                        workRoom: 1,
                        caducityFresh: 1,
                        caducityFreeze: 1,
                        daysToUse: 1,
                        location: 1,
                        versions: { $elemMatch: { active: true } }
                    })
                    .populate('versions.pricing')
                    .exec((err, doc) => {
                        if (err) cb(err)
                        cb(null, doc)
                    })

            } else {
                let err = new Error("Must provide a valid Dish id")
                err.statusCode = 402
                return cb(err)
            }

        }, (doc, cb) => {

            //Must convert doc to JSON otherwise mongo throws error
            doc = doc.toJSON();

            activeVersion = doc.versions[0];

            if (activeVersion.gallery) {

                Gallery.findById(activeVersion.gallery, (err, gallery) => {
                    if (err) return cb(err)
                    if (!gallery) {
                        let err = new Error('Document not found')
                        err.statusCode = 404;
                        return cb(err)
                    }

                    newGallery = new Gallery({
                        originalName: gallery.originalName,
                        sizes: gallery.sizes
                    })

                    cb(null, doc)

                })
            } else {
                cb(null, doc)
            }
        }, (doc, cb) => {

            if (!newGallery) return cb(null, doc)

            let sizes = [];
            //Generate number to save new gallery
            let random_name = referenceNumberGeneratorHelper.generateReferenceNumber('')

            async.eachSeries(newGallery.sizes, (size, cb_async) => {

                let extension = size.url.split('.').pop()
                let key = 'imgs/subproduct/' + random_name + '-' + size.sizeCode + '.' + extension
                let s3Url = 'https://s3-' + config.awsBucket.region + '.amazonaws.com/'
                let url = s3Url + config.awsBucket.bucketName + '/' + key

                var params = {
                    Bucket: config.awsBucket.bucketName,
                    CopySource: size.url,
                    Key: key,
                    ACL: 'public-read'

                };
                var s3 = new AWS.S3;

                s3.copyObject(params, function(err, data) {
                    if (err) return cb_async(err);
                    sizes.push({
                        sizeCode: size.sizeCode,
                        url: url
                    });
                    cb_async();
                });

            }, (err) => {
                newGallery.sizes = sizes;

                if (err) return cb(err)
                newGallery.save((err, galle) => {
                    if (err) return cb(err);
                    cb(null, doc);
                });
            })


        }, (doc, cb) => {

            if (params.name) {

                //Set lang to [] before re-setting it
                activeVersion.lang = [];

                let langObj = {
                    langCode: userProfile.user.language,
                    name: params.name
                }

                activeVersion.lang.push(langObj)

            } else {

                //Filter lang by user language
                let userLang = activeVersion.lang.filter((lang) => {
                    return lang.langCode == userProfile.user.language
                })

                let name = 'copy of ' + userLang[0].name;

                activeVersion.lang = [];

                let langObj = {
                    langCode: userProfile.user.language,
                    name: name.toUpperCase()
                }

                activeVersion.lang.push(langObj)
            }

            cb(null, doc)

        }, (doc, cb) => {

            subproductActiveVersion = activeVersion;

            subproductActiveVersion.batchWeight = 0;
            subproductActiveVersion.netWeight = activeVersion.weightPerServing;
            //subproductActiveVersion.netWeight = 0;
            subproductActiveVersion.unitCost = 0;

            delete subproductActiveVersion.numServings;
            delete subproductActiveVersion.batchServings;
            delete subproductActiveVersion.costPerServing;
            delete subproductActiveVersion.weightPerServing;
            delete subproductActiveVersion.refPricePerServing;
            delete subproductActiveVersion.maxCostOverPricePercentage;

            cb(null, doc)


        }, (doc, cb) => {
            if (newGallery) activeVersion.gallery = newGallery._id;
            doc.versions = [];
            doc.versions.push(subproductActiveVersion)

            //If params.location provided, set the new location of the duplicate document
            if (params.location) {
                let location = JSON.parse(params.location).map(function(doc) { return new ObjectId(doc); });
                doc.location = location;
            }

            cb(null, doc)

        }, (doc, cb) => {

            //Calculate subproduct composition reference and location cost for aggregate locations in composition list
            costHelper.calculateRecipeCompLocationCosts(subproductActiveVersion, doc.location, Subproduct, (err, res) => {
                if (err) return cb(err)

                doc.versions[0].locationCost = res.locationCost;
                doc.versions[0].unitCost = res.unitCost;

                cb(null, doc)
            })

        }, (doc, cb) => {

            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber('004')
            let duplicate = new Subproduct(doc);

            //console.log('duplicate Dish',duplicate)
            duplicate.save((err, dup) => {
                cb(null, dup)
            })

        }, (dup, cb) => {

            if (updateSubproductsLocationFlag) {

                if (!dup.versions[0].composition.length) return cb(null, dup)
                let parent = [];
                parent = parent.concat(dup._id);

                locHelper.computeRecipeLocationsRecursively(dup._id, dup.location, Subproduct, parent, (err, locations) => {
                    cb(null, dup)
                })

            } else {
                cb(null, dup)
            }


        }
    ], (err, dup) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(dup).end();
    })

};

/**
 * @api {get} /dish/locationcost Get dishes's cost by location
 * @apiGroup {dish}
 * @apiName Get dishes location costs
 *
 * @apiDescription Get dishes location costs. First cost in the array is the reference costPerServing.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * @apiParam {string} _id  Dish id
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiVersion 0.1.0
 *
 */

exports.getLocationCost = (req, res) => {
    let dishId = new ObjectId(req.query._id);
    var versionId = new ObjectId(req.query.versionId);
    var userData = req.userData;
    var locationCostArray = [];
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var dish;

    waterfall([
        (cb) => {

            Dish.findOne({
                    _id: dishId
                }, {
                    _id: 0,
                    active: 1,
                    family: 1,
                    subfamily: 1,
                    measurementUnit: 1,
                    location: 1,
                    versions: { $elemMatch: { _id: versionId } }
                })
                .exec((err, doc) => {
                    if (err) return cb(err)
                    if (!doc) {
                        var err = new Error('Document not found or empty');
                        err.statusCode = 400;
                        return cb(err);
                    }
                    dish = JSON.parse(JSON.stringify(doc));
                    let activeVersion = dish.versions[0];
                    activeVersion.locationCost = [];
                    dish.versions = activeVersion;
                    //console.log(dish, 'dish')
                    cb(null, doc)
                })

        }, (doc, cb) => {

            Dish.aggregate([
                { $match: { '_id': dishId } },
                {
                    $unwind: { path: "$versions" }
                },
                { $match: { 'versions._id': versionId } },
                {
                    $unwind: {
                        path: "$versions.locationCost",
                        preserveNullAndEmptyArrays: true
                    }
                },
                { $match: { "versions.locationCost.location": { $in: userLocIds } } },
                { // Alternative to populate
                    "$lookup": {
                        "from": "locations",
                        "localField": "versions.locationCost.location",
                        "foreignField": "_id",
                        "as": "versions.locationCost.location"
                    }
                },
                {
                    $unwind: {
                        path: "$versions.locationCost.location",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    "$group": {
                        "_id": "$_id",
                        "locationCost": { "$push": "$versions.locationCost" },
                        "costPerServing": { "$addToSet": "$versions.costPerServing" }
                    }
                },
                {
                    $unwind: {
                        path: "$costPerServing"
                    }
                }
            ], (err, doc) => {
                if (err) return cb(err)

                if (!doc) {
                    var err = new Error('Document not found or empty');
                    err.statusCode = 400;
                    return cb(err);
                }

                if (!doc.length) {
                    cb(null, dish)
                } else {
                    let res = {
                        _id: doc[0]._id,
                        versions: {
                            locationCost: doc[0].locationCost,
                            costPerServing: doc[0].costPerServing
                        }
                    }
                    cb(null, res)
                }
            })

        }, (doc, cb) => {

            if (doc.versions.locationCost && doc.versions.locationCost.length) locationCostArray = locationCostArray.concat(doc.versions.locationCost) //add location prices to array

            locationCostArray = locationCostArray.filter((item) => { //remove items with cost zero
                return item.unitCost != 0;
            })

            //Add unit cost as first element in the array
            let unitCostObject = {
                location: { name: 'Reference Cost' },
                unitCost: doc.versions.costPerServing
            }
            locationCostArray.unshift(unitCostObject); //add ref unitcost to array            

            cb(null, locationCostArray)

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};

/**
 * @api {get} /dish/locationallergens Get dishes's allergens by location
 * @apiGroup {dish}
 * @apiName Get dishes location allergens
 *
 * @apiDescription Get dishes location allergens. First allergens in the array is the reference allergens.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * @apiParam {string} _id  Dish id
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiVersion 0.1.0
 *
 */

exports.getLocationAllergens = (req, res) => {
    console.log(req.query, 'query')
    let dishId = new ObjectId(req.query._id);
    var versionId = new ObjectId(req.query.versionId);
    var userData = req.userData;
    var locationAllergensArray = [];
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var dish;

    waterfall([
        (cb) => {
            Dish.aggregate([
                { $match: { _id: dishId } },
                {
                    $unwind: { path: "$versions" }
                },
                { $match: { 'versions._id': versionId } },
                {
                    $project: {
                        'versions.locationAllergens': 1,
                        'versions.allergens': 1,
                        'versions._id': 1
                    }
                },
                {
                    $unwind: {
                        path: "$versions.locationAllergens",
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $match: {
                        $or: [
                            { "versions.locationAllergens.location": { $in: userLocIds } },
                            { "versions.locationAllergens.location": { $exists: false } }
                        ]
                    }
                },
                {
                    "$group": {
                        "_id": "$_id",
                        "locationAllergens": { "$push": "$versions.locationAllergens" },
                        "allergens": { "$addToSet": "$versions.allergens" }
                    }
                },

            ], (err, doc) => {

                // cb(null,doc[0])
                console.log(doc, 'doc')

                if (err) return cb(err)
                if (!doc) {
                    var err = new Error('Document not found or empty');
                    err.statusCode = 400;
                    return cb(err);
                }
                if (!doc.length) return cb(null, doc)
                else {
                    if (doc[0].allergens) doc[0].allergens = doc[0].allergens[0]
                    cb(null, doc[0])
                };
            });

        }, (doc, cb) => {
            if (!doc) return cb(null, doc)

            Location.populate(doc, { path: "locationAllergens.location" }, (err, doc) => {
                if (err) return cb(err)
                cb(null, doc);
            });
        }, (doc, cb) => {
            if (!doc) return cb(null, doc)


            Allergen.populate(doc, [
                { path: "allergens.allergen" },
                { path: "locationAllergens.allergens.allergen" }
            ], (err, doc) => {
                if (err) return cb(err)
                cb(null, doc);
            });
        }, (doc, cb) => {
            if (!doc) return cb(null, doc)

            Gallery.populate(doc, [
                { path: "allergens.allergen.gallery" },
                { path: "locationAllergens.allergens.allergen.gallery" }
            ], (err, doc) => {
                if (err) return cb(err)
                cb(null, doc);
            });
        }, (doc, cb) => {
            if (!doc) return cb(null, doc)

            if (doc.locationAllergens && doc.locationAllergens.length) locationAllergensArray = locationAllergensArray.concat(doc.locationAllergens) //add location prices to array

            let allergenObject = {
                location: { name: 'Reference Allergens' },
                allergens: doc.allergens
            }
            locationAllergensArray.unshift(allergenObject); //add ref unitcost to array
            cb(null, locationAllergensArray)

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};
/**
 * @api {get} /dish/restrictpricingrate Checks whether the dish pricing rate can be removed
 * @apiGroup {dish}
 * @apiName Checks whether the dish pricing rate can be removed
 *
 * @apiDescription Checks whether the dish pricing rate can be removed
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Pricing rate id
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.restrictPricingRate = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var pricingRateId = new ObjectId(params._id);

    console.log('restrict pricing rate')

    waterfall([
        (cb) => {
            GastroOffer.aggregate([{
                    $unwind: { path: "$versions" }
                },
                { $match: { 'versions.composition.pricingRate': pricingRateId } }
            ], (err, docs) => {
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Pricing rate can not be removed because it is used in at least one gastronomic offer');
                    err.statusCode = 400;
                    return cb(err);
                } else {
                    cb(null, true);
                }
            })
        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })

};

/**
 * @api {get} /dish/pricingrates Gets pricing rates of active version of dish
 * @apiGroup {dish}
 * @apiName Get Dish's Pricing Rates
 *
 * @apiDescription Gets pricing rates of active version of dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Dish id
 *
 * @apiSuccess {Object} .  Dish pricing rates
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getPricingRates = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    let dishId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var pricingRates = [];
    waterfall([
        (cb) => {
            Dish.aggregate([
                { $unwind: { path: "$versions" } },
                { $match: { 'location': { $in: userLocIds } } },
                { $match: { '_id': dishId } },
                { $match: { 'versions.active': true } }
            ], (err, doc) => {
                if (err) return cb(err)
                if (doc.length < 1) {
                    let err = new Error("Document not found");
                    err.statusCode = 404;
                    cb(err)
                }
                cb(null, doc)
            })
        }, (doc, cb) => {

            //Add pricing rates included in pricing array, if any
            if (doc[0] && doc[0].versions.pricing && doc[0].versions.pricing.length > 0) {

                doc[0].versions.pricing.forEach(function(rate) {
                    pricingRates.push(rate);
                })

                //sort based on name
                pricingRates.sort(function(a, b) {
                    if (a.name < b.name)
                        return -1;
                    if (a.name > b.name)
                        return 1;
                    return 0;
                });
            }

            //Add reference price. 
            if (doc[0] && doc[0].versions.refPricePerServing) {
                let refPriceObj = {
                    name: 'Default',
                    price: doc[0].versions.refPricePerServing
                }
                pricingRates.splice(0, 0, refPriceObj);
            } else {
                let refPriceObj = {
                    name: 'Default',
                    price: 0
                }
                pricingRates.splice(0, 0, refPriceObj);
            }

            cb(null, pricingRates)

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })

};

/**
 * @api {get} /dish/dishingastrooffers get Active Version of dish there are in gastroOffers
 * @apiGroup {dish}
 * @apiName get Dish Active Version in GastroOffer
 *
 * @apiDescription get Dish Version in GastroOffers
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _dishtId _versionId Dish id Dish version id 
   
 *
 * @apiSuccess {Object} List of GastroOffers that contains our dish active version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getDishInGastroOffers = (req, res) => {
    //console.log('dishInGastroOffers')
    let userProfile = req.userData;
    let params = req.query;
    let dishId = new ObjectId(params._id);
    params.filterText = params.filterText || '';
    var sortField = params.sortField || 'versions.lang.name';
    if (sortField == '') sortField = 'versions.lang.name'
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
    var page = params.page
    var perPage = params.perPage
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishInGastroOffers = [];
    let object;
    var totalItems = 0;
    var inGastroOffer = []
    var totalElements = []
    let filteredInDishes;
    let filterGastroOffer;
    let gastroObjects = []
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
                filterLocationPipeline = { 'location': { $in: filterLocation } }
            }

            GastroOffer.aggregate([{
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
                { // Alternative to populate
                    "$lookup": {
                        "from": "families",
                        "localField": "versions.type",
                        "foreignField": "_id",
                        "as": "versions.type"
                    }
                },
                { // Alternative to populate
                    "$lookup": {
                        "from": "families",
                        "localField": "versions.season",
                        "foreignField": "_id",
                        "as": "versions.season"
                    }
                },
                { $match: { 'versions.composition.element.item': dishId } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } },
                { $match: { 'location': { $in: userLocIds } } },
                { $match: filterLocationPipeline },
                { $match: { 'versions.lang.name': { $regex: params.filterText, $options: 'i' } } },
                {
                    $group: {
                        "_id": "$_id",
                        "active": { $push: "$active" },
                        "ref": { $push: "$ref" },
                        "type": { $push: "$type" },
                        "referenceNumber": { $push: "$referenceNumber" },
                        "location": { $push: "$location" },
                        "versions": { $push: "$versions" }
                    }
                }
            ], (err, count) => {
                if (err) return cb_async(err)
                totalItems += count.length
                cb(null, totalItems)
            })

        }, (doc, cb) => {

            GastroOffer.aggregate([{
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
                { // Alternative to populate
                    "$lookup": {
                        "from": "families",
                        "localField": "versions.type",
                        "foreignField": "_id",
                        "as": "versions.type"
                    }
                },
                { // Alternative to populate
                    "$lookup": {
                        "from": "families",
                        "localField": "versions.season",
                        "foreignField": "_id",
                        "as": "versions.season"
                    }
                },
                { $match: { 'versions.composition.element.item': dishId } },
                { $match: { 'versions.lang.langCode': userProfile.user.language } },
                { $match: { 'location': { $in: userLocIds } } },
                { $match: filterLocationPipeline },
                { $match: { 'versions.lang.name': { $regex: params.filterText, $options: 'i' } } },
                { $skip: Number(params.perPage) * Number(params.page) },
                { $limit: Number(params.perPage) },
                { $sort: {
                        ['versions.active']: -1 } },
                {
                    $group: {
                        "_id": "$_id",
                        "active": { $push: "$active" },
                        "ref": { $push: "$ref" },
                        "type": { $push: "$type" },
                        "referenceNumber": { $push: "$referenceNumber" },
                        "location": { $push: "$location" },
                        "versions": { $push: "$versions" }
                    }
                },
                { $sort: {
                        [sortField]: sortOrder } }
            ], (err, docs) => {

                if (err) return cb(err)

                if (docs && docs.length) {

                    gastroObjects = []

                    docs.forEach((gastroOffer) => {

                        let activeVersion = gastroOffer.versions.shift();

                        let object = {
                            _id: gastroOffer._id,
                            active: gastroOffer.active[0],
                            ref: gastroOffer.ref[0],
                            type: gastroOffer.type[0],
                            referenceNumber: gastroOffer.referenceNumber[0],
                            location: gastroOffer.location[0],
                            versions: gastroOffer.versions,
                            activeVersion: activeVersion
                        }

                        inGastroOffer.push(object)
                    })

                    dishInGastroOffers = [{ gastroOffers: inGastroOffer, totalElements: totalItems }]
                    cb(null, dishInGastroOffers)

                } else {

                    dishInGastroOffers = [{ gastroOffers: [], totalElements: 0 }]

                    cb(null, dishInGastroOffers)
                }

            })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}


/**
 * @api {get} /dish/refreshAllergens compute allergens of all dishes.
 * @apiGroup {dish}
 * @apiName compute dishes allergens 
 *
 * @apiDescription delete ingredient in recipe composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.refreshAllergens = (req, res) => {

    var refreshAllergensQueue = require('../queues/refreshAllergens')

    refreshAllergensQueue.refreshAllergens({
        title: 'Refresh Dish Allergens ',
        model: 'Dish'
    });
    res.status(200).end();
}

/**
 * @api {get} /subproduct/refreshAllergens compute allergens of all subproducts.
 * @apiGroup {subproduct}
 * @apiName compute subproducts allergens 
 *
 * @apiDescription delete ingredient in recipe composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.refreshCompCosts = (req, res) => {

    var refreshRecipesCompCosts = require('../queues/refreshRecipesCompCosts')

    refreshRecipesCompCosts.refreshRecipesCompCosts({
        title: 'Refresh Dishes Composition Costs ',
        model: 'Dish'
    });
    res.status(200).end();

}


/**
 * @api {delete} /dish/dishingastrooffers delete a dish associated to gastroOffer.
 * @apiGroup {dish}
 * @apiName delete dish in gastroOffer 
 *
 * @apiDescription delete dish in gastroOffer composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} dishId dish id gastroOfferId gastroOffer id gastroOfferVersionId gastroOffer Versions _id
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.deleteDishInGastroOffers = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    let dishId = new ObjectId(params.dishId);
    var gastroOfferId = new ObjectId(params.gastroOfferId);
    var gastroOfferVersionId = new ObjectId(params.gastroOfferVersionId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishInGastroOffer = [];
    var GastroOffer = require('../models/gastroOffer');
    let indexArray = []

    async.waterfall([

        (cb) => {

            GastroOffer.findOne({ '_id': gastroOfferId })
                .exec((err, doc) => {

                    if (err) return cb(err)
                    if (!doc) cb(null, true)
                    if (doc) {

                        doc.versions.forEach((version) => {

                            if (version._id.equals(gastroOfferVersionId)) {

                                version.composition.forEach((composition, index) => {

                                    let i = index
                                    //console.log(composition.element.item,'element.item ==', ingredientId,'ingredientId')
                                    if (composition.element.item.equals(dishId)) {
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

            GastroOffer.update({ _id: doc._id }, doc, (err) => {
                if (err) return cb(err)
                cb(null, doc)
            })

        }
    ], (err, ok) => {
        console.log(err, 'err')
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}

/**
 * @api {delete} /dish/all delete all versions where dish associated to gastroOffer.
 * @apiGroup {dish}
 * @apiName delete dish in  all gastroOffer versions 
 *
 * @apiDescription delete dish in gastroOffer composition versions
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} dishId dish id gastroOfferId gastroOffer id
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.deleteAllDishInGastroOffers = (req, res) => {

    let userProfile = req.userData;
    let params = req.query;
    var dish = new ObjectId(params.dishId);
    var gastroOffer = new ObjectId(params.gastroOfferId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var dishInGastroOffer = [];
    var GastroOffer = require('../models/gastroOffer');
    let indexArray = [];

    async.waterfall([

        (cb) => {

            GastroOffer.findOne({ '_id': gastroOffer })
                .populate("versions.composition")
                .sort({ 'versions.updatedAt': -1 })
                .exec((err, doc) => {

                    if (err) return cb(err)
                    if (!doc) cb(null, true)
                    if (doc) {

                        doc.versions.forEach((version, index) => {
                            let i = index
                            if (version.composition.length) {

                                version.composition.forEach((composition) => {

                                    if (composition.element.item.equals(dish)) {
                                        //console.log(version,'versionMatchToDeleted')
                                        console.log(i, 'i')
                                        if (version.active == false) indexArray.push(i)
                                    }

                                })

                            }


                        })
                        //console.log(indexArray,'indexArray')

                        indexArray.forEach((index) => {
                            doc.versions.splice(index, 1)
                        })
                        //console.log(doc,'docFinish')

                        cb(null, doc)
                    }

                })

        }, (doc, cb) => {
            //console.log(recipe.versions.composition,'recipe')
            //console.log(doc.versions.composition,'doc')

            GastroOffer.update({ _id: doc._id }, doc, (err) => {
                if (err) return cb(err)
                cb(null, doc)
            })

        }
    ], (err, ok) => {
        console.log(err, 'err')
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
}


//Function used to sort array based on name
function compare(a, b) {
    if (a.name < b.name)
        return -1;
    if (a.name > b.name)
        return 1;
    return 0;
}


//Endpoint created to set cost to zero in case a dish has a unitcost not defined. This is a one-off endpoint created 
//to resolve an issue.

exports.resetNullCost = (req, res) => {
    var userData = req.userData;

    waterfall([
        (cb) => {
            Dish.aggregate([{
                    $unwind: { path: '$versions' }
                },
                { $match: { 'versions.composition.unitCost': null } },
                {
                    "$group": {
                        "_id": "$_id",
                        "versions": { "$push": "$versions" }
                    }
                }
            ], (err, docs) => {
                if (err) cb(err)
                cb(null, docs)
            })
        }, (docs, cb) => {
            docs.forEach((subproduct) => {
                subproduct.versions.forEach((subproductVersion) => {
                    subproductVersion.composition.forEach((compElement) => {
                        if (!compElement.unitCost || compElement.unitCost == null) {
                            compElement.unitCost = 0;
                        }
                    })
                })
            })
            cb(null, docs)
        }, (docs, cb) => {
            //Save updated subproduct versions
            async.each(docs, function(updatedSubproduct, cb_async) {
                //we first get the actual complete subproduct
                Dish.findById(updatedSubproduct._id, (error, doc) => {
                    //console.log('hello findById')
                    //Update the updated versions
                    updatedSubproduct.versions.forEach((updatedSubproductVersion) => {
                        doc.versions.forEach((subproductVersion, index) => {
                            let subproductVersionId = new ObjectId(subproductVersion._id);
                            let updatedSubproductVersionId = new ObjectId(updatedSubproductVersion._id);
                            if (subproductVersionId.equals(updatedSubproductVersionId)) {
                                //Replace version with updated one
                                //console.log('replacing in position' + index + 'version with calculatedCost' + updatedSubproductVersion.calculatedCost)
                                doc.versions.splice(index, 1, updatedSubproductVersion);
                            }
                        })
                    })
                    doc.save((err) => {
                        if (err) cb(err)
                        cb_async();
                    })
                });
            });
            cb(null, true)
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

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator')
    waterfall([
        (cb) => {
            Dish.find({}, (err, docs) => {
                //console.log(docs,'DOCS')
                if (err) {
                    cb(err)
                }
                cb(null, docs);
            });
        }, (docs, cb) => {
            //console.log('entering GET',docs.length)
            async.eachSeries(docs, function(dish, cb_async) {

                function generateReferenceNumber() {

                    return function() {

                        dish.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.dish)

                        if (dish.referenceNumber) {

                            //console.log(dish.referenceNumber,'Reference Number of Dish')

                            dish.save((err) => {
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