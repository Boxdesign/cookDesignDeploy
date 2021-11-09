"use strict";

 var mongoose = require('mongoose');
 var Schema = mongoose.Schema;
 var enums = require('../config/dbEnums');
 require('../models/hasAllergens');
 var hasAllergensSchema = require('mongoose').model('hasAllergens').schema;

//Define schema
var compositionSchema = new Schema({
	grossWeight: {
		type: Number,
		required: false
	},
	wastePercentage: {
		type: Number,
		required: false
	},
	measuringUnit: {
		type: Schema.Types.ObjectId,
		ref: 'measurementUnit',
		required: false
	},
	measuringUnitShortName: {
		type: String,
		required: false
	},
	baseUnit: {
		type: Schema.Types.ObjectId,
		ref: 'measurementUnit',
		required: false
	},
	baseUnitShortName: {
		type: String,
		required: false
	},
	name: {
		type: String,
		required: false
	},
	unitCost: {
		type: Number,
		required: false
	},
  locationCost: [{
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
	      message: 'Location must be set!'
	    }
       },
       allergens: [
        hasAllergensSchema
    	]
    }],
	calculatedCost: { //total cost, as opposed to unit cost
		type: Number,
		required: false
	},
	quantity: {  //amount of equivalence units
		type: Number,
		required: false
	},
	equivalenceUnit: {
		quantity: {
			type: Number,
			required: false
		},
		name: {
			type: String,
			required: false
		}
	},
	element: { //Dynamic reference to either ingredient or subproduct. kind can either be 'ingredient' or 'subproduct'
		kind: String,
		item: { 
			type: Schema.Types.ObjectId, 
			refPath: 'element.kind',
			validate: {
	      validator: function(v) {
	        return v != null;
	      },
	      message: 'Linked ingredient or subproduct must be set!'
	    } 
		},
		required: false
	},
	category: {
		type: String,
        enum: enums.compositionType,
        required: false
	},
	allergens: [
        hasAllergensSchema
    ], 
},
{
	timestamps: true
});

//creating model
var model = mongoose.model('composition', compositionSchema);
module.exports = model;

