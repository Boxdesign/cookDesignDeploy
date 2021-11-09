'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var dbEnums = require('./../config/dbEnums')
var restrict = require('../helpers/restrict');
var Utensil = require('./utensil');

var gallerySchema = new Schema({
    originalName: {
        type: String,
        required: false
    },
    sizes: [{
        sizeCode: {
            type: String,
            required: false,
            enum: dbEnums.imageSizeCodes
        },
        url : {
            type: String,
            required: false
        }
    }]
});

gallerySchema.statics.findDeps = (familyId, cb) => {
    restrict(cb, familyId, 'gallery', [Utensil]);
};

var model = mongoose.model('gallery', gallerySchema);
module.exports = model;
