"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('./../helpers/restrict');
var compositionSchema = require('mongoose').model('composition').schema;
var cookingStepsSchema = require('mongoose').model('cookingSteps').schema;
var assert = require('assert');
var waterfall = require('async-waterfall');
var { ObjectId } = require('mongodb');
var hasAllergensSchema = require('mongoose').model('hasAllergens').schema;
require('./pricingRate');
var pricingRateSchema = require('mongoose').model('pricingRate').schema;
var enums = require('../config/dbEnums');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.dishHooks;


var dishVersionSchema = new Schema({
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
        type: Schema.Types.ObjectId || null,
        ref: 'gallery',
        required: false
    },
    numServings: {
        type: Number,
        required: false,
        min: 0
    },
    batchServings: {
        type: Number,
        required: false,
        min: 0
    },
    costPerServing: {
        type: Number,
        required: false,
        min: 0
    },
    weightPerServing: {
        type: Number,
        required: false,
        min: 0
    },
    refPricePerServing: {
        type: Number,
        required: false,
        min: 0
    },
    maxCostOverPricePercentage: {
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
        unitCost: { //Used unitCost instead of costPerServing for consistency.
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
    pricing: [
        pricingRateSchema
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
var dishSchema = new Schema({
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
            min: 0
        },
        timeUnit: {
            type: String,
            enum: enums.timeIntervals
        }
    },
    caducityFreeze: {
        value: {
            type: Number,
            min: 0
        },
        timeUnit: {
            type: String,
            enum: enums.timeIntervals
        }
    },
    daysToUse: {
        value: {
            type: Number,
            min: 0
        },
        timeUnit: {
            type: String,
            enum: enums.timeIntervals
        }
    },
    location: [{
        type: Schema.Types.ObjectId,
        ref: 'location',
        required: true
    }],
    versions: [
        dishVersionSchema
    ]
}, {
    timestamps: true
});

dishSchema.post('init', function() {
    //save original for later use
    this._original = this.toJSON();
});


/***************** Pre remove *********************/
dishSchema.pre('remove', function(next) {
    var dish = this; //this is the document being removed
    var Dish = this.constructor; //this.constructor is the model
    var GastroOffer = require('./gastroOffer');
    var dishId = new ObjectId(dish._id);
    var async = require('async');

    async.waterfall([
        (cb) => {
            //Verify that there aren't any gastro offer versions that contain this dish
            GastroOffer.aggregate([
                { $unwind: { path: "$versions" } },
                { $match: { 'versions.composition.element.item': dishId } }
            ], (err, doc) => {
                if (err) return cb(err);
                if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Dish cannot be removed because it is being used in at least one gastronomic offer');
                    err.statusCode = 400;
                    return cb(err);

                } else {
                    cb(null, doc);
                }
            })
        }
    ], (err, ok) => {
        if (err) {
            next(err);
        }
        next();
    })
})

/***************** Post save *********************/
dishSchema.post('save', function(doc, next) {

    var currentCostPerServing, originalCostPerServing;
    var gastroCost = require('./../helpers/gastroCost');
    var gastroPricing = require('./../helpers/gastroPricing');
    var dish = this;
    var Dish = this.constructor; //this.constructor is the model
    var activeVersion;
    var originalVersion;
    var locationLoop = [];
    var gastroCostQueue = require('../queues/gastroCompCost');
    var locHelper = require('./../helpers/locations')
    var async = require('async');
    var removeImageQueue = require('../queues/removeImage');

    //console.log('entering dish post save')

    async.waterfall([
        (cb) => {
            if (this._original) { //Validate it is not a dish creation
                //console.log('not a new dish')
                cb(null, true)
            } else { // There is nothing to do, skip next steps;
                //console.log('new dish!')
                return cb(true)
            }
        }, (ok, cb) => {
            //console.log('getting dishes before and after cost')
            //Get data of active version after saving (current cost...)
            activeVersion = this.versions.find(function(version) {
                if (version.active == true) {
                    currentCostPerServing = version.costPerServing;
                    return true;
                }
            })

            //Get data of active version before saving (original cost ...)
            originalVersion = this._original.versions.find(function(version) {
                if (version.active == true) {
                    originalCostPerServing = version.costPerServing;
                    return true;
                }
            })
            cb(null, true)

        }, (ok, cb) => { //Compute location loop. Computes list of cost locations deleted, changed or added.

            if (activeVersion && activeVersion.locationCost && originalVersion && originalVersion.locationCost) {

                //Calculate location loop
                locHelper.computeLocationLoop(activeVersion.locationCost, originalVersion.locationCost, function(res) {
                    locationLoop = res; //If location loop is empty, price location has not changed.
                    logger.info({ 'Post-save dish hook - calculated location loop: ': locationLoop })
                    cb(null, true)
                })

            } else {
                cb(null, true)
            }


        }, (ok, cb) => {

            if (originalCostPerServing != currentCostPerServing) {

                logger.info('Post-save dish hook - Dish cost per serving has changed to %s: ', currentCostPerServing)

                let costPerServingObj = {
                    location: null,
                    unitCost: currentCostPerServing,
                    status: 'edit'
                }
                locationLoop.push(costPerServingObj) //Add reference price to location loop
            }

            if (locationLoop.length > 0) {

                logger.info('Either reference cost or location prices of dish have changed.')

                //Reference price of subproduct has changed. Update price of subproducts that include this subproduct.
                gastroCostQueue.updateGastroCompCost({
                    title: 'Post-save dish hook - Update gastro composition cost',
                    id: this._id,
                    locationLoop: locationLoop
                });
                cb(null, true)

            } else {
                cb(null, true)
            }

        }, (ok, cb) => {
            //console.logger('entering pricing changes')
            gastroPricing.checkDishPricingChanges(dish, (pricingChanges) => {
                //console.logger(pricingChanges, 'pricingChanges')
                if (pricingChanges.length > 0) { //There are pricing changes

                    logger.info('Post-save dish hook - There are pricing changes.')
                    logger.info({ 'Post-save dish hook - pricingChanges': pricingChanges })

                    //console.log(pricingChanges, 'there are pricingChanges of' + this.versions[this.versions.length -1].lang[0].name)
                    gastroPricing.updatePricing(dish, pricingChanges, (res) => {
                        cb(null, true);
                    })
                } else { //no pricing changes
                    cb(null, true)
                }
            });

        }, (ok, cb) => { //Check if image has changed or has been deleted
            let deleteImage = false;

            if (originalVersion.gallery != null && activeVersion.gallery == null) {
                logger.info('Dish post-save hook - Image has been deleted')
                deleteImage = true;
            } else if (originalVersion.gallery != null && activeVersion.gallery != null) {
                let galleryId = new ObjectId(activeVersion.gallery)
                let originalGalleryId = new ObjectId(originalVersion.gallery)

                if (!galleryId.equals(originalGalleryId)) {
                    logger.info('Dish post-save hook - Image has changed')
                    deleteImage = true;
                } else {
                    logger.info('Dish post-save hook - Image has not changed')
                }
            } else {
                logger.info('Dish post-save hook - No image added or one has been added')
            }

            if (process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

                removeImageQueue.removeImage({
                    title: 'Dish post-save hook - Remove image',
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
dishSchema.index({ location: 1 });

//create model
var model = mongoose.model('dish', dishSchema);
module.exports = model;