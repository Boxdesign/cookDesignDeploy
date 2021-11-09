"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var enums = require('../config/dbEnums');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');

//Definign schema
var articleLocCostUpdateLogSchema = new Schema({
    type: { 
    	type: String,
    	required: true
    },
    date : {
    	type: Date,
    	required: true
    },
   	success : {
   		type: Boolean,
   		required: true
   	},
   	numArticlesUpdated: {
   		type: Number,
   		required: true
   	},
   	page : {
   		type: Number,
   		required: true
   	}
}, {
    timestamps: true
});

//creating model
var model = mongoose.model('articleLocCostUpdateLog', articleLocCostUpdateLogSchema);
module.exports = model;