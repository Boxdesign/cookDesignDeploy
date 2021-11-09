"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');

//Definign schema
var appReleaseSchema = new Schema({
		githubId: String,
		tag_name: String,
		name: String,
		published_at: Date,
		body: String,
		prerelease: Boolean
}, {
    timestamps: true
});

var model = mongoose.model('appRelease', appReleaseSchema);
module.exports = model;