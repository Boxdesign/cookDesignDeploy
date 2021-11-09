"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('./../helpers/restrict');
var compositionSchema = require('mongoose').model('composition').schema;
var cookingStepsSchema = require('mongoose').model('cookingSteps').schema
var assert = require('assert');
var waterfall = require('async-waterfall');
var { ObjectId } = require('mongodb');
require('../models/hasAllergens');
var hasAllergensSchema = require('mongoose').model('hasAllergens').schema;
var locHelper = require('./../helpers/locations')
var enums = require('../config/dbEnums');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.subproductHooks;


var subProductVersionSchema = new Schema({
    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: false,
        },
        gastroComment: {
            type: String,
            required: false
        },
        gastroCommentLabel: {
            type: String,
            required: false
        },
        diet: {
            type: String,
            required: false
        },
        dietLabel: {
            type: String,
            required: false
        },
        tasting: {
            type: String,
            required: false
        },
        tastingLabel: {
            type: String,
            required: false
        }
    }],
    active: {
        type: Boolean,
        required: true
    },
    gallery: {
        type: Schema.Types.ObjectId,
        ref: 'gallery',
        required: false
    },
    batchWeight: {
        type: Number,
        required: false,
        min: 0
    },
    netWeight: {
        type: Number,
        required: false,
        min: 0
    },
    unitCost: {
        type: Number,
        required: false,
        min: 0
    },
    locationCost: [{
        location: {
            type: Schema.Types.ObjectId,
            ref: 'location',
            validate: {
                validator: function(v) {
                    return v != null;
                },
                message: 'location must be set!'
            }
        },
        unitCost: {
            type: Number,
            min: 0
        }
    }],
    locationAllergens: [{
        location: {
            type: Schema.Types.ObjectId,
            ref: 'location',
            validate: {
                validator: function(v) {
                    return v != null;
                },
                message: 'location must be set!'
            }
        },
        allergens: [
            hasAllergensSchema
        ]
    }],
    allergens: [
        hasAllergensSchema
    ],
    composition: [
        compositionSchema
    ],
    cookingSteps: [
        cookingStepsSchema
    ],
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: true
    }
}, {
    timestamps: true
});


//Define schema
var subProductSchema = new Schema({
    family: {
        type: Schema.Types.ObjectId,
        ref: 'family',
        required: false
    },
    subfamily: {
        type: Schema.Types.ObjectId,
        ref: 'family.subfamilies',
        required: false
    },
    measurementUnit: {
        type: Schema.Types.ObjectId,
        ref: 'measurementUnit',
        required: true
    },
    referenceNumber: {
        type: String,
        required: false,
        unique: false
    },
    active: {
        type: Boolean,
        required: true
    },
    kitchens: [{
        kitchen: {
            type: Schema.Types.ObjectId,
            ref: 'kitchen'
        },
        workRoom: {
            type: Schema.Types.ObjectId,
            ref: 'kitchen.workRooms'
        }
    }],
    caducityFresh: {
        value: {
            type: Number,
            required: false,
            min: 0
        },
        timeUnit: {
            type: String,
            required: false,
            enum: enums.timeIntervals
        }
    },
    caducityFreeze: {
        value: {
            type: Number,
            required: false,
            min: 0
        },
        timeUnit: {
            type: String,
            required: false,
            enum: enums.timeIntervals
        }
    },
    daysToUse: {
        value: {
            type: Number,
            required: false,
            min: 0
        },
        timeUnit: {
            type: String,
            required: false,
            enum: enums.timeIntervals
        }
    },
    location: [{
        type: Schema.Types.ObjectId,
        ref: 'location',
        required: true
    }],
    versions: [
        subProductVersionSchema
    ]
}, {
    timestamps: true
});

subProductSchema.post('init', function() {
    //save original for later use
    this._original = this.toJSON();
});

/***************** Pre remove *********************/
subProductSchema.pre('remove', function(next) {
    var subproduct = this; //this is the document being removed
    var Subproduct = this.constructor; //this.constructor is the model
    var Dish = require('mongoose').model('dish');
    var Product = require('mongoose').model('product');
    var Drink = require('mongoose').model('drink');
    var subproductId = new ObjectId(subproduct._id);
    var async = require('async');

    async.waterfall([
        (cb) => {
            //Verify that there aren't any subproduct versions that contain this subproduct
            Subproduct.aggregate([
                { $unwind: { path: "$versions" } },
                { $match: { 'versions.composition.element.item': subproductId } }
            ], (err, doc) => {
                if (err) return cb(err);
                if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Subproduct cannot be removed because it is used in at least another subproduct');
                    err.statusCode = 400;
                    return cb(err);

                } else {
                    cb(null, doc);
                }
            })
        }, (ok, cb) => {
            //Verify that there aren't any dish versions that contain this subproduct
            Dish.aggregate([
                { $unwind: { path: "$versions" } },
                { $match: { 'versions.composition.element.item': subproductId } }
            ], (err, doc) => {
                if (err) return cb(err);
                if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Subproduct cannot be removed because it is used in at least another dish');
                    err.statusCode = 400;
                    return cb(err);

                } else {
                    cb(null, doc);
                }
            })
        }, (ok, cb) => {
            //Verify that there aren't any product versions that contain this subproduct
            Product.aggregate([
                { $unwind: { path: "$versions" } },
                { $match: { 'versions.composition.element.item': subproductId } }
            ], (err, docs) => {
                if (err) return cb(err);
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Subproduct cannot be removed because it is used in at least one product');
                    err.statusCode = 400;
                    return cb(err);
                } else {
                    cb(null, true);
                }
            })

        }, (ok, cb) => {
            //Verify that there aren't any product versions that contain this subproduct
            Drink.aggregate([
                { $unwind: { path: "$versions" } },
                { $match: { 'versions.composition.element.item': subproductId } }
            ], (err, docs) => {
                if (err) return cb(err);
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Subproduct cannot be removed because it is used in at least one drink.');
                    err.statusCode = 400;
                    return cb(err);
                } else {
                    cb(null, true);
                }
            })


        }
    ], (err, ok) => {
        // var error = new Error('Forced error');
        // error.statusCode = 400;
        if (err) {
            return next(err);
        }
        next();
    })
})

/***************** Post save *********************/
subProductSchema.post('save', function(doc, next) {

    var currentUnitCost, originalUnitCost, currentAllergens, currentLocAllergens, originalAllergens, originalLocAllergens;
    var costHelper = require('./../helpers/cost');
    var allergen = require('./../helpers/allergen');
    var activeVersion;
    var originalVersion;
    var locationLoop = [];
    var recipeCostQueue = require('../queues/recipeCompCost')
    var updateMeasUnitQueue = require('../queues/measUnit')
    var recipeAllergensQueue = require('../queues/recipeCompAllergens')
    var allergenQueue = require('../queues/allergen')
    var async = require('async');
    var removeImageQueue = require('../queues/removeImage')
    var locationAllergensLoop = [];

    logger.info('Entering subproduct post-save')

    async.waterfall([

        (cb) => {
            if (this._original) { //Validate it is not a subproduct creation
                cb(null, true)
            } else { // There is nothing to do, skip next steps;
                logger.info('Subproduct creation, there is nothing to do. Skip next steps.')
                return cb(true)
            }
        }, (ok, cb) => {

            //Get data of active version after saving (current cost, allergens,...)
            activeVersion = this.versions.find((version) => {
                if (version.active == true) {
                    currentUnitCost = version.unitCost;
                    currentAllergens = version.allergens;
                    currentLocAllergens = version.locationAllergens || [];
                    return version;
                }
            })

            //Get data of active version before saving (original cost, allergens, ...)
            originalVersion = this._original.versions.find((version) => {
                if (version.active == true) {
                    originalUnitCost = version.unitCost;
                    originalAllergens = version.allergens;
                    originalLocAllergens = version.locationAllergens || [];
                    return true;
                }
            })

            if (activeVersion && originalVersion) { cb(null, true) } else {
                return cb(null, true)
            } //There's an issue retrieving active version, skip to end.

        }, (ok, cb) => { //Compute location loop. Computes list of cost locations deleted, changed or added.

            if (activeVersion && activeVersion.locationCost && originalVersion && originalVersion.locationCost) {

                //Calculate location loop
                locHelper.computeLocationLoop(activeVersion.locationCost, originalVersion.locationCost, function(res) {
                    locationLoop = res; //If location loop is empty, price location has not changed.
                    logger.info({ 'Post-save subproduct hook - calculated location loop: ': locationLoop })
                    cb(null, true)
                })

            } else {
                cb(null, true)
            }

        }, (ok, cb) => {

            if (originalUnitCost != currentUnitCost) {

                logger.info('Post-save subproduct hook - Subproduct unit cost has changed to %s: ', currentUnitCost)

                let unitCostObj = {
                    location: null,
                    unitCost: currentUnitCost,
                    status: 'edit'
                }
                locationLoop.push(unitCostObj) //Add reference price to location loop
            }

            if (locationLoop.length > 0) {

                logger.info('Post-save subproduct hook - Either reference cost or location cost of subproduct have changed.')

                //Reference price of subproduct has changed. Update price of subproducts that include this subproduct.
                recipeCostQueue.updateRecipeCompCost({
                    title: 'Post-save subproduct hook - Update recipes composition cost',
                    id: this._id,
                    locationLoop: locationLoop
                });
                cb(null, true)

            } else {
                cb(null, true)
            }

        }, (ok, cb) => {

            if (this._original) {
                let measUnitId = new ObjectId(this.measurementUnit)
                let originalMeasUnitId = new ObjectId(this._original.measurementUnit)
                if (!measUnitId.equals(originalMeasUnitId)) {
                    //Measurement unit of subproduct has changed. 
                    //Update measuring unit of recipe composition elements that include this subproduct.
                    updateMeasUnitQueue.create({
                        title: 'Post-save subproduct hook - Update measuring unit',
                        id: this._id,
                        measUnit: this.measurementUnit
                    });
                }
                cb(null, true)
            } else {
                cb(null, true)
            }

        }, (ok, cb) => { //Compute location loop. Computes list of cost locations deleted, changed or added.

            //Calculate location loop
            allergen.computeAllergensLocationLoop(currentLocAllergens, originalLocAllergens, function(res) {
                locationAllergensLoop = res; //If location loop is empty, price location has not changed.
                logger.info('Subproduct post-save hook - Calculated allergens location loop %j.', locationAllergensLoop)
                cb(null, true)
            })

        }, (ok, cb) => {

            logger.info('Subproduct post-save hook - Entering allergen subproduct post-save verification.')

            allergen.hasChanged(currentAllergens, originalAllergens, (hasChanged) => {
                if (hasChanged) {
                    logger.info('Subproduct post-save hook - Subproduct reference allergens has changed to %s: ', this.allergens)

                    let referenceAllergenObj = {
                        location: null,
                        allergens: this.allergens,
                        status: 'edit'
                    }
                    locationAllergensLoop.push(referenceAllergenObj) //Add reference price to location loop

                } else {
                    logger.info('Subproduct post-save hook - Reference allergens have not changed.')
                }
                cb(null, true)
            })

        }, (ok, cb) => {

            if (locationAllergensLoop.length > 0) {
                //Reference price or location prices of ingredient have changed. 

                logger.info('Subproduct post-save hook - Either reference allergens or location allergens of subproduct have changed.')
                logger.info('Subproduct post-save hook - Create updateRecipeCompAllergens task.')

                recipeAllergensQueue.updateRecipeCompAllergens({
                    title: 'Post-save subproduct hook - Update recipes composition allergens',
                    id: this._id,
                    locationLoop: locationAllergensLoop
                });
            }
            cb(null, true)

        }, (ok, cb) => { //Check if image has changed or has been deleted
            let deleteImage = false;

            if (originalVersion.gallery != null && activeVersion.gallery == null) {
                logger.info('Subproduct post-save hook - Image has been deleted')
                deleteImage = true;
            } else if (originalVersion.gallery != null && activeVersion.gallery != null) {
                let galleryId = new ObjectId(activeVersion.gallery)
                let originalGalleryId = new ObjectId(originalVersion.gallery)

                if (!galleryId.equals(originalGalleryId)) {
                    logger.info('Subproduct post-save hook - Image has changed')
                    deleteImage = true;
                } else {
                    logger.info('Subproduct post-save hook - Image has not changed')
                }
            } else {
                logger.info('Subproduct post-save hook - No image added or one has been added')
            }

            if (process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

                removeImageQueue.removeImage({
                    title: 'Subproduct post-save hook - Remove image',
                    id: originalVersion.gallery,
                });
            }

            cb(null, true)
        }
    ], (err, doc) => {
        if (err) {
            if (err == true) next()
            else return next(err);
        } else {
            this._original = this.toJSON();
            next();
        }
    })

});

//Indexes
subProductSchema.index({ location: 1 });

//create model
var model = mongoose.model('subproduct', subProductSchema);
module.exports = model;