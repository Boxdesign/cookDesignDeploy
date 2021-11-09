"use strict";

 var mongoose = require('mongoose');
 var Schema = mongoose.Schema;
 var enums = require('../config/dbEnums');

 var packCompositionSchema = new Schema({
 	numItems: {
 		type: Number,
 		required: false,
 		min: 0
 	},
 	packaging: {
 		type: Schema.Types.ObjectId,
 		ref: 'packaging',
 		required: false,
 		min: 0
 	},
 	unitCost: {
 		type: Number,
 		required: false,
 		min: 0
 	},
 	totalCost: {  
 		type: Number,
 		required: false,
 		min: 0
 	},
  locationCost: [{
     location: {
      type: Schema.Types.ObjectId,
      ref: 'location',
     },
     unitCost: {
      type: Number,
      min: 0
    }
  }],
 	name: {
 		type: String,
 		required: false
 	},
 	measuringUnitShortName: {
 		type: String,
 		required: false
 	},
 },
 {
 	timestamps: true
 });

//creating model
var model = mongoose.model('packComposition', packCompositionSchema);
module.exports = model;

