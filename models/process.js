"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');

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

//Definign schema
var processSchema = new Schema({
    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: false
        }

    }],
    images: [{
        type: Schema.Types.ObjectId,
        ref: 'gallery',
        required: false
    }],
    videos: [
        videoSchema
    ],
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: true
    },
    assigned_location: {
        type: Schema.Types.ObjectId,
        ref: 'location',
        required: false
    },
    referenceNumber:{
        type:String,
        required:false,
        unique:false
    }
}, {
    timestamps: true
});

/***************** Pre remove *********************/
processSchema.pre('remove',function(next) {
    var proc = this;       //this is the document being removed
    var Process = this.constructor;    //this.constructor is the model
    var Subproduct = require('mongoose').model('subproduct');
    var Dish = require('mongoose').model('dish');
    var Product = require('mongoose').model('product');
    var processId = new ObjectId(proc._id);

    waterfall([
    (cb) => {
        //Verify that there aren't any subproduct versions that contain this subproduct
        Subproduct.aggregate([
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.process': processId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('Process cannot be removed because it is used in at cookingSteps of subproduct');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb) => {
        //Verify that there aren't any dish versions that contain this subproduct
        Dish.aggregate([
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.process': processId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('Process cannot be removed because it is used in at cookingSteps of dish');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb)=> {
          //Verify that there aren't any product versions that contain this subproduct
          Product.aggregate([
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.process': processId}}
          ], (err, docs) => {
                if (err) return cb(err);
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                  var err = new Error('Process cannot be removed because it is used in at cookingSteps of one product');
                  err.statusCode = 400;
                  return cb(err);
                } else {
                   cb(null, true);
                }            
          })
    }], (err, ok) => {
        // var error = new Error('Forced error');
        // error.statusCode = 400;
        if (err) { 
            return next(err);
        }
        next();
    }) 
})

//creating model
var model = mongoose.model('process', processSchema);
module.exports = model;
