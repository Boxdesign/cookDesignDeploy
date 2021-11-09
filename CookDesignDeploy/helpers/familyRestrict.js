/*

This helper checks referential integrity for families and subfamilies

*/


var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var async = require('async');


exports.familyRestrict = (id, callback) => { //method called from pre-remove hook
    var Utensil = require('../models/utensil');
    var Packaging = require('../models/packaging');  
    var Subproduct = require('../models/subproduct');
    var GastroOffer = require('../models/gastroOffer');
    var Drinks = require('../models/drinks');
    var Dish = require('../models/dish');
    var Product = require('../models/product');
    var Ingredient = require('../models/ingredient');
    var famId = new ObjectId(id);

    var Models = [Ingredient, Utensil, Packaging, Subproduct, Dish, Product, GastroOffer, Drinks];
    var matches = [];

    async.eachSeries(Models, (Model, cb) => {

            if (Model == GastroOffer) {

                Model.aggregate([
                    {$unwind: {path: "$versions"}},
                    {$match: { $or: [{ 'versions.type': famId },{ 'versions.season': famId }, { 'versions.composition.family': famId }]}}
                ], (err, doc) => {
                    if (err) {
                        return cb(err); 
                    } else {
                        if (doc.length > 0){
                            let match = {
                                doc: doc
                            };
                            matches.push(match);
                        }
                        cb(); 
                    }                     
                })
            } else {
                Model.aggregate([
                    {$match: { $or: [{'family': famId}, {'externalFamily': famId}]}}
                ], (err, doc) => {
                    if (err) {
                        return cb(err); 
                    } else {
                        if (doc.length > 0){
                            let match = {
                                doc: doc
                            };
                            matches.push(match);
                        }
                        cb(); 
                    }                     
                })
            }   

        }, (err) => {
        if( err ) {
            return callback(err);
        } else {
            callback(null, matches);
        }
    });
}

exports.subfamilyRestrict = (id, callback) => {  //method called from controller
    var Utensil = require('../models/utensil');
    var Packaging = require('../models/packaging');  
    var Subproduct = require('../models/subproduct');
    var Dish = require('../models/dish');
    var Drinks = require('../models/drinks');
    var Product = require('../models/product');
    var Ingredient = require('../models/ingredient');
    var GastroOffer = require('../models/gastroOffer');
    var subfamId = new ObjectId(id);

    var Models = [Ingredient, Utensil, Packaging, Subproduct, Dish, Product, GastroOffer, Drinks];
    var matches = [];

    async.eachSeries(Models, (Model, cb) => {

        if (Model == GastroOffer) {

            Model.aggregate([
                {$unwind: {path: "$versions"}},
                {$match: { 'versions.composition.subfamily': subfamId }}
            ], (err, doc) => {
                if (err) {
                    return cb(err); 
                } else {
                    if (doc.length > 0){
                        let match = {
                            doc: doc
                        };
                        matches.push(match);
                    }
                    cb(); 
                }                     
            })
            

        } else {
            Model.aggregate([
                {$match: { $or: [{'subfamily': subfamId},{'externalSubfamily': subfamId}]}}
            ], (err, doc) => {
                if (err) {
                    cb(err); 
                } else {
                    if (doc.length > 0){
                        let match = {
                            doc: doc
                        };
                        matches.push(match);
                    }
                    cb(); 
                }                     
            })
            
        }        
    }, (err) => {
        if(err) {
            return callback(err);
        } else {
            callback(null, matches);
        }
    });
}   