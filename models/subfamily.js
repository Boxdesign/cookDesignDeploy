"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('../helpers/restrict');
//Esquemas referenciados
var Ingredient = require('./ingredient');
var Utensil = require('./utensil');
var Packaging = require('./packaging');

var subfamiliesSchema = new Schema({
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
        }
    }],
    referenceNumber:{
        type:String,
        required:false,
        unique:false
    }
}, {
    timestamps: true
});


// subfamiliesSchema.statics.findDeps = (familyId, cb) => {
//     restrict(cb, familyId, 'family', [Ingredient, Utensil, Packaging]);
// };


/***************** Pre remove *********************/
subfamiliesSchema.pre('remove', function(next) {
    var subFam = this;       //this is the document being removed
    var SubFam = this.constructor;    //this.constructor is the model
    var Subproduct = require('mongoose').model('subproduct');
    //var Packaging = require ('mongoose').model('packaging');
    var Dish = require('mongoose').model('dish');
    var Product = require('mongoose').model('product');
    var subFamId = new ObjectId(subFam._id);

    waterfall([
    (cb) => {
        //Verify that there aren't any subproduct versions that contain this subproduct
        Ingredient.aggregate([
            {$match: {'ingredient.subfamily': subFamId}}
            // {$unwind: {path: "$versions"}},
            // {$match: {'versions.cookingSteps.process': processId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('subFamily cannot be removed because it is used in Ingredient');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb) => {
        Packaging.aggregate([
            {$match: {'packaging.subfamily': subFamId}}
            // {$unwind: {path: "$versions"}},
            // {$match: {'versions.cookingSteps.process': processId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('subFamily cannot be removed because it is used in Packaging');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb) => {

        //Verify that there aren't any dish versions that contain this subproduct
        Subproduct.aggregate([
            {$match: {'subproduct.subfamily': subFamId}},
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.utensil': subFamId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('subFamily cannot be removed because it is used in Subproduct');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb) => {
        //Verify that there aren't any dish versions that contain this subproduct
        Dish.aggregate([
            {$match: {'dish.subfamily': subFamId}},
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.utensil': subFamId}}
        ], (err, doc) => {
            if (err) return cb(err);
            if (doc.length > 0) { //aggregate returns an array. Check if the array is not empty
                var err = new Error('subFamily cannot be removed because it is used in at cookingSteps of dish');
                err.statusCode = 400;
                return cb(err);

            } else {
                cb(null, doc);
            }            
        })
    }, (ok, cb)=> {
          //Verify that there aren't any product versions that contain this subproduct
          Product.aggregate([
            {$match: {'product.subfamily': subFamId}},
            {$unwind: {path: "$versions"}},
            {$match: {'versions.cookingSteps.utensil': subFamId}}
          ], (err, docs) => {
                if (err) return cb(err);
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                  var err = new Error('subFamily cannot be removed because it is used in at cookingSteps of one product');
                  err.statusCode = 400;
                  return cb(err);
                } else {
                    var err= new Error('ERROR');
                   return cb(err);
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
var model = mongoose.model('subfamily', subfamiliesSchema);
module.exports = model;