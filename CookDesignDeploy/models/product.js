"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('./../helpers/restrict');
var compositionSchema = require('mongoose').model('composition').schema;
var assert = require('assert');
var waterfall = require('async-waterfall');
var { ObjectId } = require('mongodb');
var hasAllergensSchema = require('mongoose').model('hasAllergens').schema;
var cookingStepsSchema = require('mongoose').model('cookingSteps').schema;
require('./pricingRate');
var pricingRateSchema = require('mongoose').model('pricingRate').schema;
var packCompositionSchema = require('mongoose').model('packComposition').schema;
var enums = require('../config/dbEnums');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.productHooks;

var productVersionSchema = new Schema({
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
    netWeight: {
        type: Number,
        required: false,
        min: 0
    },
    batchWeight: {
        type: Number,
        required: false,
        min: 0
    },
    compositionCost: { //total composition cost (not a unitcost)
        type: Number,
        required: false,
        min: 0
    },
    packagingCost: { //total packaging cost (not a unit cost)
        type: Number,
        required: false,
        min: 0
    },
    totalCost: { //sum of composition and packaging cost (not a unit cost)
        type: Number,
        required: false,
        min: 0
    },
    unitCost: { //sum of composition and packaging cost divided by net weight (unit cost)
        type: Number,
        required: false,
        min: 0
    },
    refPrice: {
        type: Number,
        required: false,
        min: 0
    },
    maxCostOverPricePercentage: {
        type: Number,
        required: false,
        min: 0
    },
    locationCost: [{ //composition location unit costs (divided by net weight)
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
    packLocCost: [{ //packaging location unit costs (divided by net weight)
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
    totalLocCost: [{ //packaging + composition location unit costs (divided by net weight)
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
    allergens: [
        hasAllergensSchema
    ],
    composition: [
        compositionSchema
    ],
    cookingSteps: [
        cookingStepsSchema
    ],
    packaging: [
        packCompositionSchema
    ],
    pricing: [
        pricingRateSchema
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
var productSchema = new Schema({
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
    workRoom: {
        type: Schema.Types.ObjectId,
        ref: 'workRoom'
    },
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
        productVersionSchema
    ]
}, {
    timestamps: true
});

productSchema.post('init', function() {
    //save original for later use
    this._original = this.toJSON();
});

/***************** Pre remove *********************/
productSchema.pre('remove', function(next) {
    var product = this; //this is the document being removed
    var Product = this.constructor; //this.constructor is the model
    var GastroOffer = require('./gastroOffer');
    var productId = new ObjectId(product._id);

    waterfall([
        (cb) => {
            //Verify that there aren't any gastro offer versions that contain this product
            GastroOffer.aggregate([
                { $unwind: { path: "$versions" } },
                { $match: { 'versions.composition.element.item': productId } }
            ], (err, doc) => {
                if (err) return cb(err);
                if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Product cannot be removed because it is being used in at least one gastronomic offer');
                    err.statusCode = 400;
                    return cb(err);

                } else {
                    cb(null, doc);
                }
            })
        }
    ], (err, ok) => {
        if (err) {
            return next(err);
        }
        next();
    })
})

/***************** Post save *********************/
productSchema.post('save', function(doc, next) {

    var currentCost, originalCost;
    var gastroCost = require('./../helpers/gastroCost');
    var gastroPricing = require('./../helpers/gastroPricing');
    var product = this;
    var Product = this.constructor; //this.constructor is the model
    var activeVersion;
    var originalVersion;
    var locationLoop = [];
    var gastroCostQueue = require('../queues/gastroCompCost');
    var locHelper = require('./../helpers/locations')
    var removeImageQueue = require('../queues/removeImage')


    waterfall([
        (cb) => {

            if (this._original) { //Validate it is not a product creation
                cb(null, true)
            } else { // There is nothing to do, skip next steps;
                return cb(true)
            }

        }, (ok, cb) => {

            //Get data of active version after saving (current cost...)
            activeVersion = this.versions.find(function(version) {
                if (version.active == true) {
                    currentCost = version.totalCost;
                    return true;
                }
            })

            //Get data of active version before saving (original cost ...)
            originalVersion = this._original.versions.find(function(version) {
                if (version.active == true) {
                    originalCost = version.totalCost;
                    return true;
                }
            })
            cb(null, true)

        }, (ok, cb) => { //Compute location loop. Computes list of cost locations deleted, changed or added.

            if (activeVersion && activeVersion.totalLocCost && originalVersion && originalVersion.totalLocCost) {

                //Calculate location loop
                locHelper.computeLocationLoop(activeVersion.totalLocCost, originalVersion.totalLocCost, function(res) {
                    locationLoop = res; //If location loop is empty, price location has not changed.
                    logger.info({ 'Post-save product hook - calculated location loop: ': locationLoop })
                    cb(null, true)
                })

            } else {
                cb(null, true)
            }


        }, (ok, cb) => {

            if (currentCost != originalCost) {

                logger.info('Post-save product hook - Product cost per serving has changed to %s: ', currentCost)

                let unitCostObj = {
                    location: null,
                    unitCost: currentCost,
                    status: 'edit'
                }
                locationLoop.push(unitCostObj) //Add reference cost to location loop
            }

            if (locationLoop.length > 0) {

                logger.info('Either reference cost or location prices of dish have changed.')

                //Reference price of subproduct has changed. Update price of subproducts that include this subproduct.
                gastroCostQueue.updateGastroCompCost({
                    title: 'Post-save product hook - Update gastro composition cost',
                    id: this._id,
                    locationLoop: locationLoop
                });
                cb(null, true)

            } else {
                cb(null, true)
            }

        }, (ok, cb) => {

            gastroPricing.checkProductPricingChanges(product, (pricingChanges) => {
                if (pricingChanges.length > 0) { //There are pricing changes

                    logger.info('Post-save product hook - There are pricing changes.')
                    logger.info({ 'Post-save product hook - pricingChanges': pricingChanges })

                    gastroPricing.updatePricing(product, pricingChanges, (res) => {
                        cb(null, true);
                    })
                } else { //no pricing changes
                    cb(null, true)
                }
            });

        }, (ok, cb) => { //Check if image has changed or has been deleted
            let deleteImage = false;

            if (originalVersion.gallery != null && activeVersion.gallery == null) {
                logger.info('Product post-save hook - Image has been deleted')
                deleteImage = true;
            } else if (originalVersion.gallery != null && activeVersion.gallery != null) {
                let galleryId = new ObjectId(activeVersion.gallery)
                let originalGalleryId = new ObjectId(originalVersion.gallery)

                if (!galleryId.equals(originalGalleryId)) {
                    logger.info('Product post-save hook - Image has changed')
                    deleteImage = true;
                } else {
                    logger.info('Product post-save hook - Image has not changed')
                }
            } else {
                logger.info('Product post-save hook - No image added or one has been added')
            }

            if (process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

                removeImageQueue.removeImage({
                    title: 'Product post-save hook - Remove image',
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
productSchema.index({ location: 1 });

//create model
var model = mongoose.model('product', productSchema);
module.exports = model;