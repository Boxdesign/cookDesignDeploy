"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var hasAllergensSchema = require('mongoose').model('hasAllergens').schema;

//Define schema
var gastroCompositionSchema = new Schema({
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
    element: { //Dynamic reference to either dish or product or drink. kind can either be 'dish' or 'product'
        kind: String, //either 'dish' or 'product' or 'drink'
        item: {
            type: Schema.Types.ObjectId,
            refPath: 'element.kind',
            validate: {
                validator: function(v) {
                    return v != null;
                },
                message: 'Linked ingredient or packaging must be set!'
            }
        }
    },
    name: {
        type: String,
        required: false
    },
    price: {
        type: Number,
        required: false
    },
    pricingRate: {
        type: Schema.Types.ObjectId,
        ref: 'pricingRate',
        required: false
    },
    numServings: { //For products, numServings is really number of units
        type: Number,
        required: false
    },
    cost: { //Could be unitCost (product) or CostPerServing (dishes and drinks)
        type: Number,
        required: false
    },
    totalCost: { //cost * numServings
        type: Number,
        required: false
    },
    locationCost: [{ //For dishes and drinks locationCost is composition cost, for products it is the sum of composition and packaging costs.
        location: {
            type: Schema.Types.ObjectId,
            ref: 'location',
            validate: {
                validator: function(v) {
                    return v != null;
                },
                message: 'Location must be set!'
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
                message: 'Location must be set!'
            }
        },
        allergens: [
            hasAllergensSchema
        ]
    }],
    allergens: [
        hasAllergensSchema
    ]
}, {
    timestamps: true
});

//creating model
var model = mongoose.model('gastroComposition', gastroCompositionSchema);
module.exports = model;