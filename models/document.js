"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var enums = require('../config/dbEnums');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');

//Definign schema
var documentSchema = new Schema({
    label: String, //name
    value: {
        key: String,
        url: String,
        thumbnail: String
    }
}, {
    timestamps: true
});

//creating model
var model = mongoose.model('document', documentSchema);
module.exports = model;

