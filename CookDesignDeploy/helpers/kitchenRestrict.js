/*

This helper checks referential integrity for families and subfamilies

*/
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var async = require('async');


exports.kitchenRestrict = (id, callback) => { //method called from pre-remove hook
    var Subproduct = require('../models/subproduct');
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var Product = require('../models/product');
    var kitId = new ObjectId(id);

    var Models = [Subproduct, Dish, Product, Drink];
    var matches = [];

    async.eachSeries(Models, (Model, cb) => {

            Model.aggregate([
                    {$match: {'kitchens.kitchen': kitId}}
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
             

        }, (err) => {
        if( err ) {
            return callback(err);
        } else {
            callback(null, matches);
        }
    });
}

exports.workRoomRestrict = (id, callback) => {  //method called from controller
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var Product = require('../models/product');
    var Subproduct = require('../models/subproduct');
    var workRoomId = new ObjectId(id);

    var Models = [Subproduct, Dish, Product, Drink];
    var matches = [];

    async.eachSeries(Models, (Model, cb) => {
        
            Model.aggregate([
                {$match: {'kitchens.workRoom': workRoomId}}
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
            
               
    }, (err) => {
        if(err) {
            return callback(err);
        } else {
            callback(null, matches);
        }
    });
}   