/*

This helper checks referential integrity for locations

*/


var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var async = require('async');

exports.locationRestrict = (id, callback) => { //method called from pre-remove hook
    var Subproduct = require('../models/subproduct');
    var GastroOffer = require('../models/gastroOffer');
    var Dish = require('../models/dish');
    var Product = require('../models/product');
    var Provider = require('../models/provider');
    var Location = require('../models/location');
    var locationId = new ObjectId(id);
    var locArray = [locationId]

    var Models = [Subproduct, Product, Dish, GastroOffer, Provider];
    var matches = [];

    waterfall([
        (cb) => { //Check whether location has any child locations (in case of organization or company)
            Location.findOne({
              $or: [{'parent_organization': locationId}, {'parent_company': locationId}]
            }, (err, doc) => {
              if (err) cb(err)
              if(doc) {
                let err = new Error("Location has child locations.");
                err.statusCode = 404;
                return cb(err)
              } else {
                cb(null, doc) //No child locations, move on to the next check step
              }
            })
    
        }, (doc, cb) =>   { //Now check whether location is being used 
            async.eachSeries(Models, (Model, cb) => { //iteration function, to jump to the next iteration call cb()
                Model.findOne({
                   'location': {$in: locArray},
                }, (err, doc) => {
                    if (err) { 
                        return cb(err); 
                    } else {
                        if (doc){
                            let match = {
                                doc: doc
                            };
                            matches.push(match);
                        }
                        cb(); 
                    }                     
                })
            }, (err) => { //function called when iteration finished
                if(err) return cb(err)
                cb(null, doc) //jump to waterfall final step
            });

        }], (err, doc) =>   {
          if(err) {
              return callback(err);
          } else {
              callback(null, matches);
          }
        })    
}