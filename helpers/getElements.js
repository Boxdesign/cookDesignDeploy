'use strict';

var Subproduct = require('../models/subproduct');
var Ingredient = require('../models/ingredient');

var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var mongoose = require('../node_modules/mongoose');
var fs = require('fs');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');

exports.getElements = (req, callback) => {  
	/* NOT USED */
}

 /* ------------------------------- GET SUBPRODUCTS FOR RECIPES -----------------------------------------------------------*/

exports.getSubproductsFilter = (req, callback) => {  

    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductElements;
    var subproducts;
    var ingredients;
    var filterLocation;    
    var filterLocationPipeline;
    var filterSubproduct;
    var subproductId;
    var utilsHelper = require('../helpers/utils')

    if (params.filterLocation) {
        filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
    } else {
        filterLocation = [];
    }

    filterLocationPipeline = {};
    if (filterLocation.length > 0) {
      let jsonObj = [];
      filterLocation.forEach((loc) => {
          let item = {}
          item["location"] = { "$in": [loc] };
          jsonObj.push(item);
      })
      filterLocationPipeline = { '$and': jsonObj };
    }

    if(params.subproductId){
    	subproductId = new ObjectId(params.subproductId);
    	filterSubproduct = {_id: {$ne: subproductId}}
    }
    else
    {
    	filterSubproduct={};
    }    

    waterfall([
        (cb) => { 
            //Get active subproducts within user's zone, in the user's language and filtered by name
            Subproduct.aggregate([
            {$match : {'active' : true }},
            {$match: filterSubproduct}, //Note: 1st level check for recursivity.
            {
                $unwind: {
                    path: "$versions",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: "$versions.lang",
                    preserveNullAndEmptyArrays: true
                }
            },
            {$match: {'versions.active' : true}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
            {$match: filterLocationPipeline },
            {$match: {'location': {$in: userLocIds}}} //Filter by user locations
            ], (err, docs) => {
             if (err) return cb(err)

             Subproduct.populate(docs, {path: "measurementUnit"}, (err, subDocs) => {
                if (err) return cb(err)
                cb(null, subDocs)
             });
         })


        },(subDocs, cb) => {

        		let recursiveSubDocs = [];

    				if(params.subproductId){ //Editing subproduct, filter out recursive subproducts

    						async.eachSeries(subDocs, (subDoc, cb_async) => {

	        				//ToDo: Check for n level of recursivity. Subproducts or suproducts of subproducts, etc. should not include in its composition the subproduct being edited (parent).
	        				utilsHelper.checkRecursiveLoopInSubproduct(subDoc._id, [subproductId], (err, doc) => {
				        		if(err) {
				        			recursiveSubDocs.push(subDoc)
				        		}
				        		cb_async()
	        				})
	    							
	    					}, (err) => {
	    						if(err) return cb(err)

	    						if(recursiveSubDocs.length) { //Filter out recursive subdocs
	    							subDocs = subDocs.filter((subDoc) => {
	    								let subDocId = new ObjectId(subDoc._id)
	    								return !recursiveSubDocs.some((recursiveSubDoc) => {
	    									let recursiveSubDocId = new ObjectId(recursiveSubDoc._id)
	    									return recursiveSubDocId.equals(subDocId)
	    								})
	    							})
	    						}
	    						cb(null, subDocs)
	    					})
        		}
        		else
        		{
            	cb(null, subDocs)
        		}

        },(subDocs, cb) => { //Update subDocs unitCost based on filterLocation

            costHelper.calculateAvgRecipeLocCostAndAllergens(subDocs, Subproduct, filterLocation);
            cb(null, subDocs)

        },(subDocs, cb) => {

            //Format subproducts
            subproducts = subDocs.map(function(doc) { 
              let object = {
                  'type': 'subproduct',
                  '_id': doc._id,
                  'name': doc.versions.lang.name,
                  'cost' : doc.versions.unitCost,
                  'measurementUnit': doc.measurementUnit,
                  'allergens': doc.versions.allergens
              }
              return object; 
            });

            subproducts.sort(compare);
            
            cb(null, subproducts);

        }], (err, ok) => {
            if(err) return callback(err)
            callback(null, ok)
  });

}


 /* ------------------------------- GET INGREDIENTS FOR RECIPES -----------------------------------------------------------*/

exports.getIngredientsFilter = (req, callback) => {  

    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductElements;
    var subproducts;
    var ingredients;
    var filterLocation;

    if (params.filterLocation) {
        filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
    } else {
        filterLocation = [];
    } 

    waterfall([
        (cb) => {

            //Get ingredients
            Ingredient.aggregate([
            {$match : {'active' : true }},
            {
                $unwind: {
                    path: "$lang",
                    preserveNullAndEmptyArrays: true
                }
            },
            {$match: {'lang.langCode': userProfile.user.language}},
            {$match: {'lang.name': {$regex: params.filterText, $options: 'i'}}}
            ], (err, docs) => {
               
               if (err) return cb(err)

               Ingredient.populate(docs, {path: "measurementUnit"}, (err, ingDocs) => {
                  if (err) return cb(err)
                  cb(null, ingDocs)
                });               
            })

        },( ingDocs, cb) => { //Update ingDocs referencePrice based on filterLocation
          if (filterLocation.length) {
            costHelper.calculateAvgArticleLocCostAndAllergens(ingDocs, filterLocation)             
          }            
          cb(null, ingDocs)            

        },(ingDocs, cb) => {

            ingredients = ingDocs.map(function(doc) {
              //Check whether the ingredient has an equivalence unit defined. If it does, add it.
              var object=[];
              if(doc.lang.equivalenceUnitName&&doc.equivalenceQty) {
                object = {
                    'type': 'ingredient',
                    '_id': doc._id,
                    'name': doc.lang.name,
                    'cost' : doc.referencePrice,
                    'measurementUnit': doc.measurementUnit,
                    'equivalenceUnit' : {
                        'name' : doc.lang.equivalenceUnitName,
                        'quantity' : doc.equivalenceQty
                    },
                    'allergens': doc.allergens
                }
              } else {
                  object = {
                      'type': 'ingredient',
                      '_id': doc._id,
                      'name': doc.lang.name,
                      'cost' : doc.referencePrice,
                      'measurementUnit': doc.measurementUnit,
                      'allergens': doc.allergens
                  }
              }
              return object; 
            });

            //Sort array of objects based on name. Uses the compare function below.
            ingredients.sort(compare);

            cb(null, ingredients);

        }], (err, ok) => {
            if(err) return callback(err)
            callback(null, ok)
  });

}

//Function used to sort array based on name
function compare(a,b) {
  if (a.name < b.name)
    return -1;
if (a.name > b.name)
    return 1;
return 0;
}