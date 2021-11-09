'use strict';
 
 var waterfall = require('async-waterfall');
 var locHelper = require('../helpers/locations');
 var elementsHelper = require('../helpers/getElements');
 var mongoose = require('../node_modules/mongoose');
 var fs = require('fs');
 var async = require('async');
 var Subproduct = require('../models/subproduct');
 var Template = require('../models/template');
 var Family = require('../models/family');
 var Ingredient = require('../models/ingredient');
 var Gallery = require('../models/gallery');
 var Allergen = require('../models/allergen');
 var Location = require('../models/location');
 var {ObjectId} = require('mongodb');
 var config = require('../config/config');
 var assert = require('assert');
 var cookingSteps= require ('../helpers/cookingSteps');
 var costHelper= require ('../helpers/cost');
 var allergenHelper = require('../helpers/allergen');
 var request = require('request')
 var Dish = require('../models/dish');
 var Drink = require('../models/drinks');
 var Product = require('../models/product');
 var Location = require('../models/location');
 var GastroOffer = require('../models/gastroOffer')
 var User = require('../models/user')
 var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator')
 var config = require('../config/config');
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.controllers;
 
 /**
 * @api {post} /subproduct Add new subproduct
 * @apiGroup {subproduct}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Subproduct-Creation:
 {	
	"family" : "57e245e373c49608114fd4c9",
	"subfamily" : "57e245f273c49608114fd4cb",
	"measurementUnit": "57b71c8eba4616bb4c682065",
	"location" : ["57e557b687ae842825ae6d22","57e5573f87ae842825ae6d1f", "57e53fabf9475a721f6e2c6f"],
	"gallery" : "57e5578487ae842825ae6d20",
    "active" : "true",
	"versions": [
		{
			"lang" :[
				{
					"langCode": "es",
					"name" : "Subproducto 22",
					"description" : "Descripción del subproducto 22"
				},
				{
					"langCode": "en",
					"name" : "Subproduct 22",
					"description" : "Description of subproduct 22"
				}
			],
			"active" : "true",
			"batchWeight" : "2.34",
			"composition" : null,
			"cookingSteps" : null
		}
	]
}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 **/ 

 exports.add = (req, res) => {
 	var account = req.userData;
 	var inSubproduct = req.body;
 	var subproductLocations = inSubproduct.location || null;
 	var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });

 	waterfall([
        (cb) => { //location check: each subproduct location should have at least one user location in its upper path. Each subproduct's location
        	// includes its upper path.

           if(subproductLocations!=null){

            	//Check whether list of subproduct locations includes at least one customer location.
            	var match = subproductLocations.find((id) => {
                    let locId = new ObjectId(id);
            		for(var i=0; i<userLocIds.length; i++) {
            			if (userLocIds[i].equals(locId)) return true;
            		}
            	});

            	if (match) { cb(null, match); }
            	else { 
                    var err = new Error('Access to subproduct location is not allowed');
                    err.statusCode=400;
                    return cb(err);
                }
            } 
            else {
                let error = new Error('Must specify a valid location');
                err.statusCode=400;
                return cb(err)
            }
        }, (doc, cb) => {
            inSubproduct.versions.last_account = account._id;
            inSubproduct.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.subproduct)
            var subproduct = new Subproduct(inSubproduct);
            //console.log(subproduct,'subproduct')
            subproduct.save((err) => {
                if (err) return cb(err)
                cb(null, subproduct);
            });
        }], (err, ok) => {		
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();  	

        })
 }

 /**
 * @api {post} /subproduct Add new subproduct version
 * @apiGroup {subproduct}
 * @apiName Add new verion
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Subproduct-Creation:
 * {
	"_id": "57ea7dfe991de2ce2d211fc3",
	"versions": [
		{
			"lang" :[
				{
					"langCode": "es",
					"name" : "Subproducto 1",
					"description" : "Descripción del subproducto 22"
				},
				{
					"langCode": "en",
					"name" : "Subproduct 1",
					"description" : "Description of subproduct 22"
				}
			],
			"active" : "false",
			"batchWeight" : "10.45",
			"composition" : null,
			"cookingSteps" : null
		}
	]
}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.addVersion = (req, res) => {
    //console.log(req,'req')
 	var account = req.userData;
 	var inSubproduct = req.body;
 	var subproductLocations;
 	var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
  var sortField = 'updatedAt';
  var sortOrder = 1;
  var activeVersion;
  var locationWarning = false;
  var Model;
 	var Subproduct = require('../models/subproduct');  

 	waterfall([
        (cb) => { //Verify maximum number of versions
            
            Subproduct.findById(inSubproduct._id, (err, doc) => {
                if (err) cb(err);
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }
                if (doc.versions.length >= config.maxNumVersionsRecipes) {
                    doc.versions.sort(function(a,b) {return (a[sortField] > b[sortField]) ? sortOrder : ((b[sortField] > a[sortField]) ? -sortOrder : 0);} ).shift();
                }
                cb (null, doc)
            })

        }, (doc, cb) => {
          //location check: each subproduct location should have at least one user location in its upper path. Each subproduct's location
        	// also includes its upper path.

          subproductLocations=doc.location;
    		  //Check whether list of subproduct locations includes at least one customer location.
   		
    			var match = subproductLocations.find((id) => {
                    let locId = new ObjectId(id);
    				for(var i=0; i<userLocIds.length; i++) {
    					if (userLocIds[i].equals(locId)) return true;
    				}
    			});

    			if (match) { cb(null, doc); }
    			else { 
              var err = new Error('Access to subproduct location is not allowed');
              err.statusCode=400;
              return cb(err);
          }

        }, (doc, cb) => {

            //Update previous active version to not active
            doc.versions.forEach(function (version) {
                if(version.active==true) version.active=false;
            })

            inSubproduct.version.last_account = account._id;

        	 //console.log(inSubproduct,'inSubproduct');
        	 //cb(null, inSubproduct);

            doc.measurementUnit=inSubproduct.measurementUnit;
            doc.family=inSubproduct.family;
            doc.subfamily=inSubproduct.subfamily;
            doc.active=inSubproduct.active;
            doc.location=inSubproduct.location;
            doc.kitchens = inSubproduct.kitchens;
            doc.caducityFresh = inSubproduct.caducityFresh;
            doc.caducityFreeze = inSubproduct.caducityFreeze;
            doc.daysToUse = inSubproduct.daysToUse;
            
            cb(null, doc)

        }, (doc, cb) => {

        		logger.info('Subproduct Controller - add Version - Recalculate subproduct location costs and reference cost for locations %j', inSubproduct.location)

            //Calculate subproduct composition reference and location cost for aggregate locations in composition list
            costHelper.calculateRecipeCompLocationCosts(inSubproduct.version, inSubproduct.location, Subproduct, (err, res) => {
                if(err) return cb(err)

		            logger.info('Subproduct Controller - add Version - Recalculated subproduct location costs and reference cost %j', res);
                inSubproduct.version.locationCost = res.locationCost;
                inSubproduct.version.unitCost = res.unitCost;

                cb(null, doc)
            })    

		    }, (doc, cb) => {

		        allergenHelper.calculateRecipeLocationAllergens(inSubproduct.version, inSubproduct.location, (err, res) => {
		            if (err) return cb(err)

		            logger.info('Subproduct Controller - add Version - Recalculated subproduct reference allergens and location allergens %j', res);
		            inSubproduct.version.locationAllergens = res.locationAllergens;
		            inSubproduct.version.allergens = res.referenceAllergens;

		            cb(null, doc)
		        })

        }, (doc, cb) => {

            doc.versions.push(inSubproduct.version);
            let locationWarning = false;

            doc.save(function (err, savedDoc) {
            	if(err) return cb(err)
            	cb(null, savedDoc)
            })

		    }, (savedDoc, cb) => { //Populate composition elements

		         activeVersion = savedDoc.versions.find(function (version) {
		            return version.active==true;
		         })

		    		if(activeVersion)
		    		{
			        //Populate subproduct composition elements
			        async.eachSeries(activeVersion.composition, (compElement, cb_async) => {

			          if(compElement.element.kind == 'subproduct') 
			          { 	            
					          Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
					            if (err) return cb_async(err)
					            cb_async();
					          });
					       }
					       else
					       {
					       	process.nextTick(()=> cb_async())
					       }

			        }, (err) => { //finished async loop
			        	if(err) return cb(err)
			        	logger.info('Populated subproduct composition items.')
			          cb(null, savedDoc);
			          //console.log(doc,'docGOgetVersion')
			        });

				    }
				    else
				    {
				    	logger.error('Could not find active version of subproduct.')
				     	cb(null, savedDoc)
				    }

		    	}, (savedDoc, cb) => { //Check all composition element's location include the gastro offer's locations

		    		if(activeVersion)
		    		{
			    		activeVersion.composition.forEach((compElement) => {

			    			if(compElement.element.item && compElement.element.kind == 'subproduct') {
				    			let included = savedDoc.location.every((l1) => {
				    				let loc1 = new ObjectId(l1);
				  				 	return compElement.element.item.location.some((l2) => {
				  				 		let loc2 = new ObjectId(l2)
				  				 		return loc2.equals(loc1)
				  				 	})
				    			})
				    			if(!included) locationWarning = true;
				    		}
			    		})
		      		cb(null, savedDoc)
				    }
				    else
				    {
				     	cb(null, savedDoc)
				    }	

				 }, (savedDoc, cb) => {

           let res = {
             id: savedDoc._id,
             activeVersionId: activeVersion._id,
             locationWarning: locationWarning
           }

           cb(null, res)

        }], (err, ok) => {	
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
 }

/**
 * @api {delete} /subproduct Delete subproduct
 * @apiGroup {subproduct}
 * @apiName Delete Subproduct
 *
 * @apiDescription Delete a subproduct
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 *
 * @apiSuccess {Object} Subproduct removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.remove = (req, res) => {
 	let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the subproduct's locations      

        if(mongoose.Types.ObjectId.isValid(params._id)) {  
            Subproduct.findById(subproductId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }
                //Check whether list of subproduct locations includes at least one customer location.
                subproductLocations=doc.location;
                
                var match = subproductLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });

                if (match) { cb(null, doc); }
                else { 
                    var err = new Error('Access to subproduct location is not allowed');
                    err.statusCode=400;
                    return cb(err);
                }
            })
        } else {
            var err = new Error('Invalid Object Id');
            err.statusCode=400;
            return cb(err)
        }        
    }, (doc, cb) => {
        //remove subproduct
        doc.remove(function (err, doc) {
            if (err) return cb(err)
            cb(null, doc);
         });
    }], (err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
    })
}

 /**
 * @api {delete} /subproduct/version Delete subproduct version
 * @apiGroup {subproduct}
 * @apiName Get Subproduct
 *
 * @apiDescription Delete a subproduct version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 * @apiParam {string} _versionId  Subproduct version id
 *
 * @apiSuccess {Object} Subproduct version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.removeVersion = (req, res) => {
    //Can't delete an active version
    //Can't delete if there is only one version left
    //Can't delete if the subproduct is not within the user's location zone
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //Verify subproduct exists

            if(mongoose.Types.ObjectId.isValid(params._id) && mongoose.Types.ObjectId.isValid(params._versionId)) {  
                Subproduct.findById(subproductId, (err, doc) => {
                    if (err) return cb(err);
                    if (!doc) {
                        let err=new Error("Document not found");
                        err.statusCode=404;
                        return cb(err)
                    }
                    cb(null, doc)
                })
            } else {
                let err=new Error("ObjectId not valid");
                err.statusCode=400;
                return cb(err)
            }
        }, (doc, cb) => {//Verify there are at least 2 versions

            if(doc.versions.length < 2) {
                let err=new Error("It is not possible to remove the only version of the subproduct");
                err.statusCode=400;
                return cb(err)
            } else  {
                cb(null, doc);
            }

        }, (doc, cb) => { //location check. Verify that at least one user location is within the subproduct's locations

                //Check whether list of subproduct locations includes at least one customer location.
                subproductLocations=doc.location;
                
                var match = subproductLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });

                if (match) { cb(null, doc); }
                else { 
                    var err = new Error('Access to subproduct location is not allowed');
                    err.statusCode=400;
                    return cb(err);
                }

        }, (doc, cb) => {

            //remove version
            for(var i = 0; i < doc.versions.length; i++) {
                let obj = doc.versions[i];
                let id = new ObjectId(obj._id)
                if(id.equals(versionId)) {
                    doc.versions.splice(i, 1);
                }
            }

            doc.save(function (err) {
                 if (err) return cb(err)
                 cb(null, doc);
            });
        }
        ], (err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
}

 /**
 * @api {put} /subproduct/version Set version as active
 * @apiGroup {subproduct}
 * @apiName Set As Active
 *
 * @apiDescription Set a subproduct version as active
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 * @apiParam {string} _versionId  Subproduct version id
 *
 * @apiSuccess {Object} Subproduct active version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.setAsActiveVersion = (req, res) => {
  //sets subproduct version as active
    //Location check
    //Must make the previous version not active
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 
    let activeSubproductVersion;
    var MeasUnit = require('../models/measurementUnit')
    var Subroduct = require('../models/subproduct');



    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the subproduct's locations
        
        logger.info('setAsActiveVersion')
        if(mongoose.Types.ObjectId.isValid(subproductId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Subproduct.findById(subproductId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                subproductLocations=doc.location;
                //Check whether list of subproduct locations includes at least one customer location.
                
                var match = subproductLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });
                if (match) { cb(null, doc); }
                else { 
                    var err = new Error('Access to subproduct location is not allowed');
                    err.statusCode=400;
                    return cb(err);
                }
            });
        } else {
            let err=new Error("ObjectId not valid");
            err.statusCode=400;
            return cb(err)
        }
    }, (doc, cb) => {
        //Update previous active version to not active
        doc.versions.forEach(function (version) {
            if(version.active==true) version.active=false;
        })

        //Update version to active
        doc.versions.forEach(function (version) {
            let id = new ObjectId(version._id)
            if(id.equals(versionId)) {
              version.active=true;
              activeSubproductVersion = version;
            }
        })
        cb(null, doc);
            
    }, (doc, cb) => {
        
		    //Filter ingredient or subproduct lang field based on user language
		    async.each(activeSubproductVersion.composition, function(compElement, cb_async) {
		    if(compElement.element.kind == 'subproduct') { //composition element is a subproduct
		      Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
		        if (err) return cb(err)
		          if(compElement.element.item != null) {
		            //Filter active version
		            let activeVersion = compElement.element.item.versions.filter((version) => {
		              return version.active==true;
		            })
		            if(activeVersion.length) {
		              compElement.element.item.versions = activeVersion;
		              //Store location of subproduct
		              //console.log(compElement, 'compElement')
		              compElement.location = compElement.element.item.location;
		              //Update unit cost and locationCost of product
		              compElement.unitCost = compElement.element.item.versions[0].unitCost;
		              if(compElement.element.item.versions[0].locationCost) { 
		                compElement.locationCost = compElement.element.item.versions[0].locationCost;
		              } else  {
		                compElement.locationCost = [];
		              }
		              let baseUnit = new ObjectId(compElement.baseUnit);
		              let measurementUnit = new ObjectId(compElement.element.item.measurementUnit);

		              if(!baseUnit.equals(measurementUnit)){ 
		                  compElement.measuringUnit = compElement.element.item.measurementUnit
		                  compElement.baseUnit = compElement.element.item.measurementUnit

		                  MeasUnit.findById(measurementUnit, (err, doc) => {
		                    if(err) return cb(err)
		                    compElement.measuringUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
		                    compElement.baseUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
		                                                               // and the request can't be accessed from a Mongoose hook
		                    logger.info('Retrieved new measurement unit short name')
		                    cb_async()
		                  })
		                } else {
		                  cb_async()
		                }

		            } else {
		              logger.error('Could not retrive active version of product in recipe composition. Subproduct id: %s', productId, ' and version id: ', versionId);
		              cb_async()
		            }
		          } else {
		            logger.error('Could not populate subproduct in product recipe. Subproduct id: %s', productId, ' and version id: ', versionId);
		            cb_async()
		          }
		        });
		        } else { //composition element is an ingredient

		          Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
		            if(err) return cb(err)
		            if(compElement.element.item != null) {
		            //Udpdate unit cost and locationCost of ingredient
		            compElement.unitCost = compElement.element.item.referencePrice;

		            if(compElement.element.item.locationCost) { 
		              compElement.locationCost = compElement.element.item.locationCost; 
		            } else {
		              compElement.locationCost = [];
		            }

		            let baseUnit = new ObjectId(compElement.baseUnit);
		            let measurementUnit = new ObjectId(compElement.element.item.measurementUnit);

		            if(!baseUnit.equals(measurementUnit)){ 
		                compElement.measuringUnit = compElement.element.item.measurementUnit
		                compElement.baseUnit = compElement.element.item.measurementUnit

		                MeasUnit.findById(measurementUnit, (err, doc) => {
		                  if(err) return cb(err)
		                  compElement.measuringUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
		                  compElement.baseUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
		                                                             // and the request can't be accessed from a Mongoose hook
		                  logger.info('Retrieved new measurement unit short name')
		                  cb_async()
		                })
		              } else {
		                cb_async()
		              }

		          } else {
		            logger.error('Could not populate ingredient in product recipe. Subproduct id: %s', productId, ' and version id: ', versionId)
		            cb_async();
		          }
		        }); 
		      }
		    }, (err) => { //finished async loop
		        cb(null, doc);
		      });
    }, (doc, cb) => {
    //Filter ingredient or subproduct lang field based on user language
      activeSubproductVersion.composition.forEach((compElement)=> {
          compElement.element.item = compElement.element.item? compElement.element.item._id : null;

      })
      cb (null, doc)
    }, (doc, cb) => {
        //Calculate product composition reference and location cost for aggregate locations in composition list
        //console.log(activeSubproductVersion,'activeSubproductVersion')
        costHelper.calculateRecipeCompLocationCosts(activeSubproductVersion, subproductLocations, Subproduct, (err, res) => {
          if(err) return cb(err)
          activeSubproductVersion.locationCost = res.locationCost;
          activeSubproductVersion.unitCost = res.unitCost;

          logger.info('Subproduct Controller - add Version - Calculated product composition reference and location cost for aggregate locations in composition list.')
          logger.info({'Subproduct Controller - add Version - locationCost': res.locationCost})
          logger.info({'Subproduct Controller - add Version - unitCost': res.unitCost})

          cb(null, doc)
        })  

    }, (doc, cb) => {

        allergenHelper.calculateRecipeLocationAllergens(activeSubproductVersion, subproductLocations, (err, res) => {
            if (err) return cb(err)

            activeSubproductVersion.locationAllergens = res.locationAllergens;
            activeSubproductVersion.allergens = res.referenceAllergens;
            logger.info('Subproduct Controller - add Version - Recalculated subproduct reference allergens and location allergens');

            cb(null, doc)
        })

    }, (doc, cb) => {
       //save doc
      doc.save(function (err) {
           if (err) return cb(err);
           cb(null, doc);
      });        
    }], (err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })

}

/**
 * @api {get} /subproduct Get all subproducts within the user's locations with pagination and filter
 * @apiGroup {subproduct}
 * @apiName Get All
 *
 * @apiDescription Get all families in a category with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {int} perPage  Records per page.
 *  @apiParam {int} page  Page number.
 *  @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 *  @apiParam {string} filterText  Text to filter (in name field).
 *  @apiParam {string} location  Array of location id to filter.
 *  @apiParam {string} family  Family id to filter.
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.getAll = (req, res) => {
 	//Gets the active version of all subproducts that are in the user's zone.
 	let userProfile = req.userData;
 	let params = req.query;
 	var filterText = params.filterText || '';
  var sortField = params.sortField || 'versions.lang.name';
  var sortOrder = Number(params.sortOrder) || 1;
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var filterLocation;
  var filterFamilyPipeline;
  var filterLocationPipeline;
  var activePipeline;
 	var addModal = false;

 	if(params.addModal && params.addModal == 'true') addModal = true;

 	waterfall([
 		
    (cb) => { 

        if (params.filterLocation) {
            filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
        } else {
            filterLocation = [];
        } 

        activePipeline={}
        if (params.active)  {
        	if(params.active == 'true') activePipeline =  { active: true }
        	else if (params.active == 'false') activePipeline =  { active: false }
        }           

        //If an array of filter locations if provided, build the filter location pipeline
        filterLocationPipeline = {};
        if (filterLocation.length > 0) {
            filterLocationPipeline = {'location': {$in: filterLocation}}
        }

        //If a family id is provided for filtering, build the filter family pipeline.
   			filterFamilyPipeline = {};
   			if (mongoose.Types.ObjectId.isValid(params.family)) {
   				filterFamilyPipeline = {'family': new ObjectId(params.family)}
   			}

   			Subproduct.aggregate([
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
        { // Alternative to populate to use filters on aggregate
          "$lookup": {
              "from": "families",
              "localField": "family",
              "foreignField": "_id",
              "as": "family"
          }
        },
        { 
        	 $unwind: 
        	  {
        	  	path: "$family",
        	  	preserveNullAndEmptyArrays: true
        	  }
        },
        {$match: activePipeline},
   			{$match: {'versions.active' : true}},
   			{$match: {'versions.lang.langCode': userProfile.user.language}},
   			{$match: {'location': {$in: userLocIds}}},
        {$match: filterLocationPipeline},
   			{$match: filterFamilyPipeline},
        {$match: {
          $or: [
            {'versions.lang.name': {$regex: filterText, $options: 'i'} },
            {'versions.batchWeight': {$regex: filterText, $options: 'i'} },
            {'versions.unitCost': {$regex: filterText, $options: 'i'} },
            {'family.lang.name': {$regex: filterText, $options: 'i'} }
          ]
        }},
        {$sort: { [sortField] : sortOrder }},
        {$skip: Number(params.perPage)*Number(params.page)},
        {$limit: Number(params.perPage)}
        ], (err, docs) => {
         	if (err) {
         		return cb(err)
         	}
            Subproduct.populate(docs, {path: "measurementUnit versions.gallery location"}, (err, docs) => {
                if (err) return cb(err)
                cb(null, docs)
            });
        })

    },(docs, cb) => { //Create location text list

      let locationList;

      docs.forEach((subproduct) => { 

        locationList = '';

        subproduct.location.forEach((loc, index) => {

          if (index < subproduct.location.length -1 )
              locationList = locationList + loc.name + ', '
          else 
            locationList = locationList + loc.name
        })
        subproduct.locationList = locationList;
      })

      cb(null, docs)

    },(docs, cb) => { //Map location array back to _ids

        docs.forEach((subproduct) => {
          subproduct.location = subproduct.location.map((loc) => {
            return loc._id;
          })
        })

        cb(null, docs)

    },(docs, cb) => { //Update average location cost based on filterLocation

    		if(addModal) costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Subproduct, filterLocation); 
    		else costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Subproduct);
    		
        cb(null, docs)        

    },(docs, cb) => {
            
        //Get total number of elements for pagination           
        Subproduct.aggregate([
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
        { // Alternative to populate to use filters on aggregate
          "$lookup": {
              "from": "families",
              "localField": "family",
              "foreignField": "_id",
              "as": "family"
          }
        },
        { 
        	 $unwind: 
        	  {
        	  	path: "$family",
        	  	preserveNullAndEmptyArrays: true
        	  }
        },
        {$match: activePipeline},
        {$match: {'versions.active' : true}},
        {$match: {'versions.lang.langCode': userProfile.user.language}},
        {$match: {'location': {$in: userLocIds}}},
        {$match: filterLocationPipeline},
        {$match: filterFamilyPipeline},
        {$match: {
          $or: [
            {'versions.lang.name': {$regex: filterText, $options: 'i'} },
            {'versions.batchWeight': {$regex: filterText, $options: 'i'} },
            {'versions.unitCost': {$regex: filterText, $options: 'i'} },
            {'family.lang.name': {$regex: filterText, $options: 'i'} }
          ]
        }},
        {$project:{"_id":1}} //return only _id
         ], (err, res) => {
          if (err) return cb(err)            

        	let subproducts = {
        		'subproducts': docs,
        		'totalElements': res.length
        	};

        	cb(null, subproducts)

        })

    }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
    });
 };

 /**
 * @api {get} /subproduct/lang Get user lang field of subproduct version
 * @apiGroup {subproduct}
 * @apiName Get Subproduct user lang
 *
 * @apiDescription Get user lang of product version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 * @apiParam {string} versionId  Product version id
 *
 * @apiSuccess {Object} Subproduct user lang
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getUserLang = (req, res) => {
    //Todo: update all composition elements name in case name has changed
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the subproduct's locations
        
        if(mongoose.Types.ObjectId.isValid(subproductId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Subproduct.findById(subproductId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                subproductLocations=doc.location;
                //Check whether list of subproduct locations includes at least one customer location.
                
                var match = subproductLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });
                if (match) { cb(null, match); }
                else { 
                    var err = new Error('Access to subproduct location is not allowed');
                    err.statusCode=400;
                    return cb(err); 
                }
            });
        } else {
            let err=new Error("ObjectId not valid");
            err.statusCode=400;
            return cb(err)
        }

    }, (doc, cb) => {
        Subproduct.aggregate([
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
        {$match: {'_id' : subproductId}},
        {$match: {'versions._id' : versionId}},
        {$match: {'versions.lang.langCode': userProfile.user.language}},
         ], (err, doc) => {
            if (err) return cb(err)

            let userLangObj ={
                userLang: doc[0].versions.lang
            }
            cb(null, userLangObj);
        })
    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};

/**
 * @api {get} /subproduct/version/cooksteps Get cooking steps of subproduct version
 * @apiGroup {subproduct}
 * @apiName Get Subproduct
 *
 * @apiDescription Get a subproduct version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 * @apiParam {string} versionId  Subproduct version id
 *
 * @apiSuccess {Object} Subproduct version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getCookingSteps = (req, res) => {
    //Gets the active version of all subproducts that are in the user's zone.
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the subproduct's locations
        
        if(mongoose.Types.ObjectId.isValid(subproductId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Subproduct.findById(subproductId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                subproductLocations=doc.location;
                    //Check whether list of subproduct locations includes at least one customer location.
                    
                    var match = subproductLocations.find((id) => {
                        let locId = new ObjectId(id);
                        for(var i=0; i<userLocIds.length; i++) {
                            if (userLocIds[i].equals(locId)) return true;
                        }
                    });
                    if (match) { cb(null, match); }
                    else { 
                        var err = new Error('Access to subproduct location is not allowed');
                        err.statusCode=400;
                        return cb(err); 
                    }
                });
        } else {
            let err=new Error("ObjectId not valid");
            err.statusCode=400;
            return cb(err);
        }

    }, (doc, cb) => {
        cookingSteps.getCookSteps(subproductId, versionId, Subproduct, userProfile, (err, doc)=>{
                if (err) return cb(err);
                cb(null,doc);
        })
    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};

/**
 * @api {get} /subproduct/version Get subproduct version
 * @apiGroup {subproduct}
 * @apiName Get Subproduct
 *
 * @apiDescription Get a subproduct version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 * @apiParam {string} versionId  Subproduct version id
 *
 * @apiSuccess {Object} Subproduct version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getVersion = (req, res) => {
    //Todo: update all composition elements name in case name has changed
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductLocations;
    var subproductId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 
    var Ingredient = require('../models/ingredient');
    var Subproduct = require('../models/subproduct');
    var Model;    

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the subproduct's locations
        
        if(mongoose.Types.ObjectId.isValid(subproductId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Subproduct.findById(subproductId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                subproductLocations=doc.location;
                //Check whether list of subproduct locations includes at least one customer location.
                
                var match = subproductLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });
                if (match) { cb(null, match); }
                else { 
                    var err = new Error('Access to subproduct location is not allowed');
                    err.statusCode=400;
                    return cb(err); 
                }
            });
        } else {
            let err=new Error("ObjectId not valid");
            err.statusCode=400;
            return cb(err)
        }

    }, (doc, cb) => {
        
        Subproduct.aggregate([
        {
            $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true
            }
        },
        {$match: {'_id' : subproductId}},
        {$match: {'versions._id' : versionId}}
        ], (err, doc) => {
            if (err) {
                return cb(err)
            }
            Subproduct.populate(doc, 
                {path: "versions.gallery measurementUnit kitchens.kitchen versions.cookingSteps.process versions.cookingSteps.utensil versions.cookingSteps.gastroCheckpoint versions.cookingSteps.criticalCheckpoint versions.cookingSteps.images"
                 //,match: {'versions.cookingSteps.lang.langCode': userProfile.user.language}
             }, (err, doc) => {
                if (err) {
                    return cb(err)
                }
                cb(null, doc)
            });
        })

    }, (doc, cb) => {

        //Filter ingredient or subproduct lang field based on user language and update unitCost and locationCost array
        logger.info('Subproduct Controller - getVersion - Filter ingredient or subproduct lang field based on user language and update unitCost and locationCost array in composition list')

        async.eachSeries(doc[0].versions.composition, function(compElement, cb_async) {

          if(compElement.element.kind == 'subproduct') { //composition element is a subproduct

            Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
              if (err) return cb(err)

              if(compElement.element.item != null) {

                //Filter active version
                let activeVersion = compElement.element.item.versions.filter((version) => {
                  return version.active==true;
                })

                if(activeVersion.length) {

		                compElement.element.item.versions = activeVersion;
                    compElement.active = compElement.element.item.active;

		                //Store location of subproduct
		                compElement.location = compElement.element.item.location;

		                //Udpdate unit cost and locationCost of subproduct
		                compElement.unitCost = compElement.element.item.versions[0].unitCost;

		                if(compElement.element.item.versions[0].locationCost) { 
		                  compElement.locationCost = compElement.element.item.versions[0].locationCost;
		                } else  {
		                  compElement.locationCost = [];
		                }

		                compElement.allergens = compElement.element.item.allergens;

                    if(compElement.element.item.versions[0].locationAllergens) { 
                      compElement.locationAllergens = compElement.element.item.versions[0].locationAllergens;
                    } else  {
                      compElement.locationAllergens = [];
                    }

		                //Update composition element unitCost with average location cost based on filterLocation
		                costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc[0].location, Subproduct);

		                //Filter user language
		                let userLang=[];

		                userLang = compElement.element.item.versions[0].lang.filter((langItem) => {
		                  return langItem.langCode==userProfile.user.language;
		                })

		                if(userLang.length) {
		                  //The client assumes item is not populated. Must de-populate it.
		                  compElement.element.item = compElement.element.item._id;
		                  compElement.name = userLang[0].name;
		                }
		           } else {
          				logger.error('Could not retrive active version of dish in recipe composition. Subproduct id: %s', subproductId, ' and version id: ', versionId);
          				let err= new Error('Could not retrive active version of dish in recipe composition')
          				return cb_async(err)		           	
		           }


              } else {
              	compElement.itemNull = true;
              	logger.error('Could not populate subproduct in subproduct recipe. Subproduct id: %s', subproductId, ' and version id: ', versionId);
              	let err = new Error('Could not populate subproduct in subproduct recipe')
              	return cb_async(err)
              }

              cb_async();
            });

          } else { //composition element is an ingredient

            Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
              if (err) return cb(err)

              if(compElement.element.item != null) {
                  compElement.active = compElement.element.item.active;
                  //Udpdate unit cost and locationCost of ingredient
	              compElement.unitCost = compElement.element.item.referencePrice;
	              if(compElement.element.item.locationCost) { 
	                compElement.locationCost = compElement.element.item.locationCost; 
	              } else {
	                compElement.locationCost = [];
	              }

                compElement.allergens = compElement.element.item.allergens;

                if(compElement.element.item.locationAllergens) { 
                  compElement.locationAllergens = compElement.element.item.locationAllergens; 
                } else {
                  compElement.locationAllergens = [];
                }

	              //Update composition element unitCost with average location cost based on filterLocation
	              costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc[0].location, Ingredient);

	              //Filter user language
	              let userLang=[];

	              userLang = compElement.element.item.lang.filter((langItem) => {
	                return langItem.langCode==userProfile.user.language;
	              })

	              if(userLang.length) {
	                //The client assumes item is not populated. Must de-populate it.
	                compElement.element.item = compElement.element.item._id;
	                compElement.name = userLang[0].name;
	              }
	              
              } else {
              	compElement.itemNull = true;
              	logger.error('Could not populate ingredient in subproduct recipe. Dish id: %s', subproductId, ' and version id: ', versionId)
              }

              cb_async();
            }); 
          }       

        }, (err) => { //finished async loop
          cb(null, doc);
        });

    }, (doc, cb) => { //Check all composition element's location include the gastro offer location

    		doc[0].versions.composition.forEach((compElement) => {

    			if(compElement.element.item != null && compElement.element.kind == 'subproduct') {

	    			let included = doc[0].location.every((l1) => {
	    				let loc1 = new ObjectId(l1);
	  				 	return compElement.location.some((l2) => {
	  				 		let loc2 = new ObjectId(l2)
	  				 		return loc2.equals(loc1)
	  				 	})
	    			})

	    			if(!included) compElement.locationWarning = true;
	    			else compElement.locationWarning = false;

	    		}
	    		else
	    		{
	    			compElement.locationWarning = false;
	    		}
    		})

    		cb(null, doc)

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};


/**
 * @api {get} /subproduct/versions Get all subproduct's versions
 * @apiGroup {subproduct}
 * @apiName Get Subproduct Versions
 *
 * @apiDescription Get all subproduct's versions
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 *
 * @apiSuccess {Object} Subproduct version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.getAllVersions = (req, res) => {
    //Gets the active version of all subproducts that are in the user's zone.
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var subproductId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var filterLocation;

    waterfall([
        (cb) => { 

            if (params.filterLocation) {
                  filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
              } else {
                  filterLocation = [];
              }

            params.sort = {'versions.updatedAt': -1};

            Subproduct.aggregate([
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
            {$match: {'_id' : subproductId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
            {$sort: params.sort},
            {$skip: Number(params.perPage)*Number(params.page)},
            {$limit: Number(params.perPage)}
            ], (err, docs) => {
                if (err) {
                    return cb(err)
                }
                Subproduct.populate(docs, {path: "measurementUnit kitchens.kitchen versions.gallery versions.last_account"}, (err, docs) => {
                    //console.log(docs , 'docs')
                    if (err) {
                        return cb(err)
                    }
                    cb(null, docs)
                });
            })

        },(docs, cb) => { //Populate user in last_account

        		User.populate(docs, {path: 'versions.last_account.user'}, (err, docs) => {
        			if(err) return cb(err)
        			cb(null, docs)
        		})            

        },(docs, cb) => { //Update average location cost based on filterLocation

          costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Subproduct);
        	cb(null, docs) 

        },(docs, cb) => {
            //Get total number of elements for pagination
            Subproduct.aggregate([
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
            {$match: {'_id' : subproductId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
            {$project: {_id: 1}}
            ], (err, docsCount) => {
                if (err) {
                    return cb(err)
                }

                let length = docsCount.length;

                let versions = {
                  'versions': docs,
                  'totalElements': length
              };

              cb(null, versions)
          })

            
        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
  });
};

/**
 * @api {get} /subproduct/elements Gets ordered list of ingredients and subproducts
 * @apiGroup {subproduct}
 * @apiName Get Subproduct's Elements
 *
 * @apiDescription Gets ordered list of ingredients and subproducts that can be included in a subproduct recipe
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.getElements = (req, res) => {

    elementsHelper.getElements(req, (err, doc) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(doc).end();      
    })
};
 exports.getIngredientsFilter = (req, res) => {

    elementsHelper.getIngredientsFilter(req, (err, doc) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(doc).end();      
    })
};
 exports.getSubproductsFilter = (req, res) => {
 
    elementsHelper.getSubproductsFilter(req, (err, doc) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(doc).end();      
    })
};

/**
 * @api {get} /subproduct/duplicate Duplicates subproduct
 * @apiGroup {subproduct}
 * @apiName Duplicates active version of subproduct
 *
 * @apiDescription Duplicates active version of subproduct
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  subproduct id to be duplicated
 * @apiParam {string} name  New subproduct name (in user's language)
 * @apiParam {string} location  Location for new subproduct
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.duplicate = (req , res) => {
    let userProfile = req.userData;
    let params = req.query;
    var subproductId = new ObjectId(params._id);
    var updateSubproductsLocation = params.updateSubproductsLocation;
    var updateSubproductsLocationFlag=false;
    if(updateSubproductsLocation == 'true') updateSubproductsLocationFlag=true
    var account = req.userData;
    var costHelper = require('../helpers/cost');
    var activeVersion;
    let newGallery;
    
    var AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;

    waterfall([
        (cb) => { //Get active version of subproduct to be duplicated, without _id

        if(mongoose.Types.ObjectId.isValid(subproductId)) {  

          Subproduct.findOne(
            {
              _id: subproductId
            },
            {
              _id: 0, 
              active: 1, 
              family: 1, 
              subfamily: 1, 
              measurementUnit: 1,  
              location: 1,
              versions: {$elemMatch: {active: true}}
            }
          )
          .exec((err, doc) => {
            if (err) return cb(err)
            cb(null, doc)
          })

        } else {
          let err = new Error("Must provide a valid Subproduct id")
          err.statusCode = 402
          return cb(err)
        }

      }, (doc, cb) => {

          //Must convert doc to JSON otherwise mongo throws error
        doc = doc.toJSON();

        activeVersion = doc.versions[0];

        if(activeVersion.gallery){
            
            Gallery.findById(activeVersion.gallery, (err, gallery) => {
                if (err) return cb(err)
                if (!gallery) {
                    let err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err)
                }

                newGallery = new Gallery({
                    originalName: gallery.originalName,
                    sizes: gallery.sizes
                })    
                
                cb(null, doc)

            })            
          } else {
            cb (null, doc)
          }
      }, (doc, cb) => {  

        if(!newGallery) return cb(null, doc)

        let sizes = [];
        //Generate number to save new gallery
        let random_name = referenceNumberGeneratorHelper.generateReferenceNumber('')        

        async.eachSeries(newGallery.sizes, (size, cb_async) => {
        
            let extension = size.url.split('.').pop()
            let key = 'imgs/subproduct/' + random_name + '-' + size.sizeCode + '.' + extension
            let s3Url = 'https://s3-' + config.awsBucket.region + '.amazonaws.com/'
            let url = s3Url + config.awsBucket.bucketName + '/' + key

            var params = {
                Bucket: config.awsBucket.bucketName,
                CopySource: size.url,
                Key: key,
                ACL: 'public-read'

          };
          var s3 = new AWS.S3;

          s3.copyObject(params, function(err, data) {
            if (err) return cb_async(err);            
            sizes.push({
                sizeCode: size.sizeCode,
                url: url
            });            
            cb_async();
          });

        }, (err) => {
            newGallery.sizes = sizes;

            if(err) return cb(err)
            newGallery.save((err, galle) => {
                if (err) return cb(err);
                cb(null, doc);
            });
        })
            
        
      }, (doc, cb) => {

          //Filter lang by user language
          let userLang = activeVersion.lang.filter((lang) => {
              return lang.langCode == userProfile.user.language
          })        

          logger.info('Subproduct controller :: duplicate - Retrieved subproduct lang: %s', JSON.stringify(userLang));	

          if (params.name) {

              //Set lang to [] before re-setting it
              activeVersion.lang = [];

              let langObj = {
                  langCode: userProfile.user.language,
                  name: params.name,
                  description: userLang[0].description,
									gastroComment: userLang[0].gastroComment,
									gastroCommentLabel: userLang[0].gastroCommentLabel,
									diet: userLang[0].diet,
									dietLabel: userLang[0].dietLabel,
									tasting: userLang[0].tasting,
									tastingLabel: userLang[0].tastingLabel
              }

          		logger.info('Subproduct controller :: duplicate - Created new subproduct lang: %s', JSON.stringify(langObj));	
              activeVersion.lang.push(langObj)

          } else {

              let name = 'copy of ' + userLang[0].name;

              activeVersion.lang = [];

              let langObj = {
                  langCode: userProfile.user.language,
                  name: name.toUpperCase(),
                  description: userLang[0].description,
									gastroComment: userLang[0].gastroComment,
									gastroCommentLabel: userLang[0].gastroCommentLabel,
									diet: userLang[0].diet,
									dietLabel: userLang[0].dietLabel,
									tasting: userLang[0].tasting,
									tastingLabel: userLang[0].tastingLabel
              }

          		logger.info('Subproduct controller :: duplicate - Created new subproduct lang: %s', JSON.stringify(langObj));	
              activeVersion.lang.push(langObj)
          }

          if (newGallery) activeVersion.gallery = newGallery._id;
          doc.versions = [];
          doc.versions.push(activeVersion)

          //If params.location provided, set the new location of the duplicate document
          if (params.location) {
              let location = JSON.parse(params.location).map(function(id) { return new ObjectId(id); });
              doc.location = location;
          }

          cb(null, doc)

      }, (doc, cb) => {

          //Calculate subproduct composition reference and location cost
          costHelper.calculateRecipeCompLocationCosts(activeVersion, doc.location, Subproduct, (err, res) => {
              if(err) return cb(err)
              
              doc.versions[0].locationCost = res.locationCost;
              doc.versions[0].unitCost = res.unitCost;

              cb(null, doc)
          })

	    }, (doc, cb) => {

	        allergenHelper.calculateRecipeLocationAllergens(activeVersion, doc.location, (err, res) => {
	            if (err) return cb(err)

	            doc.versions[0].locationAllergens = res.locationAllergens;
	            doc.versions[0].allergens = res.referenceAllergens;

	            cb(null, doc)
	        })


      }, (doc, cb) => {

          doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber('002')
          let duplicate = new Subproduct(doc);
          duplicate.save((err, dup) => {
            if(err) return cb(err)
            cb(null, dup)
          })

      }, (dup, cb) => {

      	if(updateSubproductsLocationFlag) {

		        if (!dup.versions[0].composition.length) return cb (null, dup)
		        let parent = [];
		        parent = parent.concat(dup._id);

		        locHelper.computeRecipeLocationsRecursively(dup._id, dup.location, Subproduct, parent, (err, locations) => {
		            cb(null, dup)
		        })  

	      }
	      else
	      {
	      	cb(null, dup)
	      }

      }], (err, dup) => {
        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(dup).end();
      })

};


/**
 * @api {get} /subproduct/duplicateIntoDish Duplicates subproduct into dish
 * @apiGroup {subproduct}
 * @apiName Duplicates active version of subproduct into dish
 *
 * @apiDescription Duplicates active version of subproduct into dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  subproduct id to be duplicated
 * @apiParam {string} name  New dish name (in user's language)
 * @apiParam {string} location  Location for new dish
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.duplicateIntoDish = (req , res) => {
    let userProfile = req.userData;
    let params = req.query;
    var updateSubproductsLocation = params.updateSubproductsLocation;
    var updateSubproductsLocationFlag=false;
    if(updateSubproductsLocation == 'true') updateSubproductsLocationFlag=true    
    var subproductId = new ObjectId(params._id);
    var account = req.userData;
    var activeVersion;
    var dishActiveVersion;
    var Dish = require('../models/dish');
    var costHelper = require('../helpers/cost');
    let newGallery;

    var AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;


    waterfall([
        
        (cb) => { //Get active version of subproduct to be duplicated, without _id

        if(mongoose.Types.ObjectId.isValid(subproductId)) {  

          Subproduct.findOne(
            {
              _id: subproductId
            },
            {
              _id: 0, 
              active: 1, 
              family: 1, 
              subfamily: 1, 
              measurementUnit: 1,  
              location: 1,
              versions: {$elemMatch: {active: true}}
            }
          )
          .exec((err, doc) => {
            if (err) return cb(err)
            cb(null, doc)
          })

        } else {
          let err = new Error("Must provide a valid Subproduct id")
          err.statusCode = 402
          return cb(err)
        }

      }, (doc, cb) => {

          //Must convert doc to JSON otherwise mongo throws error

        doc = doc.toJSON();

        activeVersion = doc.versions[0];

        if(activeVersion.gallery){
            
            Gallery.findById(activeVersion.gallery, (err, gallery) => {
                if (err) return cb(err)
                if (!gallery) {
                    let err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err)
                }

                newGallery = new Gallery({
                    originalName: gallery.originalName,
                    sizes: gallery.sizes
                })    
                
                cb(null, doc)

            })            
          } else {
            cb (null, doc)
          }
      }, (doc, cb) => {  

        if(!newGallery) return cb(null, doc)

        let sizes = [];
        //Generate number to save new gallery
        let random_name = referenceNumberGeneratorHelper.generateReferenceNumber('')        

        async.eachSeries(newGallery.sizes, (size, cb_async) => {
        
            let extension = size.url.split('.').pop()
            let key = 'imgs/dish/' + random_name + '-' + size.sizeCode + '.' + extension
            let s3Url = 'https://s3-' + config.awsBucket.region + '.amazonaws.com/'
            let url = s3Url + config.awsBucket.bucketName + '/' + key

            var params = {
                Bucket: config.awsBucket.bucketName,
                CopySource: size.url,
                Key: key,
                ACL: 'public-read'

          };
          var s3 = new AWS.S3;

          s3.copyObject(params, function(err, data) {
            if (err) return cb_async(err);            
            sizes.push({
                sizeCode: size.sizeCode,
                url: url
            });            
            cb_async();
          });

        }, (err) => {
            newGallery.sizes = sizes;

            if(err) return cb(err)
            newGallery.save((err, galle) => {
                if (err) return cb(err);
                cb(null, doc);
            });
        })
            
        
      }, (doc, cb) => {


          if(params.name) {

            //Set lang to [] before re-setting it
            activeVersion.lang=[]; 

            let langObj = {
              langCode: userProfile.user.language,
              name: params.name
            }

            activeVersion.lang.push(langObj)
          
          } else {
            
            //Filter lang by user language
            let userLang = activeVersion.lang.filter ((lang) => {
              return lang.langCode == userProfile.user.language
            })

            let name = 'copy of ' + userLang[0].name;

            activeVersion.lang=[]; 

            let langObj = {
              langCode: userProfile.user.language,
              name: name.toUpperCase()
            }

            activeVersion.lang.push(langObj)
          }

          cb(null, doc)

     }, (doc, cb) => {

	     		dishActiveVersion = activeVersion;

	     		dishActiveVersion.numServings = 1;
	     		dishActiveVersion.batchServings = 0;
	     		dishActiveVersion.costPerServing = 0;
					//dishActiveVersion.weightPerServing = 0;	     		
	     		dishActiveVersion.weightPerServing = activeVersion.netWeight;
	     		dishActiveVersion.refPricePerServing = 0;
	     		dishActiveVersion.maxCostOverPricePercentage = 0;

	     		delete dishActiveVersion.batchWeight;
	     		delete dishActiveVersion.netWeight;
	     		delete dishActiveVersion.unitCost;

	     		cb(null, doc)

     }, (doc, cb) => {

     			//Set category of composition elements
     			dishActiveVersion.composition.forEach((compElement) => {
     				compElement.category = 'mainProduct'
     			})

     			cb(null, doc)


     }, (doc, cb) => {

          if (newGallery) activeVersion.gallery = newGallery._id;          
          doc.versions = [];
          doc.versions.push(activeVersion)

          //If params.location provided, set the new location of the duplicate document
          if (params.location) {
              let location = JSON.parse(params.location).map(function(doc) { return new ObjectId(doc); });
              doc.location = location;
          }

          cb(null, doc)  

      }, (doc, cb) => {

          //Calculate dish composition reference and location cost for aggregate locations in composition list
          costHelper.calculateRecipeCompLocationCosts(dishActiveVersion, doc.location, Dish, (err, res) => {
              if(err) return cb(err)
              
          		doc.versions[0].locationCost = res.locationCost;
          		doc.versions[0].costPerServing = res.costPerServing;

              cb(null, doc)
          })          

      }, (doc, cb) => {

          doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber('002')
          let duplicate = new Dish(doc);
          duplicate.save((err, dup) => {
          	if(err) return cb(err)
            cb(null, dup)
          })

      }, (dup, cb) => {

      	if(updateSubproductsLocationFlag) {

		        if (!dup.versions[0].composition.length) return cb (null, dup)
		        let parent = [];

		        locHelper.computeRecipeLocationsRecursively(dup._id, dup.location, Dish, parent, (err, locations) => {
		            cb(null, dup)
		        })  

	      }
	      else
	      {
	      	cb(null, dup)
	      }          

      }], (err, dup) => {
        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(dup).end();
      })

};


/**
 * @api {get} /subproduct/activeversion Gets active version of subproduct
 * @apiGroup {subproduct}
 * @apiName Get Subproduct's Active Version
 *
 * @apiDescription Gets our active Version of Subproduct
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getActiveVersion = (req , res) => {
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var subproductId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    waterfall([
        (cb) => {
            Subproduct.aggregate([
                {$unwind:
                    {path: "$versions"}
                },
                {$match: {'_id': subproductId}},
                {$match: {'versions.active': true}}
            ], (err, doc) => {
                    if (err) return cb(err)
                    cb(null,doc)
            })

        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })

};


/**
 * @api {get} /subproduct/locationcost Get subproduct's cost by location
 * @apiGroup {subproduct}
 * @apiName Get subproduct's location costs
 *
 * @apiDescription Get subproduct's location costs. First cost in the array is the reference unitCost.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getLocationCost = (req, res) => {
    var subproductId = new ObjectId(req.query._id);
    var versionId = new ObjectId(req.query.versionId);        
    var userData = req.userData;
    var locationCostArray = [];
 	var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var subproduct;

    waterfall([
      (cb) => {

          Subproduct.findOne(
            {
              _id: subproductId
            },
            {
              _id: 0, 
              active: 1, 
              family: 1, 
              subfamily: 1, 
              measurementUnit: 1,  
              location: 1,
              versions: {$elemMatch: {_id: versionId}}
            }
          )
          .exec((err, doc) => {
            if (err) return cb(err)
						if(!doc) {
	              var err=new Error('Document not found or empty');
	              err.statusCode=400;
	              return cb(err);
            }
            subproduct = JSON.parse(JSON.stringify(doc));
            let activeVersion = subproduct.versions[0];
            activeVersion.locationCost = [];
            subproduct.versions = activeVersion;
            //console.log(subproduct, 'subproduct')
            cb(null, doc)
          })

      	}, (doc, cb) => {      	

          Subproduct.aggregate([
              {$match: {'_id': subproductId}},
              {$unwind:
                  {path: "$versions"}
              },
              {$match: {'versions._id': versionId}},
			   			{
			   				$unwind: {
			   					path: "$versions.locationCost",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{$match: {"versions.locationCost.location": {$in: userLocIds}}},
        			{ // Alternative to populate
			          "$lookup": {
			              "from": "locations",
			              "localField": "versions.locationCost.location",
			              "foreignField": "_id",
			              "as": "versions.locationCost.location"
			          }
        			},
							{
			   				$unwind: {
			   					path: "$versions.locationCost.location",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{ 
        				"$group": {
									"_id": "$_id",
									"locationCost": { "$push": "$versions.locationCost" },
									"unitCost" : { "$addToSet": "$versions.unitCost" }
								}
							},
							{
			   				$unwind: {
			   					path: "$unitCost"
			   				}
			   			}   			
          ], (err, doc) => {
                if (err) return cb(err)
                if (!doc) { 
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);
                }

                if(!doc.length) {
                	cb(null, subproduct)
                } else {
	                let res = {
	                	_id: doc[0]._id,
	                	versions: { 
	                		locationCost: doc[0].locationCost,
	                		unitCost: doc[0].unitCost
	                	}
	                }
                	cb(null,res)
                }
          })

      }, (doc, cb) => {

          if(doc.versions.locationCost&&doc.versions.locationCost.length) locationCostArray = locationCostArray.concat(doc.versions.locationCost) //add location prices to array

          locationCostArray = locationCostArray.filter((item) => { //remove items with cost zero
            return item.unitCost!=0;
          })

          //Add unit cost as first element in the array
          let unitCostObject = {
            location: {name: 'Reference Cost'},
            unitCost: doc.versions.unitCost
          } 
          locationCostArray.unshift(unitCostObject); //add ref unitcost to array            

          cb(null, locationCostArray)

      }], (err, ok) => {
        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
      })
};


/**
 * @api {get} /drink/locationallergens Get drinkes's allergens by location
 * @apiGroup {drink}
 * @apiName Get drinkes location allergens
 *
 * @apiDescription Get drinkes location allergens. First allergens in the array is the reference allergens.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * @apiParam {string} _id  Dish id
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getLocationAllergens = (req, res) => {
    console.log(req.query   , 'query')
     let subproductId = new ObjectId(req.query._id);
     var versionId = new ObjectId(req.query.versionId);
     var userData = req.userData;
     var locationAllergensArray = [];
     var userLocations = req.userData.location;
     var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
     var drink;

     waterfall([
         (cb) => {
             Subproduct.aggregate([
                 { $match: { _id: subproductId } },
                 {$unwind:
                      {path: "$versions"}
                  },
                 { $match: { 'versions._id': versionId } },
                 { $project: { 
                    'versions.locationAllergens': 1, 
                    'versions.allergens':1, 
                    'versions._id':1 } 
                },
                 {
                     $unwind: {
                         path: "$versions.locationAllergens",
                         preserveNullAndEmptyArrays: true
                     }
                 },
                { $match: { $or: [
                    { "versions.locationAllergens.location": { $in: userLocIds } }, 
                    { "versions.locationAllergens.location": { $exists: false } }] } 
                },     
                 { 
                    "$group": {  
                        "_id": "$_id",
                        "locationAllergens": { "$push": "$versions.locationAllergens" },
                        "allergens" : { "$addToSet": "$versions.allergens" }
                    }
                },

             ], (err, doc) => {
                // cb(null,doc[0])
                console.log(doc, 'doc')

                 if (err) return cb(err)
                 if (!doc) {
                     var err = new Error('Document not found or empty');
                     err.statusCode = 400;
                     return cb(err);
                 }
                 if (!doc.length) return cb(null, doc)
                 else {
                    doc[0].allergens = doc[0].allergens[0]
                    cb(null, doc[0])
                };
             });

         }, (doc, cb) => {
            if (!doc) return cb(null, doc)

             Location.populate(doc, { path: "locationAllergens.location" }, (err, doc) => {
                 if (err) return cb(err)
                 cb(null, doc);
             });
         }, (doc, cb) => {

            if (!doc) return cb(null, doc)

             Allergen.populate(doc, [
                { path: "allergens.allergen" },
                { path: "locationAllergens.allergens.allergen" }
            ], (err, doc) => {
                 if (err) return cb(err)
                 cb(null, doc);
             });
         }, (doc, cb) => {
            if (!doc) return cb(null, doc)

             Gallery.populate(doc, [
                { path: "allergens.allergen.gallery" },
                { path: "locationAllergens.allergens.allergen.gallery" }
            ], (err, doc) => {
                 if (err) return cb(err)
                 cb(null, doc);
             });
        }, (doc, cb) => {

        if (!doc) return cb(null, doc)
        if(doc.locationAllergens&&doc.locationAllergens.length) locationAllergensArray = locationAllergensArray.concat(doc.locationAllergens) //add location prices to array
         
          let allergenObject = {
            location: {name: 'Reference Allergens'},
            allergens: doc.allergens
          } 
          locationAllergensArray.unshift(allergenObject); //add ref unitcost to array
          cb(null, locationAllergensArray)
         
     }], (err, ok) => {
         if (err) return res.status(500).json(err.message || 'Error').end();
         res.status(200).json(ok).end();
     })
 };

/**
 * @api {get} /subproduct/subproductinrecipes get Active Version of subproduct there are in recipes
 * @apiGroup {subproduct}
 * @apiName get Subproduct Active Version in Recipes
 *
 * @apiDescription get Subproduct Version in Recipes
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _subproductId _versionId Subproduct id Subproduct version id 
   
 *
 * @apiSuccess {Object} List of Recipes that contains subproduct versions
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getSubproductInRecipes=(req,res)=>{
    //console.log(req.query._id,'subproductInRecipes')
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var sortField = params.sortField || 'versions.lang.name';
    if(sortField == '') sortField = 'versions.lang.name'
    var sortOrder = Number(params.sortOrder) || 1;
    var subproductId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var page = params.page
    var perPage = params.perPage
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductInRecipes=[];
    var Model = [Subproduct,Product,Dish,Drink];
    let object;
    var totalItems = 0;
    var inSubproduct = []
    var totalElements = []
    let filteredInSubproducts;
    let filterSubproducts;
    let filterProducts;
    let filterDishes;
    let filterDrinks;
    let recipesObjects = []
    var filterLocation;
    var filterLocationPipeline;

    waterfall([

        (cb)=>{

        if (params.filterLocation) {
            filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
        } else {
            filterLocation = [];
        }

        //If an array of filter locations if provided, build the filter location pipeline
        filterLocationPipeline = {};
        if (filterLocation.length > 0) {
            filterLocationPipeline = {'location': {$in: filterLocation}}
        }

        async.eachSeries(Model, function(Model,cb_async){


          Model.aggregate([
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
            { // Alternative to populate to use filters on aggregate
              "$lookup": {
                 "from": "families",
                 "localField": "family",
                 "foreignField": "_id",
                 "as": "family"
              }
            },
            { 
              $unwind: {
                path: "$family",
                preserveNullAndEmptyArrays: true
              }
            },
            {$match: {'versions.composition.element.item' : subproductId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'location': {$in: userLocIds}}},
            {$match: filterLocationPipeline},
            {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
            {
               $group: {
                   "_id": "$_id",
                   "family": {$push: "$family"},
                   "measurementUnit": {$push:"$measurementUnit"},
                   "subfamily": {$push:"$subfamily"},
                   "referenceNumber": {$push:"$referenceNumber"},
                   "active": {$push:"$active"},
                   "kitchens": {$push:"$kitchens"},
                   "caducityFresh": {$push:"$caducityFresh"},
                   "caducityFreeze": {$push:"$caducityFreeze"},
                   "daysToUse": {$push:"$daysToUse"},
                   "location": {$push:"$location"},
                   "versions": {$push: "$versions"}
               }
            }
             ], (err, count) => {
                  if(err) return cb_async(err)
                  totalItems += count.length
                  cb_async()
              })

            },function(err){
                if (err) return cb(err)
                cb(null,true)
            })

        }, (doc, cb) => {

            async.eachSeries(Model, function(Model,cb_async){

              Model.aggregate([
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
                { // Alternative to populate to use filters on aggregate
                  "$lookup": {
                     "from": "families",
                     "localField": "family",
                     "foreignField": "_id",
                     "as": "family"
                  }
                },
                { 
                  $unwind: {
                    path: "$family",
                    preserveNullAndEmptyArrays: true
                  }
                },
                {$match: {'versions.composition.element.item' : subproductId}},
                {$match: {'versions.lang.langCode': userProfile.user.language}},
                {$match: {'location': {$in: userLocIds}}},
                {$match: filterLocationPipeline},
                {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
                {$skip: Number(params.perPage)*Number(params.page)},
                {$limit: Number(params.perPage)},
                {$sort:  {['versions.active']: -1}},
                {
                   $group: {
                       "_id": "$_id",
                       "family": {$push: "$family"},
                       "measurementUnit": {$push:"$measurementUnit"},
                       "subfamily": {$push:"$subfamily"},
                       "referenceNumber": {$push:"$referenceNumber"},
                       "active": {$push:"$active"},
                       "kitchens": {$push:"$kitchens"},
                       "caducityFresh": {$push:"$caducityFresh"},
                       "caducityFreeze": {$push:"$caducityFreeze"},
                       "daysToUse": {$push:"$daysToUse"},
                       "location": {$push:"$location"},
                       "versions": {$push: "$versions"}
                   }
                }
               ], (err, docs) => {

                  if (err) return cb_async(err)

                  switch (Model) {

                    case Subproduct:

                      recipesObjects = [];
                     
                      docs.forEach((subproduct)=>{

                        let activeVersion = subproduct.versions.shift();

                        let object = {
                          _id: subproduct._id,
                          family: subproduct.family[0],
                          subfamily: subproduct.subfamily[0],
                          measurementUnit: subproduct.measurementUnit[0],
                          referenceNumber: subproduct.referenceNumber[0],
                          active: subproduct.active[0],
                          kitchens: subproduct.kitchens[0] || [],
                          caducityFresh: subproduct.caducityFresh[0] || [],
                          caducityFreeze: subproduct.caducityFreeze[0] || [],
                          daysToUse: subproduct.daysToUse[0] || [],
                          location: subproduct.location[0],
                          activeVersion: activeVersion,
                          versions: subproduct.versions
                        }
                        recipesObjects.push(object)
                      })

                      if(recipesObjects.length > 0){

                        recipesObjects.map((subproduct)=>{
                          return subproduct.type = 'subproduct'
                        })
                      }

                      inSubproduct = recipesObjects

                      break;


                    case Product:
                        
                      recipesObjects = [];

                      docs.forEach((product)=>{

                        let activeVersion = product.versions.shift();

                        let object = {
                          _id: product._id,
                          family: product.family[0],
                          subfamily: product.subfamily[0],
                          measurementUnit: product.measurementUnit[0],
                          referenceNumber: product.referenceNumber[0],
                          active: product.active[0],
                          kitchens: product.kitchens[0] || [],
                          caducityFresh: product.caducityFresh[0] || [],
                          caducityFreeze: product.caducityFreeze[0] || [],
                          daysToUse: product.daysToUse[0] || [],
                          location: product.location[0],
                          activeVersion: activeVersion,
                          versions: product.versions
                        }
                        recipesObjects.push(object)
                      })

                      if(recipesObjects.length > 0){

                        recipesObjects.map((product)=>{
                          return product.type = 'product'
                        })
                      }

                      inSubproduct = inSubproduct.concat(recipesObjects)

                      break;

                    case Dish:
                       
                      recipesObjects = [];

                      docs.forEach((dish)=>{

                        let activeVersion = dish.versions.shift();

                        let object = {
                          _id: dish._id,
                          family: dish.family[0],
                          subfamily: dish.subfamily[0],
                          measurementUnit: dish.measurementUnit[0],
                          referenceNumber: dish.referenceNumber[0],
                          active: dish.active[0],
                          kitchens: dish.kitchens[0] || [],
                          caducityFresh: dish.caducityFresh[0] || [],
                          caducityFreeze: dish.caducityFreeze[0] || [],
                          daysToUse: dish.daysToUse[0] || [],
                          location: dish.location[0],
                          activeVersion: activeVersion,
                          versions: dish.versions
                        }
                        recipesObjects.push(object)
                      })

                      if(recipesObjects.length > 0){

                        recipesObjects.map((dish)=>{
                          return dish.type = 'dish'
                        })
                      }

                      inSubproduct = inSubproduct.concat(recipesObjects)

                      break;

                    case Drink:
                       
                      recipesObjects = [];
                      docs.forEach((drink)=>{

                        let activeVersion = drink.versions.shift();

                        let object = {
                          _id: drink._id,
                          family: drink.family[0],
                          subfamily: drink.subfamily[0],
                          measurementUnit: drink.measurementUnit[0],
                          referenceNumber: drink.referenceNumber[0],
                          active: drink.active[0],
                          kitchens: drink.kitchens[0] || [],
                          caducityFresh: drink.caducityFresh[0] || [],
                          caducityFreeze: drink.caducityFreeze[0] || [],
                          daysToUse: drink.daysToUse[0] || [],
                          location: drink.location[0],
                          activeVersion: activeVersion,
                          versions: drink.versions
                        }
                        recipesObjects.push(object)
                      })

                      if(recipesObjects.length > 0){

                        recipesObjects.map((drink)=>{
                          return drink.type = 'drink'
                        })
                      }

                      inSubproduct = inSubproduct.concat(recipesObjects)
                        
                      break;

                    }
                  
                    cb_async();
                })

            },function(err){
                if (err) return cb(err)
                cb(null,inSubproduct)
            })
        },(doc,cb)=>{
          object = {}
          //sort providers by id
          //inIngredient.sort(function(a,b) {return (a._id > b._id) ? 1 : ((b._id > a._id) ? -1 : 0);} );
          
          //count Docs
          //sort providers by sortField and sortOrder
          inSubproduct.sort(function(a,b) {return (a[sortField] > b[sortField]) ? sortOrder : ((b[sortField] > a[sortField]) ? -sortOrder : 0);} );

          // $skip: Number(perPage)*Number(page)
          //inIngredient.splice(0,Number(perPage)*Number(page));

          // $limit: Number(perPage)
          //filteredInIngredients = inIngredient.slice(0,Number(perPage));
          filteredInSubproducts = inSubproduct;

          filterSubproducts = filteredInSubproducts.filter((doc)=>{ return doc.type == 'subproduct'})
          filterProducts = filteredInSubproducts.filter((doc)=>{ return doc.type == 'product'})
          filterDishes = filteredInSubproducts.filter((doc)=>{ return doc.type == 'dish'})
          filterDrinks = filteredInSubproducts.filter((doc)=>{ return doc.type == 'drink'})
          // console.log(filterSubproducts,'filterSubproducts')
          // console.log(filterProducts,'filterProducts')
          // console.log(filterDishes,'filterDishes')
          // console.log(filterDrinks,'filterDrinks')
          object = {
            subproducts:filterSubproducts,
            products: filterProducts,
            dishes: filterDishes,
            drinks: filterDrinks,
            totalElements: totalItems
          }

          subproductInRecipes.push(object);
          cb(null,subproductInRecipes)
        }], (err, ok) => {
            if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
 }


/**
 * @api {get} /subproduct/refreshAllergens compute allergens of all subproducts.
 * @apiGroup {subproduct}
 * @apiName compute subproducts allergens 
 *
 * @apiDescription delete ingredient in recipe composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

  exports.refreshAllergens=(req,res)=>{

  	var refreshAllergensQueue = require('../queues/refreshAllergens')

    refreshAllergensQueue.refreshAllergens(
      {
        title: 'Refresh Subproduct Allergens ',
        model: 'Subproduct' 
      }
    ); 
    res.status(200).end();		    
  }

/**
 * @api {get} /subproduct/refreshAllergens compute allergens of all subproducts.
 * @apiGroup {subproduct}
 * @apiName compute subproducts allergens 
 *
 * @apiDescription delete ingredient in recipe composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

  exports.refreshCompCosts=(req,res)=>{

  	var refreshRecipesCompCosts = require('../queues/refreshRecipesCompCosts')

    refreshRecipesCompCosts.refreshRecipesCompCosts(
      {
        title: 'Refresh Subproduct Composition Costs ',
        model: 'Subproduct' 
      }
    ); 
    res.status(200).end();
  	 
  }


/**
 * @api {delete} /ingredient/ingredientInRecipes delete an ingredient associated to subproduct,product,dish or drink.
 * @apiGroup {ingredient}
 * @apiName delete ingredient 
 *
 * @apiDescription delete ingredient in recipe composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} ingredientId Ingredient id recipeId Recipe id RecipeVersionId Recipe Versions id 
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.deleteSubproductInRecipeVersion=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    var subproductId = new ObjectId(params.subproductId);
    var recipeId = new ObjectId(params.recipeId);
    var recipeVersionId = new ObjectId(params.recipeVersionId);
    var type = params.type
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var subproductInRecipes=[];
    var Model;
    var recipe;
    let indexArray = []

    if(type == 'subproduct') Model = Subproduct
    if(type == 'product') Model = Product
    if(type == 'dish') Model = Dish
    if(type == 'drink') Model = Drink

      async.waterfall([

        (cb)=>{

          Model.findOne({'_id': recipeId})
               .exec((err,doc)=>{

                  if(err) return cb(err)
                  if(!doc) cb(null,true)
                  if(doc){
                    console.log(doc,'doc')

                    doc.versions.forEach((version)=>{

                      if(version._id.equals(recipeVersionId)){

                        version.composition.forEach((composition, index)=>{
                          let i = index
                          //console.log(composition.element.item,'element.item ==', ingredientId,'ingredientId')
                          if(composition.element.item.equals(subproductId)) {
                            indexArray.push(i)
                          }

                        })

                        indexArray.forEach((index)=>{
                          version.composition.splice(index,1)
                        })

                      }

                    })
                    
                    cb(null,doc)
                  }

               })

        },(doc,cb)=>{
          //console.log(recipe.versions.composition,'recipe')
          //console.log(doc.versions.composition,'doc')

          Model.update({_id: doc._id},doc,(err)=>{
            if(err) return cb(err)
              cb(null,doc)
          })

        }],(err, ok)=>{
          console.log(err,'err')
            if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
 }


/**
 * @api {delete} /drink/drinkingastrooffers delete a drink associated to gastroOffer.
 * @apiGroup {drink}
 * @apiName delete drink in gastroOffer 
 *
 * @apiDescription delete drink in gastroOffer composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} drinkId drink id gastroOfferId gastroOffer id gastroOfferVersionId gastroOffer Versions _id
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.deleteAllSubproductInRecipes=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    console.log(req.body,'reqBody')
    console.log(req.query,'reqQuery')
    var subproduct = new ObjectId(params.subproductId);
    var recipe = new ObjectId(params.recipeId);
    var type = params.type
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var ingredientInRecipes=[];
    var recipe;
    let indexArray = [];

    if(type == 'subproduct') Model = Subproduct
    if(type == 'product') Model = Product
    if(type == 'dish') Model = Dish
    if(type == 'drink') Model = Drink

      async.waterfall([

        (cb)=>{
            //console.log(gastroOffer,'gastroOfferAPI')
          Model.findOne({'_id': recipe})
                     .populate("versions.composition")
                     .sort({'versions.updatedAt': -1})
               .exec((err,doc)=>{

                  if(err) return cb(err)
                  if(!doc) cb(null,true)
                  if(doc){
                    console.log(doc.versions.length,'docInit')

                    doc.versions.forEach((version, index)=>{

                        if(version.composition.length){

                            version.composition.forEach((composition)=>{

                                if(composition.element.item.equals(subproduct)) {
                                    //console.log(version,'versionMatchToDeleted')
                                    if(version.active == false) indexArray.push(index)
                                }

                            })

                        } 

                        
                    })
                    // doc.versions.forEach((version)=>{

                    //   if(version._id.equals(recipeVersionId)){

                    //     version.composition.forEach((composition, index)=>{
                    //       //console.log(composition.element.item,'element.item ==', ingredientId,'ingredientId')
                    //       if(composition.element.item.equals(subproductId)) {
                    //         console.log(index,'index')
                    //         version.composition.splice(index,1)
                    //       }

                    //     })

                    //   }

                    // })
                    
                    //cb(null,doc)
                    cb(null,doc)
                  }

               })

        },(doc,cb)=>{
          //console.log(recipe.versions.composition,'recipe')
          //console.log(doc.versions.composition,'doc')

          // Model.update({_id: doc._id},doc,(err)=>{
          //   if(err) return cb(err)
          //     cb(null,doc)
          // })

        }],(err, ok)=>{
          console.log(err,'err')
            if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
 }


//Endpoint created to set composition unit cost zero in case it is not defined. This is a one-off endpoint created 
//to resolve an issue.

 exports.resetNullCost = (req, res) => {
   var userData = req.userData;

    waterfall([
        (cb) => {
            Subproduct.aggregate([
                {
                    $unwind: {path: '$versions'}
                },
                {$match: {'versions.composition.unitCost': null}},
                { "$group": {
                    "_id": "$_id",
                    "versions": { "$push": "$versions" }
                }}
            ], (err, docs) => {
                    if (err) return cb(err)
                    cb(null,docs)
            })
        }, (docs, cb) => {
                docs.forEach((subproduct) => {
                    subproduct.versions.forEach((subproductVersion) => {
                        subproductVersion.composition.forEach( (compElement) => {
                            if(!compElement.unitCost || compElement.unitCost == null){ 
                                compElement.unitCost = 0;
                            }
                        })
                    })
                })
                cb(null, docs)
        }, (docs, cb) => {
                //Save updated subproduct versions
                async.each(docs, function(updatedSubproduct, cb_async) {
                    //we first get the actual complete subproduct
                    Subproduct.findById(updatedSubproduct._id, (error,doc)=>{
                        //console.log('hello findById')
                        //Update the updated versions
                        updatedSubproduct.versions.forEach((updatedSubproductVersion) => {
                            doc.versions.forEach((subproductVersion, index) =>{
                                let subproductVersionId = new ObjectId(subproductVersion._id);
                                let updatedSubproductVersionId = new ObjectId(updatedSubproductVersion._id);
                                if(subproductVersionId.equals(updatedSubproductVersionId)){ 
                                    //Replace version with updated one
                                    //console.log('replacing in position' + index + 'version with calculatedCost' + updatedSubproductVersion.calculatedCost)
                                    doc.versions.splice(index, 1, updatedSubproductVersion);
                                }
                            })
                        })
                        doc.save((err) => {
                            if(err) return cb(err)
                            cb_async();                     
                        })      
                    });
                });
                cb(null, true)                           
        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
};


//Endpoint created to set unit cost to zero in case it is not defined. This is a one-off endpoint created 
//to resolve an issue.

 exports.resetUnitCost = (req, res) => {
   var userData = req.userData;

    waterfall([
        (cb) => {
            Subproduct.aggregate([
                {
                    $unwind: {path: '$versions'}
                },
                {$match: {'versions.unitCost': null}},
                { "$group": {
                    "_id": "$_id",
                    "versions": { "$push": "$versions" }
                }}
            ], (err, docs) => {
                    if (err) return cb(err)
                    cb(null,docs)
            })
        }, (docs, cb) => {
                docs.forEach((subproduct) => {
                    subproduct.versions.forEach((subproductVersion) => {
                        if(subproductVersion.unitCost == null){ 
                            subproductVersion.unitCost = 0;
                        }
                    })
                })
                cb(null, docs)
        }, (docs, cb) => {
                //Save updated subproduct versions
                async.each(docs, function(updatedSubproduct, cb_async) {
                    //we first get the actual complete subproduct
                    Subproduct.findById(updatedSubproduct._id, (error,doc)=>{
                        //console.log('hello findById')
                        //Update the updated versions
                        updatedSubproduct.versions.forEach((updatedSubproductVersion) => {
                            doc.versions.forEach((subproductVersion, index) =>{
                                let subproductVersionId = new ObjectId(subproductVersion._id);
                                let updatedSubproductVersionId = new ObjectId(updatedSubproductVersion._id);
                                if(subproductVersionId.equals(updatedSubproductVersionId)){ 
                                    //Replace version with updated one
                                    //console.log('replacing in position' + index + 'version with calculatedCost' + updatedSubproductVersion.calculatedCost)
                                    doc.versions.splice(index, 1, updatedSubproductVersion);
                                }
                            })
                        })
                        doc.save((err) => {
                            if(err) return cb(err)
                            cb_async();                     
                        })      
                    });
                });
                cb(null, true)                           
        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
};

//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

 exports.generateReferenceNumber = (req, res) => {

    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator')
    waterfall([
        (cb) => {
            Subproduct.find({}, (err, docs) => {
                //console.log(docs,'DOCS')
                if (err) { 
                    return cb(err) 
                }
                cb(null,docs);
            });
        }, (docs, cb) => {
            //console.log('entering GET',docs.length)
                async.eachSeries(docs,function(subproduct,cb_async){
                    
                    function generateReferenceNumber() {
                        
                        return function() {
                            
                              subproduct.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.subproduct)
                              
                                if(subproduct.referenceNumber){

                                    console.log(subproduct.referenceNumber,'Reference Number of Subproduct')
                                    
                                    subproduct.save((err)=>{
                                        if(err) return cb_async(err)
                                        cb_async();
                                    })

                                }
                        }
                    }
                    setTimeout(generateReferenceNumber(), 1);

                },function(err){
                    cb(null,true)
                })
                           
        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
};