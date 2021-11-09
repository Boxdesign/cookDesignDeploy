"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var enums = require('../config/dbEnums');

var templateSchema = new Schema({

    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
        }
    }],
    category: {
        type: String,
        required: true,
        enum: enums.templateCategories
    },
    subCategory: {
        type: String,
        required: false,
        enum: enums.templateSubcategories
    },
    template: {
        type: String,
        required: true
    },
    orderList: {
        type: String,
        required: false,
    },
    templateCode: {
        type: String,
        required: false
    },
    parentTemplateCode: {
        type: String,
        required: false
    }    
}, {
    timestamps: true
});

//creating model
var model = mongoose.model('template', templateSchema);
module.exports = model;