 
 var waterfall = require('async-waterfall');
 var locHelper = require('../helpers/locations');
 var costHelper = require('../helpers/cost');
 var allergenHelper = require('../helpers/allergen');
 var mongoose = require('../node_modules/mongoose');
 var fs = require('fs');
 var async = require('async');
 var Product = require('../models/product');
 var Ingredient = require('../models/ingredient');
 var Gallery = require('../models/gallery');
 var Packaging = require('../models/packaging');
 var GastroOffer = require('../models/gastroOffer');
 var PricingRate = require('../models/pricingRate');
 var Allergen = require('../models/allergen'); 
 var User = require('../models/user');
 var Location = require('../models/location');
 var {ObjectId} = require('mongodb');
 var config = require('../config/config');
 var assert = require('assert');
 var Subproduct = require('../models/subproduct');
 var elementsHelper = require('../helpers/getElements');
 var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator')
 var config = require('../config/config');
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.controllers;

 /**
 * @api {post} /product Add new product
 * @apiGroup {product}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} product-Creation:
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
					"name" : "producto 22",
					"description" : "Descripción del producto 22"
				},
				{
					"langCode": "en",
					"name" : "product 22",
					"description" : "Description of product 22"
				}
			],
			"active" : "true",
			"netWeight" : "2.34",
			"composition" : null,
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
 	var inProduct = req.body;
    //console.log(inProduct,'inProduct',account,'account')
 	var productLocations = inProduct.location || null;
 	var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });

 	async.waterfall([
        (cb) => { //location check: each product location should have at least one user location in its upper path. Each product's location
        	// includes its upper path.
            //console.log(productLocations,'productLocations')
           if(productLocations!=null){

            	//Check whether list of product locations includes at least one customer location.
            	var match = productLocations.find((id) => {
                    let locId = new ObjectId(id);
            		for(var i=0; i<userLocIds.length; i++) {
            			if (userLocIds[i].equals(locId)) return true;
            		}
            	});

            	if (match) { cb(null, match); }
            	else { 
                    var err = new Error('Access to product location is not allowed');
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
            inProduct.versions.last_account = account._id;
            inProduct.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.product)
            var product = new Product(inProduct);
            //console.log('add product API',product)
            product.save((err) => {
                if (err) return cb(err)
                cb(null, product);
            });
        }], (err, ok) => {		
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();  	
        })
 }

 /**
 * @api {post} /product Add new product version
 * @apiGroup {product}
 * @apiName Add new version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Product-Creation:
 * {
	"_id": "57ea7dfe991de2ce2d211fc3",
	"versions": [
		{
			"lang" :[
				{
					"langCode": "es",
					"name" : "Producto 1",
					"description" : "Descripción del producto 22"
				},
				{
					"langCode": "en",
					"name" : "Product 1",
					"description" : "Description of product 22"
				}
			],
			"active" : "false",
			"netWeight" : "10.45",
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
 	var account = req.userData;
 	var inProduct = req.body;
    //console.log(inProduct,'inProductVersion')
 	var productLocations;
 	var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
  var sortField = 'updatedAt';
  var sortOrder = 1;
  var activeVersion;
  var locationWarning = false;
  var Model;
 	var Subproduct = require('../models/subproduct');   

  logger.info('Product Controller - add Version - Entering method.')

 	waterfall([
        (cb) => { //Verify maximum number of versions
            Product.findById(inProduct._id, (err, doc) => {
              if (err) return cb(err);
              
              if (!doc) {
                  var err = new Error('Document not found')
                  err.statusCode = 404;
                  return cb(err);
              }
              
              if (doc.versions.length >= config.maxNumVersionsRecipes) {
                doc.versions.sort(function(a,b) {return (a[sortField] > b[sortField]) ? sortOrder : ((b[sortField] > a[sortField]) ? -sortOrder : 0);} ).shift();
                }

              logger.info('Product Controller - add Version - Verified number of versions has not reached limit. Total versions: %s', doc.versions.length)
              cb (null, doc)
            })

        }, (doc, cb) => {
          //location check: each product location should have at least one user location in its upper path. Each product's location
          	// also includes its upper path.

            productLocations=doc.location;
      		  //Check whether list of product locations includes at least one customer location.
     		
      			var match = productLocations.find((id) => {
                      let locId = new ObjectId(id);
      				for(var i=0; i<userLocIds.length; i++) {
      					if (userLocIds[i].equals(locId)) return true;
      				}
      			});

      			if (match) { 

                  logger.info('Product Controller - add Version - Checked that list of product locations includes at least one customer location')
                  cb(null, doc); 

                } else { 

                  var err = new Error('Access to product location is not allowed');
                  err.statusCode=400;
                  return cb(err);

                }

        }, (doc, cb) => {

            //Update previous active version to not active
            doc.versions.forEach(function (version) {
                if(version.active==true) version.active=false;
            })
            logger.info('Product Controller - add Version - Updated previous active version to not active.')


            inProduct.version.last_account = account._id;
            logger.info('Product Controller - add Version - Set last_account.')

            doc.measurementUnit=inProduct.measurementUnit;
            doc.family=inProduct.family;
            doc.subfamily=inProduct.subfamily;
            doc.active=inProduct.active;
            doc.kitchens = inProduct.kitchens;
            doc.caducityFresh = inProduct.caducityFresh;
            doc.caducityFreeze = inProduct.caducityFreeze;
            doc.daysToUse = inProduct.daysToUse;
            doc.location=inProduct.location;
            
            logger.info('Product Controller - add Version - Set additional new version fields.')

            cb(null, doc)

        }, (doc, cb) => {

            //Calculate product composition reference and location cost for aggregate locations in composition list
            costHelper.calculateRecipeCompLocationCosts(inProduct.version, inProduct.location, Product, (err, res) => {
                if(err) return cb(err)
                
                //console.log('Calculated product composition reference and location cost for aggregate locations in composition list')
                inProduct.version.locationCost = res.locationCost;
                inProduct.version.compositionCost = res.compositionCost;

                logger.info('Product Controller - add Version - Calculated product composition reference and location cost.')
                logger.info('Product Controller - add Version - locationCost %j', res.locationCost)
                logger.info('Product Controller - add Version - compositionCost %j', res.compositionCost)

                cb(null, doc)
            })

        }, (doc, cb) => {

            //Calculate product packaging reference and location cost for aggregate locations in packaging list
            costHelper.calculateRecipePackLocationCosts(inProduct.version, inProduct.location, Product, (err, res) => {
                if(err) return cb(err)
                
                //console.log('Calculated product packaging reference and location cost for aggregate locations in packaging list')
                inProduct.version.packLocCost = res.packLocCost;
                inProduct.version.packagingCost = res.packagingCost;
                inProduct.version.unitCost = res.unitCost;

                inProduct.version.totalCost = inProduct.version.packagingCost + inProduct.version.compositionCost;

                logger.info('Product Controller - add Version - Calculated product packaging reference and location cost for aggregate locations in packaging list')
                logger.info('Product Controller - add Version - packLocCost %j', inProduct.version.packLocCost)
                logger.info('Product Controller - add Version - packagingCost %s', inProduct.version.packagingCost)
                logger.info('Product Controller - add Version - unitCost %s', inProduct.version.unitCost)
                logger.info('Product Controller - add Version - totalCost %j', inProduct.version.totalCost)

                cb(null, doc)
            })

        }, (doc, cb) => { //Calculate total location cost

            //recalculate sum of composition and packaging cost arrays
            locHelper.sumLocCostArrays(inProduct.version.locationCost, inProduct.version.packLocCost, (err, res) => {
                inProduct.version.totalLocCost=res;
                logger.info('Product Controller - add Version - totalLocCost %j', res)
                cb(null, doc)
            })

		    }, (doc, cb) => {

		        allergenHelper.calculateRecipeLocationAllergens(inProduct.version, inProduct.location, (err, res) => {
		            if (err) return cb(err)

		            inProduct.version.locationAllergens = res.locationAllergens;
		            inProduct.version.allergens = res.referenceAllergens;
		            logger.info('Product Controller - add Version - Recalculated product reference allergens and location allergens');

		            cb(null, doc)
		        })                     

        }, (doc, cb) => {

            doc.versions.push(inProduct.version);

            //console.log(doc, 'Product to be saved')
            doc.save((err, savedDoc) => {
                if (err) return cb(err)
                logger.info('Product Controller - add Version - Successfully saved product with new version.')
                cb(null, savedDoc);

            });

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
			        	logger.info('Populated product composition items.')
			          cb(null, savedDoc);
			          //console.log(doc,'docGOgetVersion')
			        });

				    }
				    else
				    {
				    	logger.error('Could not find active version of product.')
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
 * @api {delete} /product Delete product
 * @apiGroup {product}
 * @apiName Delete Product
 *
 * @apiDescription Delete a product
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 *
 * @apiSuccess {Object} Product removed
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
    var productLocations;
    var productId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the product's locations      

        if(mongoose.Types.ObjectId.isValid(params._id)) {  
            Product.findById(productId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }
                //Check whether list of product locations includes at least one customer location.
                productLocations=doc.location;
                
                var match = productLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });

                if (match) { cb(null, doc); }
                else { 
                    var err = new Error('Access to product location is not allowed');
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
        //remove product
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
 * @api {delete} /product/version Delete product version
 * @apiGroup {product}
 * @apiName Get Product
 *
 * @apiDescription Delete a product version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 * @apiParam {string} _versionId  Product version id
 *
 * @apiSuccess {Object} Product version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.removeVersion = (req, res) => {
    //Can't delete an active version
    //Can't delete if there is only one version left
    //Can't delete if the product is not within the user's location zone
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var productLocations;
    var productId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //Verify product exists

            if(mongoose.Types.ObjectId.isValid(params._id) && mongoose.Types.ObjectId.isValid(params._versionId)) {  
                Product.findById(productId, (err, doc) => {
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
                let err=new Error("It is not possible to remove the only version of the product");
                err.statusCode=400;
                return cb(err)
            } else  {
                cb(null, doc);
            }

        }, (doc, cb) => { //location check. Verify that at least one user location is within the product's locations

                //Check whether list of product locations includes at least one customer location.
                productLocations=doc.location;
                
                var match = productLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });

                if (match) { cb(null, doc); }
                else { 
                    var err = new Error('Access to product location is not allowed');
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
 * @api {put} /product/version Set version as active
 * @apiGroup {product}
 * @apiName Set As Active
 *
 * @apiDescription Set a product version as active
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 * @apiParam {string} _versionId  Product version id
 *
 * @apiSuccess {Object} Product active version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.setAsActiveVersion = (req, res) => {
 	//sets product version as active
    //Location check
    //Must make the previous version not active
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var productLocations;
    var productId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 
    let activeProductVersion;
    var MeasUnit = require('../models/measurementUnit')
    var Product = require('../models/product');


    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the product's locations
        
        if(mongoose.Types.ObjectId.isValid(productId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Product.findById(productId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                productLocations=doc.location;
                //Check whether list of product locations includes at least one customer location.
                
                var match = productLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });
                if (match) { cb(null, doc); }
                else { 
                    var err = new Error('Access to product location is not allowed');
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
                  activeProductVersion = version;
                }
            })

            cb(null, doc);
            
    }, (doc, cb) => {
        
    //Filter ingredient or subproduct lang field based on user language
    async.each(activeProductVersion.composition, function(compElement, cb_async) {

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
              logger.error('Could not retrive active version of product in recipe composition. Product id: %s', productId, ' and version id: ', versionId);
              cb_async()
            }
          } else {
            logger.error('Could not populate subproduct in product recipe. Product id: %s', productId, ' and version id: ', versionId);
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
            logger.error('Could not populate ingredient in product recipe. Product id: %s', productId, ' and version id: ', versionId)
            cb_async();
          }
        }); 
      }
    }, (err) => { //finished async loop
        cb(null, doc);
      });
    }, (doc, cb) => {
    //Filter ingredient or subproduct lang field based on user language
      activeProductVersion.composition.forEach((compElement)=> {
          compElement.element.item = compElement.element.item? compElement.element.item._id : null;

      })
      cb (null, doc)
    }, (doc, cb) => {
        	//Calculate product composition reference and location cost for aggregate locations in composition list

	        costHelper.calculateRecipeCompLocationCosts(activeProductVersion, productLocations, Product, (err, res) => {
	          if(err) return cb(err)
	          activeProductVersion.locationCost = res.locationCost;
	          activeProductVersion.compositionCost = res.compositionCost;

	          logger.info('Product Controller - add Version - Calculated product composition reference and location cost for aggregate locations in composition list.')
	          logger.info({'Product Controller - add Version - locationCost': res.locationCost})
	          logger.info({'Product Controller - add Version - compositionCost': res.compositionCost})

	          cb(null, doc)
	        })  

    	}, (doc, cb) => {

          //Calculate product packaging reference and location cost for aggregate locations in packaging list
          costHelper.calculateRecipePackLocationCosts(activeProductVersion, productLocations, Product, (err, res) => {
              if(err) return cb(err)
              
              //console.log('Calculated product packaging reference and location cost for aggregate locations in packaging list')
              activeProductVersion.packLocCost = res.packLocCost;
              activeProductVersion.packagingCost = res.packagingCost;
              activeProductVersion.unitCost = res.unitCost;

              activeProductVersion.totalCost = activeProductVersion.packagingCost + activeProductVersion.compositionCost;

              logger.info('Product Controller - add Version - Calculated product packaging reference and location cost for aggregate locations in packaging list')
              logger.info({'Product Controller - add Version - packLocCost': activeProductVersion.packLocCost})
              logger.info({'Product Controller - add Version - packagingCost': activeProductVersion.packagingCost})
              logger.info({'Product Controller - add Version - unitCost': activeProductVersion.unitCost})
              logger.info({'Product Controller - add Version - totalCost': activeProductVersion.totalCost})

              cb(null, doc)
          })

      }, (doc, cb) => { //Calculate total location cost

          //recalculate sum of composition and packaging cost arrays
          locHelper.sumLocCostArrays(activeProductVersion.locationCost, activeProductVersion.packLocCost, (err, res) => {
              activeProductVersion.totalLocCost=res;
              logger.info({'Product Controller - add Version - totalLocCost': res}, 'Calculated and updated totalLocCost of recipe.')
              cb(null, doc)
          })

	    }, (doc, cb) => {

	        allergenHelper.calculateRecipeLocationAllergens(activeProductVersion, productLocations, (err, res) => {
	            if (err) return cb(err)

	            activeProductVersion.locationAllergens = res.locationAllergens;
	            activeProductVersion.allergens = res.referenceAllergens;
	            logger.info('Product Controller - add Version - Recalculated product reference allergens and location allergens');

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
 * @api {get} /product Get all products within the user's locations with pagination and filter
 * @apiGroup {product}
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
 	//Gets the active version of all products that are in the user's zone.
 	let userProfile = req.userData;
 	let params = req.query;
 	var filterText = params.filterText || '';
  var sortField = params.sortField || 'versions.lang.name';
  var sortOrder = Number(params.sortOrder) || 1;
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var filterLocation;
  var filterLocationPipeline;
  var filterFamilyPipeline;
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
            filterLocationPipeline = {
              'location': {$in: filterLocation}
            }
        }

        //If a family id is provided for filtering, build the filter family pipeline.
   			filterFamilyPipeline = {};
   			if (mongoose.Types.ObjectId.isValid(params.family)) {
   				filterFamilyPipeline = {'family': new ObjectId(params.family)}
   			}

   			Product.aggregate([
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
          {$match: {'location': {$in: userLocIds}}},
          {$match: filterLocationPipeline},
          {$match: filterFamilyPipeline},
          {$match: {'versions.lang.langCode': userProfile.user.language}},
          {$match: {
            $or: [
              {'versions.lang.name': {$regex: filterText, $options: 'i'} },
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

            Product.populate(docs, {path: "measurementUnit kitchens.kitchen versions.gallery location"}, (err, docs) => {
                if (err) {
                    return cb(err)
                }
                cb(null, docs)
            });
        })

    },(docs, cb) => { //Create location text list

          let locationList;

          docs.forEach((product) => { 

            locationList = '';

            product.location.forEach((loc, index) => {

              if (index < product.location.length -1 )
                  locationList = locationList + loc.name + ', '
              else 
                locationList = locationList + loc.name
            })
            product.locationList = locationList;
          })

          cb(null, docs)

    },(docs, cb) => { //Map location array back to _ids

          docs.forEach((product) => {
            product.location = product.location.map((loc) => {
              return loc._id;
            })
          })

          cb(null, docs)
    
    },(docs, cb) => { //Calculate and update average location cost based on filterLocation

        if(addModal) costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Product, filterLocation);
        else costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Product);
        
        cb(null, docs)

    },(docs, cb) => {

          //Get total number of elements for pagination
          Product.aggregate([
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
        		{$match: activePipeline},
            {$match: {'versions.active' : true}},
            {$match: {'location': {$in: userLocIds}}},
            {$match: filterLocationPipeline},
            {$match: filterFamilyPipeline},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {
              $or: [
                {'versions.lang.name': {$regex: filterText, $options: 'i'} },
                {'family.lang.name': {$regex: filterText, $options: 'i'} }
              ]
            }},
            {$project: {_id: 1}}
           ], (err, count) => {
            if (err) return cb(err)

          	let products = {
          		'products': docs,
          		'totalElements': count.length
          	};

          	cb(null, products)
          })
        
    }], (err, ok) => {

        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
    });
 };

/**
 * @api {get} /product/version Get product version
 * @apiGroup {product}
 * @apiName Get Product
 *
 * @apiDescription Get a product version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 * @apiParam {string} versionId  Product version id
 *
 * @apiSuccess {Object} Product version
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
    var productLocations;
    var productId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 
    var Ingredient = require('../models/ingredient');
    var Subproduct = require('../models/subproduct');
    var Model;

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the product's locations
        
        if(mongoose.Types.ObjectId.isValid(productId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Product.findById(productId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                productLocations=doc.location;
                //Check whether list of product locations includes at least one customer location.
                
                var match = productLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });
                if (match) { cb(null, match); }
                else { 
                    var err = new Error('Access to product location is not allowed');
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
    	
        Product.aggregate([
        {
            $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true
            }
        },
        {$match: {'_id' : productId}},
        {$match: {'versions._id' : versionId}},
        ], (err, doc) => {
            if (err) {
                return cb(err)
            }
            Product.populate(doc, 
                {path: "versions.gallery kitchens.kitchen measurementUnit versions.cookingSteps.process versions.cookingSteps.utensil versions.cookingSteps.gastroCheckpoint versions.cookingSteps.criticalCheckpoint versions.cookingSteps.images"
                 //,match: {'versions.cookingSteps.lang.langCode': userProfile.user.language}
             }, (err, doc) => {
                if (err) {
                    return cb(err)
                }
                cb(null, doc)
            });
        })

    }, (doc, cb) => {

        //Filter ingredient or subproduct lang field based on user language
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
            				logger.error('Could not retrive active version of subproduct in recipe composition. Product id: %s', productId, ' and version id: ', versionId);
            				let err= new Error('Could not retrive active version of subproduct in recipe composition')
            				return cb_async(err)
		             }
	            } else {
	            	compElement.itemNull = true;
	            	logger.error('Could not populate subproduct in product recipe. Product id: %s', productId, ' and version id: ', versionId);
	            	let err = new Error('Could not populate subproduct in recipe')
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
              	logger.error('Could not populate ingredient in product recipe. Product id: %s', productId, ' and version id: ', versionId)
              }

              cb_async();
            }); 
          }       

        }, (err) => { //finished async composition loop
          logger.info('Updated product\'s composition elements cost based on filterLocation')
          cb(null, doc);
        });

    }, (doc, cb) => { //Do the same as before with packaging elements.

        //Filter ingredient or subproduct lang field based on user language
        async.eachSeries(doc[0].versions.packaging, function(packElement, cb_async) {
   
          Packaging.populate(packElement, { path: "packaging" }, (err, packElement) => {
            if (err) return cb(err)

            if(packElement.packaging != null) {

              //Udpdate unit cost and locationCost of subproduct
              packElement.unitCost = packElement.packaging.referencePrice;

              if(packElement.packaging.locationCost) { 
                packElement.locationCost = packElement.packaging.locationCost;
              } else  {
                packElement.locationCost = [];
              }

              //Update composition element unitCost with average location cost based on filterLocation
              costHelper.calculateCompElementAvgLocCostAndAllergens(packElement, doc[0].location, Packaging); //Method also valid for packaging elements

              //Filter user language
              let userLang=[];

              userLang = packElement.packaging.lang.filter((langItem) => {
                return langItem.langCode=userProfile.user.language;
              })

              if(userLang.length) {
                //The client assumes packaging is not populated. Must de-populate it.
                packElement.packaging = packElement.packaging._id;
                packElement.name = userLang[0].name;
              }
            }

            cb_async();
              
          });

        }, (err) => { //finished async packaging loop
          logger.info('Updated product\'s packagings elements cost based on filterLocation')
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
 * @api {get} /product/lang Get lang field of product version
 * @apiGroup {product}
 * @apiName Get Product langs
 *
 * @apiDescription Get lang of product version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 * @apiParam {string} versionId  Product version id
 *
 * @apiSuccess {Object} Product lang
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
    var productLocations;
    var productId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 


    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the product's locations
        
        if(mongoose.Types.ObjectId.isValid(productId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Product.findById(productId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                productLocations=doc.location;
                //Check whether list of product locations includes at least one customer location.
                
                var match = productLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });
                if (match) { cb(null, match); }
                else { 
                    var err = new Error('Access to product location is not allowed');
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
        Product.aggregate([
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
        {$match: {'_id' : productId}},
        {$match: {'versions._id' : versionId}},
        {$match: {'versions.lang.langCode': userProfile.user.language}},
         ], (err, doc) => {
            if (err) {
                return cb(err)
            }

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
 * @api {get} /product/versions Get all product's versions
 * @apiGroup {product}
 * @apiName Get Product Versions
 *
 * @apiDescription Get all product's versions
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 *
 * @apiSuccess {Object} Product version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.getAllVersions = (req, res) => {
    //Gets the active version of all products that are in the user's zone.
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var productId = new ObjectId(params._id);
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

            Product.aggregate([
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
            {$match: {'_id' : productId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
            {$sort: params.sort},
            {$skip: Number(params.perPage)*Number(params.page)},
            {$limit: Number(params.perPage)}
            ], (err, docs) => {
                if (err) {
                    return cb(err)
                }
                Product.populate(docs, {path: "measurementUnit kitchens.kitchen versions.gallery versions.last_account"}, (err, docs) => {
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

          costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Product);
        	cb(null, docs) 

        },(docs, cb) => {
            
            //Get total number of elements for pagination
            Product.aggregate([
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
            {$match: {'_id' : productId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
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
 * @api {get} /product/elements Gets ordered list of ingredients and subproducts
 * @apiGroup {product}
 * @apiName Get Product's Elements
 *
 * @apiDescription Gets ordered list of ingredients and products that can be included in a product recipe
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
 * @api {get} /product/activeversion Gets active version of product
 * @apiGroup {product}
 * @apiName Get Product's Active Version
 *
 * @apiDescription Gets our active Version of Product
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
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
    var productId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    waterfall([
        (cb) => {
            Product.aggregate([
                {$unwind:
                {path: "$versions"}},
                {$match: {'location': {$in: userLocIds}}},
                {$match: {'_id': productId}},
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
 * @api {get} /product/duplicate Duplicates product
 * @apiGroup {product}
 * @apiName Duplicates active version of product
 *
 * @apiDescription Duplicates active version of product
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  product id to be duplicated
 * @apiParam {string} name  New product name (in user's language)
 * @apiParam {string} location  Location for new product
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
    var updateSubproductsLocation = params.updateSubproductsLocation;
    var updateSubproductsLocationFlag=false;
    if(updateSubproductsLocation == 'true') updateSubproductsLocationFlag=true       
    var productId = new ObjectId(params._id);
    var account = req.userData;
    var activeVersion;
    let newGallery;
    var referenceNumberGeneratorHelper = require('../helpers/referenceNumberGenerator')    

    var AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;

    waterfall([
        
        (cb) => { //Get active version of product to be duplicated, without _id

        if(mongoose.Types.ObjectId.isValid(productId)) {  

          Product.findOne(
            {
              _id: productId
            },
            {
              _id: 0, 
              active: 1, 
              family: 1, 
              subfamily: 1, 
              measurementUnit: 1,
              kitchens:1,
              caducityFresh: 1,
              caducityFreeze:1,
              daysToUse:1,
              location: 1,
              versions: {$elemMatch: {active: true}}
            }
          )
          .exec((err, doc) => {
            if (err) return cb(err)
            cb(null, doc)
          })

        } else {
          let err = new Error("Must provide a valid Product id")
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
              let key = 'imgs/product/' + random_name + '-' + size.sizeCode + '.' + extension
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

            logger.info('Product controller :: duplicate - Retrieved product lang: %s', JSON.stringify(userLang));	

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

            		logger.info('Product controller :: duplicate - Created new product lang: %s', JSON.stringify(langObj));	
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

            		logger.info('Product controller :: duplicate - Created new product lang: %s', JSON.stringify(langObj));	
                activeVersion.lang.push(langObj)
            }

            cb(null, doc);

     }, (doc, cb) => { //Duplicate pricing rates

     		let pricingRates = [];

     		activeVersion.pricing.forEach((pricingRate) => {

     			let rate = new PricingRate();

     			rate.name = pricingRate.name;
     			rate.costOverPricePercentage = pricingRate.costOverPricePercentage;
     			rate.price = pricingRate.price;
     			rate.active = pricingRate.active;

     			pricingRates.push(rate)

     		})

     		activeVersion.pricing = pricingRates;
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

          //Calculate product composition reference and location cost for aggregate locations in composition list
          costHelper.calculateRecipeCompLocationCosts(activeVersion, doc.location, Product, (err, res) => {
              if(err) return cb(err)
              
              doc.versions[0].locationCost = res.locationCost;
              doc.versions[0].compositionCost = res.compositionCost;

              cb(null, doc)
          })

      }, (doc, cb) => {

          //Calculate product packaging reference and location cost for aggregate locations in packaging list
          costHelper.calculateRecipePackLocationCosts(activeVersion, doc.location, Product, (err, res) => {
              if(err) return cb(err)
              
              doc.versions[0].packLocCost = res.packLocCost;
              doc.versions[0].packagingCost = res.packagingCost;
              doc.versions[0].unitCost = res.unitCost;

              doc.versions[0].totalCost = doc.versions[0].packagingCost + doc.versions[0].compositionCost;

              cb(null, doc)
          })

      }, (doc, cb) => { //Calculate total location cost

          //recalculate sum of composition and packaging cost arrays
          locHelper.sumLocCostArrays(doc.versions[0].locationCost, doc.versions[0].packLocCost, (err, res) => {
              doc.versions[0].totalLocCost=res;
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

          doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber('003')
          
          let duplicate = new Product(doc);
          duplicate.save((err, dup) => {
          	if(err) return cb(err)
            cb(null, dup)
          })

      }, (dup, cb) => {

      	if(updateSubproductsLocationFlag) {

		        if (!dup.versions[0].composition.length) return cb (null, dup)
		        let parent = [];

		        locHelper.computeRecipeLocationsRecursively(dup._id, dup.location, Product, parent, (err, res) => {
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
 * @api {get} /product/locationcost Get product's cost by location
 * @apiGroup {product}
 * @apiName Get product location costs
 *
 * @apiDescription Get product location costs. First cost in the array is the reference unitCost.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * @apiParam {string} _id  Product id
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getLocationCost = (req, res) => {
    var productId = new ObjectId(req.query._id);
    var versionId = new ObjectId(req.query.versionId);    
    var userData = req.userData;
    var locationCostArray = [];
    var packLocCostArray= [];
    var totalLocCostArray = [];
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
    var product;
    var result;

    waterfall([
      (cb) => {

          Product.findOne(
            {
              _id: productId
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
            product = JSON.parse(JSON.stringify(doc));
            let activeVersion = product.versions[0];
            activeVersion.locationCost = [];
            activeVersion.packLocCost = [];
            activeVersion.totalLocCost = [];
            product.versions = activeVersion;
            //console.log(product, 'product')
            cb(null, doc)
          })

      	}, (doc, cb) => {
      		//console.log('entering 1st aggregate')
          Product.aggregate([
              {$match: {'_id': productId}},
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
									"compositionCost" : { "$addToSet": "$versions.compositionCost" },
									"netWeight" : { "$addToSet": "$versions.netWeight" },
									"packagingCost" : { "$addToSet": "$versions.packagingCost" }
								}
							},
							{
			   				$unwind: {
			   					path: "$compositionCost"
			   				}
			   			},
			   			{
			   				$unwind: {
			   					path: "$netWeight"
			   				}
			   			},
			   			{
			   				$unwind: {
			   					path: "$packagingCost"
			   				}
			   			}
          ], (err, doc) => {
                if (err) return cb(err)
                if (!doc) { 
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);
                }

                if(doc.length) {
	                	result = {
		                	_id: doc[0]._id,
		                	versions: { 
		                		locationCost: doc[0].locationCost,
		                		netWeight: doc[0].netWeight,
		                		compositionCost: doc[0].compositionCost,
		                		packagingCost: doc[0].packagingCost

		                	}
		                }
		                //console.log(result, 'result')
		                cb(null,doc)
	              } else {
	              	cb(null,doc)
	              }                
          })

      	}, (doc, cb) => {

      		//console.log('entering 2nd aggregate')

          Product.aggregate([
              {$match: {'_id': productId}},
              {$unwind:
                  {path: "$versions"}
              },
              {$match: {'versions.active': true}},
			   			{
			   				$unwind: {
			   					path: "$versions.packLocCost",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{$match: {"versions.packLocCost.location": {$in: userLocIds}}},
        			{ // Alternative to populate
			          "$lookup": {
			              "from": "locations",
			              "localField": "versions.packLocCost.location",
			              "foreignField": "_id",
			              "as": "versions.packLocCost.location"
			          }
        			},
							{
			   				$unwind: {
			   					path: "$versions.packLocCost.location",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{ 
        				"$group": {
									"_id": "$_id",
									"packLocCost": { "$push": "$versions.packLocCost" },
									"compositionCost" : { "$addToSet": "$versions.compositionCost" },
									"netWeight" : { "$addToSet": "$versions.netWeight" },
									"packagingCost" : { "$addToSet": "$versions.packagingCost" }
								}
							},
							{
			   				$unwind: {
			   					path: "$compositionCost"
			   				}
			   			},
			   			{
			   				$unwind: {
			   					path: "$netWeight"
			   				}
			   			},
			   			{
			   				$unwind: {
			   					path: "$packagingCost"
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
                	cb(null, doc)
                } else {
	                if(doc.length && !result) {
	                	result = {
		                	_id: doc[0]._id,
		                	versions: { 
		                		locationCost:  [],
		                		packLocCost: doc[0].packLocCost,
		                		netWeight: doc[0].netWeight,
		                		compositionCost: doc[0].compositionCost,
		                		packagingCost: doc[0].packagingCost

		                	}
	                	}
	                	//console.log(result, 'result')
	                	cb(null,doc)
		              } else if(doc.length && result) {
	                	result.versions.packLocCost = doc[0].packLocCost;
	                	//console.log(result, 'result')
	                	cb(null,doc)
	                }
	              }               
          })          

      	}, (doc, cb) => {

      		//console.log('entering 3rd aggregate')

          Product.aggregate([
              {$match: {'_id': productId}},
              {$unwind:
                  {path: "$versions"}
              },
              {$match: {'versions.active': true}},
			   			{
			   				$unwind: {
			   					path: "$versions.totalLocCost",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{$match: {"versions.totalLocCost.location": {$in: userLocIds}}},
        			{ // Alternative to populate
			          "$lookup": {
			              "from": "locations",
			              "localField": "versions.totalLocCost.location",
			              "foreignField": "_id",
			              "as": "versions.totalLocCost.location"
			          }
        			},
							{
			   				$unwind: {
			   					path: "$versions.totalLocCost.location",
			   					preserveNullAndEmptyArrays: true
			   				}
			   			},
        			{ 
        				"$group": {
									"_id": "$_id",
									"totalLocCost": { "$push": "$versions.totalLocCost" }
								}
							}
          ], (err, doc) => {
                if (err) return cb(err)
                if (!doc) { 
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);
                }

                if(!doc.length && !result) {
                	//console.log('result is undefined, sending product', product)
                	cb(null, product)
                } 
	                
	              if(doc.length && !result) {
		                result = {
		                	_id: doc[0]._id,
		                	versions: { 
	                			locationCost:  [],
	                			packLocCost: [],		                		
		                		totalLocCost: doc[0].totalLocCost,
		                		netWeight: doc[0].netWeight,
		                		compositionCost: doc[0].compositionCost,
		                		packagingCost: doc[0].packagingCost

		                	}
		                }
		             		//console.log(result, 'result')
		             		cb(null,result)

		              } else if(doc.length && result) {
	                	result.versions.totalLocCost = doc[0].totalLocCost;
	                	//console.log(result, 'result')
	                	cb(null,result)
	                }
	                
          })

      }, (doc, cb) => { //Get location cost array for composition costs

      		//console.log(doc, 'doc')
          if(doc.versions.locationCost&&doc.versions.locationCost.length) locationCostArray = doc.versions.locationCost; //add location prices to array

          locationCostArray = locationCostArray.filter((item) => { //remove items with cost zero
            return item.value!=0;
          })

          if(doc.versions.compositionCost && doc.versions.netWeight) {

            //Add unit cost as first element in the array
            let unitCostObject = {
              location: {name: 'Reference Cost'},
              unitCost: doc.versions.compositionCost
            } 
            locationCostArray.unshift(unitCostObject); //add ref unitcost to array    
          }        

          cb(null, doc)

      }, (doc, cb) => { //Get location cost array for packaging costs

          if(doc.versions.packLocCost&&doc.versions.packLocCost.length) packLocCostArray = doc.versions.packLocCost; //add location prices to array

          packLocCostArray = packLocCostArray.filter((item) => { //remove items with cost zero
            return item.unitCost!=0;
          })

          if(doc.versions.packagingCost && doc.versions.netWeight) {

            //Add unit cost as first element in the array
            let unitCostObject = {
              location: {name: 'Reference Cost'},
              unitCost: doc.versions.packagingCost
            } 
            packLocCostArray.unshift(unitCostObject); //add ref unitcost to array            
          }
          
          cb(null, doc)

      }, (doc, cb) => { //Get location cost array for total costs (packaging + composition)

          if(doc.versions.totalLocCost&&doc.versions.totalLocCost.length) totalLocCostArray = doc.versions.totalLocCost; //add location prices to array
          
          let packagingCost = doc.versions.packagingCost || 0;
          let compositionCost = doc.versions.compositionCost || 0;
          let calculatedCost;

          calculatedCost = packagingCost + compositionCost;

          // if(doc.versions.netWeight && doc.versions.netWeight!=0) {
            
          //   calculatedCost = (packagingCost + compositionCost) / doc.versions.netWeight;
          
          // } else {

          //   calculatedCost = 0;
          
          // }

          //Add unit cost as first element in the array
          let unitCostObject = {
            location: {name: 'Reference Cost'},
            unitCost: calculatedCost
          } 
          totalLocCostArray.unshift(unitCostObject); //add ref unitcost to array            

          cb(null, doc)

      }], (err, ok) => {

        	if(err) return res.status(500).json(err.message || 'Error').end();
          
          let response = {
            locationCost: locationCostArray,
            packLocCost: packLocCostArray,
            totalLocCost: totalLocCostArray
          }
          
          res.status(200).json(response).end();
      })
};


/**
 * @api {get} /product/locationallergens Get productes's allergens by location
 * @apiGroup {product}
 * @apiName Get productes location allergens
 *
 * @apiDescription Get productes location allergens. First allergens in the array is the reference allergens.
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
     let productId = new ObjectId(req.query._id);
     var versionId = new ObjectId(req.query.versionId);
     var userData = req.userData;
     var locationAllergensArray = [];
     var userLocations = req.userData.location;
     var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); });
     var product;

     waterfall([
         (cb) => {
             Product.aggregate([
                 { $match: { _id: productId } },
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
 * @api {get} /product/version/cooksteps Get cooking steps of product version
 * @apiGroup {product}
 * @apiName Get product
 *
 * @apiDescription Get a product version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  product id
 * @apiParam {string} versionId  product version id
 *
 * @apiSuccess {Object} product version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getCookingSteps = (req, res) => {
    //Gets the active version of all products that are in the user's zone.
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var productLocations;
    var productId = new ObjectId(params._id);
    var versionId = new ObjectId(params._versionId); //params.location is a string 

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the product's locations
        
        if(mongoose.Types.ObjectId.isValid(productId) && mongoose.Types.ObjectId.isValid(versionId)) {  

            Product.findById(productId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    let err=new Error("Document not found");
                    err.statusCode=404;
                    return cb(err)
                }
                productLocations=doc.location;
                    //Check whether list of product locations includes at least one customer location.
                    
                    var match = productLocations.find((id) => {
                        let locId = new ObjectId(id);
                        for(var i=0; i<userLocIds.length; i++) {
                            if (userLocIds[i].equals(locId)) return true;
                        }
                    });
                    if (match) { cb(null, match); }
                    else { 
                        var err = new Error('Access to product location is not allowed');
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
        Product.aggregate([
        {
            $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: "$versions.cookingSteps",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: "$versions.cookingSteps.lang",
                preserveNullAndEmptyArrays: true
            }
        },
        {$match: {'_id' : productId}},
        {$match: {'versions._id' : versionId}},
        {$match: {'versions.cookingSteps.lang.langCode': userProfile.user.language}},
            //{$match: {'versions.lang.langCode': userProfile.user.language}},
         // {
         //     $group: {
         //         "_id": "$versions.cookingSteps"
         //     }
         // },
         {
             $group: {
                 "_id": "$_id",
                 "cookingSteps": {$push: "$cookingSteps"}
             }
         },
         ], (err, doc) => {
            if (err) {
                return cb(err)
            }
            Product.populate(doc, 
                {path: "process _id.utensil _id.gastroCheckpoint _id.criticalCheckpoint images"
                 //,match: {'versions.cookingSteps.lang.langCode': userProfile.user.language}
             }, (err, doc) => {
                if (err) {
                    return cb(err)
                }
                cb(null, doc)
            });
        })
    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });
};

/**
 * @api {get} /product/pricingrates Gets pricing rates of active version of product
 * @apiGroup {product}
 * @apiName Get Product's Pricing Rates
 *
 * @apiDescription Gets pricing rates of active version of product
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Product id
 *
 * @apiSuccess {Object} .  Product pricing rates
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getPricingRates = (req , res) => {
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var productId = new ObjectId(params._id);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var pricingRates=[];
    waterfall([
        (cb) => {
            Product.aggregate([
                {$unwind: {path: "$versions"}},
                {$match: {'location': {$in: userLocIds}}},
                {$match: {'_id': productId}},
                {$match: {'versions.active': true}}
            ], (err, doc) => {
                    if (err) return cb(err)
                    if (doc.length<1) {
                        let err=new Error("Document not found");
                        err.statusCode=404;
                        return cb(err)
                    }
                    cb(null,doc)
            })
        },(doc, cb) => {

            //Add pricing rates included in pricing array, if any
            if(doc[0]&&doc[0].versions.pricing&&doc[0].versions.pricing.length>0) {
              
              doc[0].versions.pricing.forEach(function(rate) {
                pricingRates.push(rate);
              })

              //sort based on name
              pricingRates.sort(function(a,b) {
                if (a.name < b.name)
                return -1;
                if (a.name > b.name)
                    return 1;
                return 0;
              });
            }

            //Add reference price
            if(doc[0]&&doc[0].versions.refPrice) {
                let refPriceObj = {
                    name: 'Default',
                    price: doc[0].versions.refPrice
                }
                pricingRates.splice(0,0,refPriceObj);
            } else {
                let refPriceObj = {
                    name: 'Default',
                    price: 0
                }
                pricingRates.splice(0,0,refPriceObj);
            }

            cb(null, pricingRates)

        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })

};

/**
 * @api {get} /dish/dishingastrooffers get Active Version of dish there are in gastroOffers
 * @apiGroup {dish}
 * @apiName get Product Active Version in GastroOffer
 *
 * @apiDescription get Product Version in GastroOffers
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _dishtId _versionId Product id Product version id 
   
 *
 * @apiSuccess {Object} List of GastroOffers that contains our dish active version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getProductInGastroOffers=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    var productId = new ObjectId(params._id);
    params.filterText = params.filterText || '';
    var sortField = params.sortField || 'versions.lang.name';
    if(sortField == '') sortField = 'versions.lang.name'
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
    var page = params.page
    var perPage = params.perPage
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var productsInGastroOffers=[];
    let object;
    var totalItems = 0;
    var inGastroOffer = []
    var totalElements = []
    let filteredInProducts;
    let filterGastroOffer;
    let gastroObjects = []
    var filterLocation;
    var filterLocationPipeline;    

    waterfall([
        (cb) => {

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

            GastroOffer.aggregate([
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
            { // Alternative to populate
              "$lookup": {
                  "from": "families",
                  "localField": "versions.type",
                  "foreignField": "_id",
                  "as": "versions.type"
              }
            },
            { // Alternative to populate
              "$lookup": {
                  "from": "families",
                  "localField": "versions.season",
                  "foreignField": "_id",
                  "as": "versions.season"
              }
            },
            {$match: {'versions.composition.element.item' : productId}},
            {$match: {'versions.lang.langCode': userProfile.user.language}},
            {$match: {'location': {$in: userLocIds}}},
            {$match: filterLocationPipeline},
            {$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}},
            {
               $group: {
                   "_id": "$_id",
                   "active": {$push: "$active"},
                   "ref": {$push:"$ref"},
                   "type": {$push:"$type"},
                   "referenceNumber": {$push:"$referenceNumber"},
                   "location": {$push:"$location"},
                   "versions": {$push: "$versions"}
               }
            }], (err, count) => {
                if(err) return cb_async(err)
                totalItems += count.length
                cb(null,totalItems)  
              })

        },(doc,cb)=>{

            GastroOffer.aggregate([
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
            { // Alternative to populate
              "$lookup": {
                  "from": "families",
                  "localField": "versions.type",
                  "foreignField": "_id",
                  "as": "versions.type"
              }
            },
            { // Alternative to populate
              "$lookup": {
                  "from": "families",
                  "localField": "versions.season",
                  "foreignField": "_id",
                  "as": "versions.season"
              }
            },
            {$match: {'versions.composition.element.item' : productId}},
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
                   "active": {$push: "$active"},
                   "ref": {$push:"$ref"},
                   "type": {$push:"$type"},
                   "referenceNumber": {$push:"$referenceNumber"},
                   "location": {$push:"$location"},
                   "versions": {$push: "$versions"}
               }
            },
            {$sort: { [sortField] : sortOrder }}

            ], (err, docs) => {

                if(err) return cb(err)

                if(docs && docs.length){

                    gastroObjects = []

                    docs.forEach((gastroOffer)=>{

                        let activeVersion = gastroOffer.versions.shift();

                        let object = {
                            _id: gastroOffer._id,
                            active: gastroOffer.active[0],
                            ref: gastroOffer.ref[0],
                            type: gastroOffer.type[0],
                            referenceNumber: gastroOffer.referenceNumber[0],
                            location: gastroOffer.location[0],
                            versions: gastroOffer.versions,
                            activeVersion: activeVersion
                        }

                        inGastroOffer.push(object)
                    })

                    productsInGastroOffers = [{gastroOffers: inGastroOffer, totalElements: totalItems}]
                    cb(null,productsInGastroOffers)

                } else {

                    productsInGastroOffers = [{gastroOffers:[],totalElements:0}]

                    cb(null,productsInGastroOffers)
                }

            })

        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
 }


  /**
 * @api {get} /product/refreshAllergens compute allergens of all products.
 * @apiGroup {product}
 * @apiName compute products allergens 
 *
 * @apiDescription compute allergens of all products.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

  exports.refreshAllergens=(req,res)=> {

  	var refreshAllergensQueue = require('../queues/refreshAllergens')

    refreshAllergensQueue.refreshAllergens(
      {
        title: 'Refresh Product Allergens ',
        model: 'Product' 
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
        title: 'Refresh Product Composition Costs ',
        model: 'Product' 
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

  exports.refreshPackCosts=(req,res)=>{

    var refreshProductsPackCosts = require('../queues/refreshProductsPackCosts')

    refreshProductsPackCosts.refreshProductsPackCosts(
      {
        title: 'Refresh Product Packaging Costs '
      }
    ); 
    res.status(200).end();
  }


/**
 * @api {delete} /product/productingastrooffers delete a product associated to gastroOffer
 * @apiGroup {product}
 * @apiName delete product in gastroOffer 
 *
 * @apiDescription delete product in gastroOffer composition
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} productId product id gastrOfferId gastroOffer id gastroOfferVersionId gastroOffer Versions id 
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.deleteProductInGastroOffers=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    var productId = new ObjectId(params.productId);
    var gastroOfferId = new ObjectId(params.gastroOfferId);
    var gastroOfferVersionId = new ObjectId(params.gastroOfferVersionId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var productInGastroOffer=[];
    var GastroOffer = require('../models/gastroOffer');
    let indexArray = []

      async.waterfall([

        (cb)=>{

          GastroOffer.findOne({'_id': gastroOfferId})
               .exec((err,doc)=>{

                  if(err) return cb(err)
                  if(!doc) cb(null,true)
                  if(doc){
                    console.log(doc,'doc')

                    doc.versions.forEach((version)=>{

                      if(version._id.equals(gastroOfferVersionId)){

                        version.composition.forEach((composition, index)=>{

                          let i = index
                          //console.log(composition.element.item,'element.item ==', ingredientId,'ingredientId')
                          if(composition.element.item.equals(productId)) {
                            console.log(index,'index')
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

          GastroOffer.update({_id: doc._id},doc,(err)=>{
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
 * @api {delete} /product/all delete all versions where dish associated to gastroOffer.
 * @apiGroup {dish}
 * @apiName delete dish in  all gastroOffer versions 
 *
 * @apiDescription delete dish in gastroOffer composition versions
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} dishId dish id gastroOfferId gastroOffer id
 *
 * @apiSuccess {Object} success reponse (200)
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.deleteAllProductInGastroOffers=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    console.log(req.body,'reqBody')
    console.log(req.query,'reqQuery')
    var product = new ObjectId(params.productId);
    var gastroOffer = new ObjectId(params.gastroOfferId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var productInGastroOffer=[];
    var GastroOffer = require('../models/gastroOffer');
    let indexArray = [];

      async.waterfall([

        (cb)=>{
            console.log(gastroOffer,'gastroOfferAPI')
          GastroOffer.findOne({'_id': gastroOffer})
                     .populate("versions.composition")
                     .sort({'versions.updatedAt': -1})
               .exec((err,doc)=>{

                  if(err) return cb(err)
                  if(!doc) cb(null,true)
                  if(doc){
                    console.log(doc,'docInit')

                    doc.versions.forEach((version, index)=>{
                        let i = index
                        if(version.composition.length){

                            version.composition.forEach((composition)=>{

                                if(composition.element.item.equals(product)) {
                                    //console.log(version,'versionMatchToDeleted')
                                    console.log(i,'i')
                                    if(version.active == false) indexArray.push(i)
                                }

                            })

                        } 

                        
                    })
                    console.log(indexArray,'indexArray')

                    indexArray.forEach((index)=>{
                        doc.versions.splice(index,1)
                    })
                    console.log(doc,'docFinish')
           
                    cb(null,doc)
                  }

               })

        },(doc,cb)=>{
          //console.log(recipe.versions.composition,'recipe')
          //console.log(doc.versions.composition,'doc')

          GastroOffer.update({_id: doc._id},doc,(err)=>{
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
 * @api {get} /product/restrictpricingrate Checks whether the product pricing rate can be removed
 * @apiGroup {product}
 * @apiName Checks whether the product pricing rate can be removed
 *
 * @apiDescription Checks whether the product pricing rate can be removed
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Pricing rate id
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.restrictPricingRate = (req , res) => {
    let userProfile = req.userData;
    let params = req.query;
    var pricingRateId = new ObjectId(params._id);  

    waterfall([
        (cb) => {
            GastroOffer.aggregate([
                {$unwind:
                    {path: "$versions"}
                },
                {$match: {'versions.composition.pricingRate': pricingRateId}}
            ], (err, docs) => {
                    if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                      var err = new Error('Pricing rate can not be removed because it is used in at least one gastronomic offer');
                      err.statusCode = 400;
                      return cb(err);
                    } else {
                      cb(null, true);
                    }
            })
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
            Product.find({}, (err, docs) => {
                //console.log(docs,'DOCS')
                if (err) { 
                    return cb(err) 
                }
                cb(null,docs);
            });
        }, (docs, cb) => {
            //console.log('entering GET',docs.length)
                async.eachSeries(docs,function(product,cb_async){
                    
                    function generateReferenceNumber() {
                        
                        return function() {
                            
                              product.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(config.refNumberPrefixes.product)
                              
                                if(product.referenceNumber){

                                    //console.log(product.referenceNumber,'Reference Number of Product')
                                    
                                    product.save((err)=>{
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