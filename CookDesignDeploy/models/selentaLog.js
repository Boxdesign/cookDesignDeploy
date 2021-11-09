"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var enums = require('../config/dbEnums');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');

//Definign schema
var selentaLogSchema = new Schema({
    type: { 
    	type: String,
    	required: true
    },
    elementsToExport: {
    	type: Number,
    	required: true
    },
    date : {
    	type: Date,
    	required: true
    },
   	success : {
   		type: Boolean,
   		required: true
   	}
}, {
    timestamps: true
});

//creating model
var model = mongoose.model('selentaLog', selentaLogSchema);
module.exports = model;