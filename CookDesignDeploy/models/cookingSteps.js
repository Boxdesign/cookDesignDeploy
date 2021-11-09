"use strict";

 var mongoose = require('mongoose');
 var Schema = mongoose.Schema;
 var enums = require('../config/dbEnums');

 var videoSchema = new Schema({ 	
 	videoId: {
 		type: String,
 		required: false
 	},
 	url: {
 		type: String,
 		required: false
 	},
 	thumbnailUrl: {
 		type: String,
 		required: false
 	}  	
 },
 {
 	timestamps: true
 });

//Define schema
var cookingStepsSchema = new Schema({
	lang: [{
		langCode: {
			type: String,
			maxlength: 3,
			required: false
		},
		description: {
			type: String,
			required: false,
			unique: false
		},
		criticalCheckpointNote: {
			type: String,
			required: false,
			unique: false
		},
		gastroCheckpointNote: {
			type: String,
			required: false,
			unique: false
		},

	}],
	process: {
		type: Schema.Types.ObjectId,
		ref: 'process',
		required: false
	},
	utensil: {
		type: Schema.Types.ObjectId,
		ref: 'utensil',
		required: false
	},
	time: {
		type: Number,
		required: false,
		min : 0
	},
	timeUnit: {
		type: String,
		required: false
	},
	timeUser: {
		type: Number,
		required: false,
		min : 0
	},
	timeUnitUser: {
		type: String,
		required: false
	},		
	temperature: {
		type: Number,
		required: false
	},
	temperatureProbe: {
		type: Number,
		required: false
	},
	vacuum: {
		type: Number,
		required: false
	},
	pressure: {
		type: Number,
		required: false
	},
	power: {
		type: Number,
		required: false
	},
	criticalCheckpoint: {
		type: Schema.Types.ObjectId,
		ref: 'checkpoint',
		required: false
	},
	gastroCheckpoint: {
		type: Schema.Types.ObjectId,
		ref: 'checkpoint',
		required: false
	},
	images: [{
		type: Schema.Types.ObjectId,
		ref: 'gallery',
		required: false
	}],
	videos: [
		videoSchema
	]
	
},
{
	timestamps: true
});

//creating model
var model = mongoose.model('cookingSteps', cookingStepsSchema);
module.exports = model;