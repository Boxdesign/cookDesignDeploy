'use strict';
var Location =  require('../models/location');
var {ObjectId} = require('mongodb');
var async = require('async');
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var Subproduct = require('../models/subproduct');
var Drink = require('../models/drinks');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.location;

//Checks whether two location arrays contain the same locations. Order does not matter.
exports.compareLocation = (locArray1, locArray2, cb) => {

    if(locArray1.length == locArray2.length) {
        let res = locArray1.every((loc1) => {
            let loc1Id=new ObjectId(loc1);
            return locArray2.some((loc2) => {
                let loc2Id=new ObjectId(loc2);
                return loc2Id.equals(loc1Id);
            })
        })
        cb(res);
    } else { //arrays do not have the same length, they are different
        cb(false);
    }
}

exports.deletedLocations = (locArray1, locArray2, cb) => {

    let deletedLocations = locArray2.filter(item => locArray1.indexOf(item.toString()) < 0);
  
    cb(deletedLocations);
}

//Gets index of price object based on location Id
exports.arrayPriceIndexOf = (priceArray, locationId) => {

	  if(priceArray && locationId) {
    
	    let locId = new ObjectId(locationId)
	    
	    for(var i = 0, len = priceArray.length; i < len; i++) {
	        let id = new ObjectId(priceArray[i].location)
	        if (id.equals(locId)) return i;
	    }
	    return -1;
	  } 
	  else
	  {
	  	if(!priceArray) logger.error('arrayPriceIndexOf - Error getting index of price object based on location Id. PriceArray is not defined.')
    	if(!locationId) logger.error('arrayPriceIndexOf - Error getting index of price object based on location Id. locationId is not defined.')
	  	return -1;
	  }
}

exports.findLocations = (priceArray, locationId) => {

      if(priceArray && locationId) {
    
        let locId = new ObjectId(locationId)
        
        for(var i = 0, len = priceArray.length; i < len; i++) {
            let id = new ObjectId(priceArray[i])
            if (id.equals(locId)) return i;
        }
        return -1;
      } 
      else
      {
        if(!priceArray) logger.error('findLocations - Error getting index of price object based on location Id. PriceArray is not defined.')
        if(!locationId) logger.error('findLocations - Error getting index of price object based on location Id. locationId is not defined.')
        return -1;
      }
}

exports.computeProviderArticleLocationLoop = (currentLoc, originalLoc, cb) => { 
		//Used in provider articles model
		//Computes array of current locations plus any deleted locations

    let deletedLocs=[];
    // let addedLocs=[];

    logger.info('Computing provider article location loop')

    //Find deleted locations
    originalLoc.forEach((orgLoc, index) => {
        let originalLocId = new ObjectId(orgLoc)
        let match = currentLoc.some((loc) => {
            let locId = new ObjectId(loc)
            return locId.equals(originalLocId)
        })
        if (!match) deletedLocs.push(orgLoc)
    })

    //Find added locations
    // currentLoc.forEach((loc, index) => {
    // 	let locId = new ObjectId(loc)
    // 	let match = originalLoc.some((orgLoc) => {
    // 		let originalLocId = new ObjectId(orgLoc)
    // 		return originalLocId.equals(locId)
    // 	})
    // 	if (!match) addedLocs.push(loc)
    // })

    let result = currentLoc.concat(deletedLocs);

    cb(result);
}

exports.locationIntersect = (locArray1, locArray2) => {

    var intersect = [];
    
    intersect = locArray1.filter((loc1) => {

        let loc1Id=new ObjectId(loc1);
        
        return locArray2.some((loc2) => {
            let loc2Id = new ObjectId(loc2)
            return loc1Id.equals(loc2Id)
        })
    })

    return intersect;
}

exports.computeLocationLoop = (currentPriceLoc, originalPriceLoc, cb) => { //Used in ingredient and packaging model and subproduct
    //Input parameters are arrays of objects. Each object has a location and value.

    let deletedLocs=[];
    let editedLocs=[];
    let addedLocs=[];

    logger.info('computeLocationLoop - Computing article (ingredient / packaging) location loop');
    logger.info('computeLocationLoop currentLocCost %j ', currentPriceLoc)
    logger.info('computeLocationLoop - originalLocCost %j', originalPriceLoc)

    //Find deleted locations
    originalPriceLoc.forEach((orgPriceLoc, index) => {
        let originalLocId = new ObjectId(orgPriceLoc.location)
        let match = currentPriceLoc.some((locPrice) => {
            let locId = new ObjectId(locPrice.location)
            return locId.equals(originalLocId) //must check that location
        })

        if (!match) { 
            let delLocObj = {
                location: orgPriceLoc.location,
                unitCost: orgPriceLoc.unitCost,
                status: 'delete'
            }            
            deletedLocs.push(delLocObj)
        }
    })

    //Find edited locations
    currentPriceLoc.forEach((locPrice, index) => {
        let locId = new ObjectId(locPrice.location)
        let match = originalPriceLoc.some((orgPriceLoc) => {
            let originalLocId = new ObjectId(orgPriceLoc.location)
            return locId.equals(originalLocId) && locPrice.unitCost != orgPriceLoc.unitCost //must check that location and value are the same
        })
        if (match) {
            let editLocObj = {
                location: locPrice.location,
                unitCost: locPrice.unitCost,
                status: 'edit'
            }             
            editedLocs.push(editLocObj)
        }
    })

    //Find added locations
    currentPriceLoc.forEach((locPrice, index) => {
        let locId = new ObjectId(locPrice.location)
        let match = originalPriceLoc.some((orgPriceLoc) => {
            let originalLocId = new ObjectId(orgPriceLoc.location)
            return originalLocId.equals(locId)
        })
        if (!match) {
            let addLocObj = {
                location: locPrice.location,
                unitCost: locPrice.unitCost,
                status: 'add'
            }
            addedLocs.push(addLocObj)
        }
    })

    let result = deletedLocs.concat(editedLocs);
    result = result.concat(addedLocs);

    logger.info('computeLocationLoop - locationLoop %j', result)

    cb(result);
}

exports.findRemovedLocations = (priceArray, originalPriceArray, cb) => { //Used in quartering helper
    var removedLocations = []
    originalPriceArray.forEach((originalPrice) => {
        let originalPriceLoc = new ObjectId(originalPrice.location)
        let match = false;
        if (priceArray.length > 0) {
            match = priceArray.some((price) => {
                let priceLoc = new ObjectId(price.location)
                return originalPriceLoc.equals(priceLoc)
            })
        }
        if (!match) removedLocations.push(originalPrice.location);
    })
    cb(removedLocations)
}


exports.calculateAggregateCompLocation = (recipeVersion, callback) => {
    //Location array is an array of objects with the following structure
    //[{locationCost: [...]},{locationCost: [...]}

		let locationCost = [];
		let unitCost = 0;
		let costPerServing = 0;
		let compositionCost = 0;
		let subproductLocCostArray = [];
		let ingredientLocCostArray = [];
		let recipeLocCostArray = []
		let conversionTable;
		let locationLoop;
		var Subproduct = require('../models/subproduct');
		var Ingredient = require('../models/ingredient');

		logger.info('calculateAggregateCompLocation - Entering method')

		async.waterfall([

			(cb) => { //Get conversion table

				costHelper.getConversionTable((err, table) => {
					conversionTable = table;
					cb(null, true);
				})

			},(ok, cb) => {

				//Get location cost arrays of subproducts in composition list

				let subproductArray = recipeVersion.composition.filter((compElement) => {
					return compElement.element.kind == 'subproduct'
				})

				let subproductIdArray = subproductArray.map((compElement) => {
					return new ObjectId(compElement.element.item);
				})

				logger.info('calculateAggregateCompLocation - Calculated array of subprod Ids in composition list %s. Recipe Version: %s ', subproductIdArray, recipeVersion._id)

				Subproduct.aggregate([
		 			{
		 				$unwind: {
		 					path: '$versions',
		 					preserveNullAndEmptyArrays: true
		 				}
		 			},
					{ $match: { '_id': {$in: subproductIdArray}}},
					{ $match: { 'versions.active': true}}
					], (err, subps) => {
						
						if(err) cb(err)
						logger.info('calculateAggregateCompLocation - Obtained subproduct docs in composition list. Recipe Version: %s ', recipeVersion._id)
						cb(null, subps)
					})

			}, (docs, cb) => { //docs is list of subproducts (filtered with active version)

					docs.forEach((doc) => {
						if(doc.versions.locationCost) {
							let subpLocs = doc.versions.locationCost.map((loc) => {
								return loc.location;
							})
							subproductLocCostArray = subproductLocCostArray.concat(subpLocs)
						}
					})

					logger.info('calculateAggregateCompLocation - Computed cost locations of subproducts %s. Recipe Version: %s ', subproductLocCostArray, recipeVersion._id)
					cb(null, docs)

			}, (docs, cb) => { //Get location cost arrays of ingredients in composition list

				let ingArray = recipeVersion.composition.filter((compElement) => {
					return compElement.element.kind == 'ingredient'
				})

				let ingIdIdArray = ingArray.map((compElement) => {
					return compElement.element.item;
				})

				logger.info('calculateAggregateCompLocation - Calculated array of ing Ids in composition list %s. Recipe Version: %s ', ingIdIdArray, recipeVersion._id)

				Ingredient.find(
					{ 
						'_id': {$in: ingIdIdArray}
					}, (err, ings) => {
						if (err) cb(err)
						logger.info('calculateAggregateCompLocation - Obtained ingredient docs in composition list. Recipe Version: %s ', recipeVersion._id)
						cb(null, ings)
				})

			}, (docs, cb) => { //Compute aggregate location which will be the location loop

					docs.forEach((doc) => {
						if(doc.locationCost) {
							let ingLocs = doc.locationCost.map((loc) => {
								return loc.location;
							})
							ingredientLocCostArray = ingredientLocCostArray.concat(ingLocs)
						}
					})

					logger.info('calculateAggregateCompLocation - Computed cost locations of ingredients %s. Recipe Version: %s ', ingredientLocCostArray, recipeVersion._id)

					//Concat subproduct and ingredient arrays to get list locationCost arrays in recipe's version composition list
					recipeLocCostArray = subproductLocCostArray.concat(ingredientLocCostArray)

					logger.info('calculateAggregateCompLocation - Computed cost locations of subproducts and ingredients combined. Recipe Version: %s ', recipeLocCostArray, recipeVersion._id)

					//remove duplicates
					locationLoop = exports.removeDuplicates(recipeLocCostArray)

					//format array
					locationLoop = locationLoop.map((loc) => {
						let locObj = {
							location: loc
						}
						return locObj;
					})

					//Add reference cost to first place in location loop
					let refCostObj = {
							location: null
						}
					locationLoop.unshift(refCostObj)

					logger.info('calculateAggregateCompLocation - Computed location loop by removing duplicates %s. Recipe Version: %s ', locationLoop, recipeVersion._id)

					cb(null, docs)

		}], (err, doc) => {
		    if(err) callback(err)
		    logger.info('calculateAggregateCompLocation - calculated locationCost array for recipe version %s. Recipe Version: %s ', locationCost, recipeVersion._id)
		    callback(null, locationLoop)
		})

}

//Adds up two locationCost Arrays. Used in product recipes which have composition and packaging locationCost arrays.
exports.sumLocCostArrays = (arr1, arr2, cb) => {
  let sumLocCostArray = [];
  let locCostArray1 = [];
  let locCostArray2 = [];

  locCostArray1 = locCostArray1.concat(arr1)
  locCostArray2 = locCostArray2.concat(arr2)

  //First pass in one direction. Find locations included in both arrays and add them up, as well as locations in
  //the first array that are not included in the second array.

  logger.info('sumLocCostArrays - Entering method')
  logger.info('sumLocCostArrays - locCostArray1 %s', locCostArray1)
  logger.info('sumLocCostArrays - locCostArray2 %s', locCostArray2)

  
  if(locCostArray1.length || locCostArray2.length) {

    if(locCostArray1.length) {

      locCostArray1.forEach((loc1) => {
        let loc1Id = new ObjectId(loc1.location)
        let match = false;
        locCostArray2.forEach((loc2) => {
          let loc2Id = new ObjectId(loc2.location)
          if (loc2Id.equals(loc1Id)){
            let locObj = {
              location: loc1.location,
              unitCost: loc1.unitCost + loc2.unitCost
            }
            sumLocCostArray.push(locObj);
            match = true;
          }
        })
        if(!match) {
          let locObj = {
            location: loc1.location,
            unitCost: loc1.unitCost
          }
          sumLocCostArray.push(locObj);
        }
      })
    }

    //Second pass in the other direction. Add locations in second array that are not included in the first array.
    if(locCostArray2.length) {

      locCostArray2.forEach((loc2) => {
        let loc2Id = new ObjectId(loc2.location)
        let match = locCostArray1.some((loc1) => {
          let loc1Id = new ObjectId(loc1.location)
          return loc1Id.equals(loc2Id)
        })
        if(!match) {
          let locObj = {
            location: loc2.location,
            unitCost: loc2.unitCost
          }          
          sumLocCostArray.push(locObj);
        }
      })
    }
  }
  logger.info('sumLocCostArrays - finished calculations...')
  logger.info('sumLocCostArrays - sumLocCostArray %s', sumLocCostArray)

  cb(null, sumLocCostArray)
}

exports.removeDuplicates = (arr) => {
    var i, j, cur, found;
    for (i = arr.length - 1; i >= 0; i--) {
        cur = new ObjectId(arr[i]);
        found = false;
        for (j = i - 1; !found && j >= 0; j--) {
              let id = new ObjectId(arr[j])
            if (cur.equals(id)) {
                if (i !== j) {
                    arr.splice(i, 1);
                }
                found = true;
            }
        }
    }
    return arr;
};


exports.computeRecipeLocationsRecursively = (id, newLocations, Model, parent, callback) => {

  var Subproduct = require('../models/subproduct');
  var Product = require('../models/product');
  var Drink = require('../models/drinks');
  var Dish = require('../models/dish');
  var Ingredient = require('../models/ingredient');
  var activeVersion;
  var recipe;
	var addLocations = []

  logger.info('computeRecipeLocationsRecursively ---->>>> Entering method...');
  if(Model == Subproduct) logger.info('computeRecipeLocationsRecursively - Processing subproduct with id: %s', id)
  if(Model == Product) logger.info('computeRecipeLocationsRecursively - Processing product with id: %s', id)
  if(Model == Dish) logger.info('computeRecipeLocationsRecursively - Processing dish with id: %s', id)
  if(Model == Drink) logger.info('computeRecipeLocationsRecursively - Processing drink with id: %s', id)
  logger.info('computeRecipeLocationsRecursively - new locations: %s', newLocations);

    waterfall([
    (cb) => { //Get active version of recipe
        Model.findOne(
        {
          _id: id
        }
       )
        .exec((err, doc) => {
            if(err) {
            	logger.error(err)
            	return cb(err)
            }

            if(!doc.versions || !doc.versions.length) {
                logger.error('Subproduct %s does not have an active version!', doc._id)
                let err = new Error('Subproduct does not have an active version!')
                return cb(err)
            }
            logger.info('computeRecipeLocationsRecursively - Retrieved recipe.')
            recipe=doc;
            activeVersion=doc.versions.find((version) => {return version.active});

            if(activeVersion) cb(null, doc);
            else {
            	let err = new Error('computeRecipeLocationsRecursively - Recipe does not have active version. Skip.')
            	return cb(err)
            }
        })

    }, (doc, cb) => { //Populate ingredients and subproducts, and its locations

        async.each(activeVersion.composition, (compElement, cb_async) => {

            if(compElement.element.kind != 'subproduct') return cb_async();

            Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
                if (err) return cb_async(err)
                if(compElement.element.item != null) {
                    cb_async()
                } else {
                    logger.error('compElement.element.item is null, %s, skipping', compElement)
                    cb_async();
                }
            });
             
        }, (err) => { //finished async loop
            if(err) return cb(err)
            logger.info('computeRecipeLocationsRecursively - Finished populating recipe\'s subproduct elements')
            cb(null, doc);
        });


    }, (doc, cb) => { //Update locations of composition elements

        logger.info('computeRecipeLocationsRecursively - Starting loop to review subproducts in recipe composition elements.')
        async.eachSeries(activeVersion.composition, (compElement, cb_async) => {
            if(compElement.element.item) {

                if(compElement.element.kind != 'subproduct') {
   	            	logger.info('computeRecipeLocationsRecursively - composition element is an ingredient. Skip.')
                	return cb_async();
                }

                logger.info('computeRecipeLocationsRecursively - Composition element is a subproduct with id %s', compElement.element.item._id)
                let subproductId = new ObjectId(compElement.element.item._id)
                //console.log(parent, 'parent')
                let match = parent.some((_id) => {
                    let id = new ObjectId(_id);
                    return id.equals(subproductId)
                })

                if(match) {

                    logger.error('computeRecipeLocationsRecursively - Circular loop detected when calculating subproduct\'s locations in recipe.')
                    process.nextTick(()=>cb_async());

                } else {

                		logger.info('computeRecipeLocationsRecursively - Calling computeRecipeLocationsRecursively method...')
                    parent.push(compElement.element.item._id); //Compute locations of subproduct
                    exports.computeRecipeLocationsRecursively(compElement.element.item._id, newLocations, Subproduct, parent, (err, locations) => {
                        parent.pop()
                        if(err){
                            logger.error('computeRecipeLocationsRecursively - Error calculating computeRecipeLocationsRecursively of recipe %s', id)
                            cb_async()
                        } 
                        cb_async()
                    })                    
                }                    
            } else {
                logger.error('computeRecipeLocationsRecursively - Composition element item %s is null. skipping.', compElement)
                cb_async();
            }
        }, (err) => {
            logger.info('computeRecipeLocationsRecursively - Finished loop to review subproducts in recipe composition elements.')
            cb(null, doc);
        }) 

    }, (doc, cb) => {

          newLocations.forEach((loc) => {
          	let matchLoc = recipe.location.some((x) => { return x.equals(loc)}); 
          	if (!matchLoc) addLocations.push(loc)
          })  
          logger.info('computeRecipeLocationsRecursively - calculated addLocations array: %j', addLocations)                             

          if (!addLocations.length) {
          	logger.info('computeRecipeLocationsRecursively - Recipe %s includes all locations', recipe.versions[0].lang[0].name)
          	cb(null, true);
          }
          else
          {
	          logger.info('computeRecipeLocationsRecursively - Recipe %s does not include locations %j', recipe.versions[0].lang[0].name, addLocations)

	          activeVersion.composition.forEach((compElement)=> {
	          	//Depopulate composition elements that are subproducts, ingredients are not populated.
	          	if(compElement.element.kind == 'subproduct' && compElement.element.item._id) compElement.element.item = compElement.element.item._id
	          })

	          recipe.location = recipe.location.concat(addLocations);

	          costHelper.calculateRecipeCompLocationCosts(activeVersion, recipe.location, Model, (err, res) => {
	              if(err) {
	              	logger.error('computeRecipeLocationsRecursively - Error calculating recipe comp location costs')
	              	logger.error(err)
	              	return cb(err)
	              }
	              activeVersion.locationCost = res.locationCost;
	              activeVersion.unitCost = res.unitCost;
	              logger.info('computeRecipeLocationsRecursively - recalculated recipe location costs')
	            	logger.info('computeRecipeLocationsRecursively - locationCost: %j',res.locationCost )
	            	logger.info('computeRecipeLocationsRecursively - unitCost: %s',res.unitCost )
	              cb(null, true)
	          })          	
          }

    }, (doc, cb) => { //Update locations of composition elements
        if (!addLocations.length) {
        	logger.info('computeRecipeLocationsRecursively - No need to save recipe, skip to last step.')
        	cb(null, true);
        }
        else
        {
	        recipe.save((err) => {
	          if(err) return cb(err);
	          logger.info('computeRecipeLocationsRecursively - saved the recipe %s', id)
	          cb(null, true);                     
	      	})         	
        }

    }], (err, doc) => {
        if (err) {
        	logger.info('computeRecipeLocationsRecursively - Error executing method.')
        	logger.error(err)
        	return callback(err)
        }
        else
        {
	        logger.info('computeRecipeLocationsRecursively - successfully finished method for recipe %s', id)
	        callback(null, true)        	
        }
    }) 
}
