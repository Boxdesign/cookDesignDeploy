 "use strict";

 var mongoose = require('mongoose');
 var Schema = mongoose.Schema;
 var restrict = require('./../helpers/restrict');
 var assert = require('assert');
 var waterfall = require('async-waterfall');
 var {ObjectId} = require('mongodb');
 require('../models/gastroComposition');
 var gastroCompositionSchema = require('mongoose').model('gastroComposition').schema;
 var enums = require('../config/dbEnums');
 var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.gastroHooks;

 var gastroOfferVersionSchema = new Schema({
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
		}
	}],
	type: {
 		type: Schema.Types.ObjectId,
 		ref: 'family',
 		required: false
 	},
 	season: {
 		type: Schema.Types.ObjectId,
 		ref: 'family',
 		required: false
 	},
 	active: {
 		type: Boolean,
 		required: true
 	},
 	price: { 
 		type: Number,
 		required: false
 	},
 	maxCostOverPrice: {
 		type: Number,
 		required: false
 	},
 	maxCost: {
 		type: Number,
 		required: false
 	},
 	minCost: { 
 		type: Number,
 		required: false
 	},
 	meanCost: { //for gastro offers that require mean cost calculation
 		type: Number,
 		required: false
 	},
 	totalCost: { //for gastro offers that require simple sum of costs
 		type: Number,
 		required: false
 	},
  locationCost: [{  //Either total or mean cost per location depending on gastro offer type.
     location: {
      type: Schema.Types.ObjectId,
      ref: 'location',
     },
     unitCost: { //Kept unitCost for consistency with other models. It is either total cost or mean cost
      type: Number,
      min: 0
    }
  }],  	
 	margin: { 
 		type: Number,
 		required: false
 	},
 	calculMethod: {
 		type: String,
 		required: false,
 		enum: enums.menuCalculMethod
 	},
 	composition: [
 		gastroCompositionSchema
 	],
 	last_account: {
 		type: Schema.Types.ObjectId,
 		ref: 'account',
 		required: true
 	}
 },
 {
 	timestamps: true
 });


//Define schema
var gastroOfferSchema = new Schema({
	active: {
 		type: Boolean,
 		required: true
 	},
 	ref: {
 		type: String,
 		required: false
 	},
 	type: { //Type of gastro offer, menu, buffet, etc..
 		type: enums.menuType,
 		required: false
 	},
 	referenceNumber:{
 		type:String,
 		required:false,
 		unique:false
 	},
	location: [{
		type: Schema.Types.ObjectId, 
		ref: 'location',
		required: true
	}],
	versions: [
		gastroOfferVersionSchema
	]
},
{
	timestamps: true
});

gastroOfferSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});


//Indexes
gastroOfferSchema.index({ location: 1 });

//create model
var model = mongoose.model('gastroOffer', gastroOfferSchema);
module.exports = model;