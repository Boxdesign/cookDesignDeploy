"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var enums = require('../config/dbEnums');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');

//Definign schema
var checkpointSchema = new Schema({
    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
            type: String,
            required: true,
            unique: true
        },
        description: {
            type: String,
            required: false,
            maxlength: 500
        }
    }],
    type: {
        type: String,
        required: true,
        enum: enums.checkpoints
    },
    referenceNumber:{
        type:String,
        required:false,
        unique:false
    },
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: true
    },
    assigned_location: {
        type: Schema.Types.ObjectId,
        ref: 'location',
        required: false
    }
}, {
    timestamps: true
});


/***************** Pre remove *********************/
checkpointSchema.pre('remove',function(next) {
    var checkpoint = this;       //this is the document being removed
    var Checkpoint = this.constructor;    //this.constructor is the model
    var Subproduct = require('mongoose').model('subproduct');
    var Dish = require('mongoose').model('dish');
    var Product = require('mongoose').model('product');
    var checkpointId = new ObjectId(checkpoint._id);

    waterfall([
    (cb) => {
        //Verify that there aren't any subproduct versions that contain this subproduct
        Subproduct.aggregate([
             {$unwind: {path: "$versions"}},
             {$match: {$or: [{'versions.cookingSteps.criticalCheckpoint': checkpointId},{'versions.cookingSteps.gastroCheckpoint': checkpointId}]}}
             ], (err, doc) => {
                if (err) return cb(err);
                if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Checkpoint cannot be removed because it is used in at cookingSteps of one subproduct');
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
            {$match: {$or: [{'versions.cookingSteps.criticalCheckpoint': checkpointId},{'versions.cookingSteps.gastroCheckpoint': checkpointId}]}}
            ], (err, doc) => {
                if (err) return cb(err);
                if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('Checkpoint cannot be removed because it is used in at cookingSteps of one dish');
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
            {$match: {$or: [{'versions.cookingSteps.criticalCheckpoint': checkpointId},{'versions.cookingSteps.gastroCheckpoint': checkpointId}]}}
          ], (err, docs) => {
                if (err) return cb(err);
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                    var err = new Error('criticalCheckpoint cannot be removed because it is used in at cookingSteps of one product');
                    err.statusCode = 400;
                    return cb(err);                                    
                } else {
                   cb(null, true);
                }            
            })
    }], (err, ok) => {
        // var error = new Error('Forced error');
        // error.statusCode = 400;
        if (err) return next(err);
        next();
        
    })   

})

//creating model
var model = mongoose.model('checkpoint', checkpointSchema);
module.exports = model;
