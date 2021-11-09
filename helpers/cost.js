var MeasurementUnit = require('../models/measurementUnit');
var Subproduct = require('../models/subproduct');
var Dish = require('../models/dish');
var Product = require('../models/product');
var Drink = require('../models/drinks');
var Ingredient = require('../models/ingredient');
var Packaging = require('../models/packaging');
var {ObjectId} = require('mongodb');
var async = require('async');
var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.costHelper;
//Calculates the reference cost and location cost array of a recipe version. Used when adding a new recipe version as well
//as when updating the composition cost of recipe versions when the reference cost has changed.

exports.calculateRecipeCompLocationCosts = (recipeVersion, recipeLocation, Model, callback) => {
		let locationCost = [];
		let unitCost = 0;
		let costPerServing = 0;
		let compositionCost = 0;
		let subproductLocCostArray = [];
		let ingredientLocCostArray = [];
		let recipeLocCostArray = []
		let conversionTable;
		var Subproduct = require('../models/subproduct');
		var Ingredient = require('../models/ingredient');
		var Dish = require('../models/dish');
		var Product = require('../models/product');
		var Drink = require('../models/drinks');
		const logger = loggerHelper.calculateRecipeCompLocationCosts;

		var locationLoop;

		logger.info('calculateRecipeCompLocationCosts - Entering method.... Recipe Version: %s ', recipeVersion._id)
		logger.info('calculateRecipeCompLocationCosts - recipeVersion %j',recipeVersion)

		switch(Model) {
			
			case Subproduct:
				logger.info('calculateRecipeCompLocationCosts - Model is Subproduct. Recipe Version: %s ', recipeVersion._id)
			break;
			
			case Product:
				logger.info('calculateRecipeCompLocationCosts - Model is Product. Recipe Version: %s ', recipeVersion._id)
			break;
			
			case Dish:
				logger.info('calculateRecipeCompLocationCosts - Model is Dish. Recipe Version: %s ', recipeVersion._id)
			break;
			
			case Drink:
				logger.info('calculateRecipeCompLocationCosts - Model is Drink. Recipe Version: %s ', recipeVersion._id)
			break;
			
			default:
				logger.info('calculateRecipeCompLocationCosts - Problem!!! Model is not defined. Recipe Version: %s ', recipeVersion._id)
			break;

		}

		async.waterfall([

			(cb) => { //Get conversion table

				exports.getConversionTable((err, table) => {
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

				logger.info('calculateRecipeCompLocationCosts - Calculated array of subprod Ids in composition list. Recipe Version: %s ', recipeVersion._id)

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
						
						if(err) return cb(err)
						logger.info('calculateRecipeCompLocationCosts - Obtained subproduct docs in composition list. Recipe Version: %s ', recipeVersion._id)
						cb(null, subps)
					})

			}, (subps, cb) => { //Update location cost array in composition elements that are subproducts

				recipeVersion.composition.forEach((compElement) => {

					let elementId = new ObjectId(compElement.element.item)

					subps.forEach((subp) => {

						let id = new ObjectId(subp._id);
						
						if(elementId.equals(id)) {
							compElement.locationCost = subp.versions.locationCost;
							compElement.unitCost = subp.versions.unitCost;
						}

					})

				})

				cb(null,subps)

			}, (docs, cb) => { //docs is list of subproducts (filtered with active version)

					docs.forEach((doc) => {
						if(doc.versions.locationCost) {
							let subpLocs = doc.versions.locationCost.map((loc) => {
								return loc.location;
							})
							subproductLocCostArray = subproductLocCostArray.concat(subpLocs)
						}
					})

					logger.info('calculateRecipeCompLocationCosts - Computed cost locations of subproducts. Recipe Version: %s ', recipeVersion._id)
					cb(null, docs)

			}, (docs, cb) => { //Get location cost arrays of ingredients in composition list

				let ingArray = recipeVersion.composition.filter((compElement) => {
					return compElement.element.kind == 'ingredient'
				})

				let ingIdIdArray = ingArray.map((compElement) => {
					return compElement.element.item;
				})

				logger.info('calculateRecipeCompLocationCosts - Calculated array of ing Ids in composition list. Recipe Version: %s ', recipeVersion._id)

				Ingredient.find(
					{ 
						'_id': {$in: ingIdIdArray}
					}, (err, ings) => {
						if (err) return cb(err)
						logger.info('calculateRecipeCompLocationCosts - Obtained ingredient docs in composition list. Recipe Version: %s ', recipeVersion._id)
						cb(null, ings)
				})

			}, (ings, cb) => { //Update location cost array in composition elements that are ingredients

				recipeVersion.composition.forEach((compElement) => {

					let elementId = new ObjectId(compElement.element.item)

					ings.forEach((ing) => {

						let id = new ObjectId(ing._id);
						
						if(elementId.equals(id)) {
							compElement.locationCost = ing.locationCost;
							compElement.unitCost = ing.referencePrice;
						}

					})

				})

				cb(null, ings)

			}, (docs, cb) => { //If recipeLocation not provided, compute aggregate location which will be the location loop

					if(recipeLocation) {

						locationLoop = recipeLocation.map((loc) => {
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

  					logger.info('Location loop is recipe location array: %j', locationLoop)
					}
					else
					{
							docs.forEach((doc) => {
								if(doc.locationCost) {
									let ingLocs = doc.locationCost.map((loc) => {
										return loc.location;
									})
									ingredientLocCostArray = ingredientLocCostArray.concat(ingLocs)
								}
							})

							logger.info('calculateRecipeCompLocationCosts - Computed cost locations of ingredients. Recipe Version: %s ', recipeVersion._id)

							//Concat subproduct and ingredient arrays to get list locationCost arrays in recipe's version composition list
							recipeLocCostArray = subproductLocCostArray.concat(ingredientLocCostArray)

							logger.info('calculateRecipeCompLocationCosts - Computed cost locations of subproducts and ingredients combined. Recipe Version: %s ', recipeVersion._id)

							//remove duplicates
							locationLoop = locHelper.removeDuplicates(recipeLocCostArray)

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

							logger.info('calculateRecipeCompLocationCosts - Location loop: %j', locationLoop)

							logger.info('calculateRecipeCompLocationCosts - Computed location loop by removing duplicates. Recipe Version: %s ', recipeVersion._id)

					}
					cb(null, docs)

			}, (docs, cb) => { 

					//Go over location loop for each recipe version. We know from how locationLoop is calculated, that there is at least one composition element 
					//for each location in locationLoop
					locationLoop.forEach((loc) => {

			      logger.info('calculateRecipeCompLocationCosts - Evaluating location %j. Recipe Version: %s ', loc, recipeVersion._id)

						totalCost = 0;	

						//Calculate costs of all elements using conversion table
						recipeVersion.composition.forEach((recipeElement) => {													

								let unitCost;
								let index;
								logger.info('calculateRecipeCompLocationCosts - Evaluating recipeElement: %s. Recipe Version: %s ', recipeElement.element.item, recipeVersion._id)

								//--------------    SET UNIT COST OF ELEMENT FOR CALCULATIONS  ---------------------- //
								
								//Find location cost in location array and set unitCost to that value. If not available use reference price.

								logger.info('calculateRecipeCompLocationCosts - Finding location cost in location array and set unitCost to that value. Recipe Version: %s ', recipeVersion._id)
								//logger.info('recipeElement.locationCost: %j', recipeElement.locationCost)
								logger.info('calculateRecipeCompLocationCosts - loc.location %s', loc.location)

								if(recipeElement.locationCost) {

									if(loc.location != null) {
											//update locationCost array. Get array index for that location and update value
										  index = locHelper.arrayPriceIndexOf(recipeElement.locationCost, loc.location);

											if(index>-1) { //There's a match! 

												unitCost = recipeElement.locationCost[index].unitCost;
												locationMatch = true;

												logger.info('calculateRecipeCompLocationCosts - Found location in location Array. Using location cost: %s as unit cost. Recipe Version: %s ', unitCost, recipeVersion._id)

		                    if(!unitCost) {
		                  		unitCost = recipeElement.unitCost || 0;
		                  		recipeElement.locationCost.splice(index, 1)
		                  		logger.error('Location cost is undefined. Removing from location cost and setting cost to referenceCost. Recipe version id %s', recipeVersion._id)	
		                  	}
											
											} else { //no match, use reference cost
													unitCost = recipeElement.unitCost || 0;
													logger.info('calculateRecipeCompLocationCosts - Could not find location in location Array. Using reference cost: %s as unit cost. Recipe Version: %s ', unitCost, recipeVersion._id)
											}
									}
									else
									{
										unitCost = recipeElement.unitCost || 0;
										logger.info('calculateRecipeCompLocationCosts - Reference cost. Using reference cost: %s as unit cost. Recipe Version: %s ', unitCost, recipeVersion._id)

									}

								} else { //Recipe element does not have a locationArray. Set unitCost to referenceCost.
									unitCost = recipeElement.unitCost || 0;
									logger.info('calculateRecipeCompLocationCosts - Recipe element does not have a locationArray. Set unitCost to referenceCost: %s Recipe Version: %s ', unitCost, recipeVersion._id)
								}	

								//--------------   CALCULATE RECIPE ELEMENT COST  ---------------------- //

				  			if(recipeElement.measuringUnit==null) { //measuring unit is an equivalence unit. Gross weight is already expressed in base unit.
			  					recipeElement.grossWeight = recipeElement.equivalenceUnit.quantity * recipeElement.quantity;
			  					recipeElement.calculatedCost = recipeElement.grossWeight * unitCost;	
				  			
				  			} else {
				  			
				  				let measuringUnitId = new ObjectId(recipeElement.measuringUnit);
				  				let baseUnitId = new ObjectId(recipeElement.baseUnit);
					  			if(!measuringUnitId.equals(baseUnitId)) { //measuring unit is different than base unit, so we need conversion factor
					  				//Find conversion quantity in convertion table. Start by finding base unit...
					  				conversionTable.find((x) => { 
					  					let convUnitId = new ObjectId(x.baseUnit._id) 
					  					if(convUnitId.equals(baseUnitId)) {
						  					//Now find the conversion quantity in conversions object
						  					x.conversions.find((c) => {
						  						let id = new ObjectId(c.convUnit._id);
						  						if(id.equals(measuringUnitId)) {
						  							let conversionQty = c.quantity;
						  							recipeElement.calculatedCost = recipeElement.grossWeight * conversionQty * unitCost;
						  						}  						
						  					})
						  				}
						  			})
					  			} else { //Measuring unit is equal to base unit, so there's no need for conversion
						  			//console.log('calculating calculatedCost: grossWeight= ' + recipeElement.grossWeight+ 'unit cost: '+recipeElement.unitCost)
						  			recipeElement.calculatedCost = recipeElement.grossWeight * unitCost;
						        logger.info('calculateRecipeCompLocationCosts - Composition element calculated cost: %s .Recipe Version: %s ', recipeElement.calculatedCost, recipeVersion._id)
					  			}
					  		}
					  		
				  			//Total Cost calculated to recipe version and location
				  			if(recipeElement.calculatedCost) totalCost+=recipeElement.calculatedCost;
				  		
				  		}) //End of recipe composition loop

						  //------------------  ADD UNIT COST TO LOCATION COST ARRAY ---------------------------------------//

					    logger.info('calculateRecipeCompLocationCosts - Total version cost: %s for location: %s. Recipe Version: %s ', totalCost, loc.location, recipeVersion._id)

					    if(loc.location == null) { //Reference cost
						    
						    switch(Model) {

						    	case Subproduct:
								    
								    if(recipeVersion.netWeight && recipeVersion.netWeight!=0) {

									    unitCost = totalCost/recipeVersion.netWeight;

				 					    logger.info('calculateRecipeCompLocationCosts - Calculated unit cost of recipe version: %s for location: %s.Recipe Version: %s ', unitCost, loc.location, recipeVersion._id)

										} else {
				 					    
				 					    logger.info('calculateRecipeCompLocationCosts - Could not calculate unit cost of recipe version because netWeight is not defined or zero. Recipe Version: %s ', recipeVersion._id)
										
										}
										break;


						    	case Product:

							    	compositionCost = totalCost;
                    let packagingCost = recipeVersion.packagingCost || 0;

										unitCost = packagingCost + totalCost;
			 					    logger.info('calculateRecipeCompLocationCosts - Calculated reference unit cost %s', unitCost)                    
             //        if (recipeVersion.netWeight && recipeVersion.netWeight !=0) {								    	
								    	// unitCost = (packagingCost + totalCost) / recipeVersion.netWeight;
			 					    	//logger.info('calculateRecipeCompLocationCosts - Calculated reference unit cost %s', unitCost)
			              
			          //     } else 
			          //     {
			                //logger.info('calculateRecipeCompLocationCosts - Could not calculate reference unit cost of recipe version because formula inputs are missing.')
			               logger.info('calculateRecipeCompLocationCosts - netWeight %s', recipeVersion.netWeight)
			          //     }

						    	break;

						    	case Dish:
						    	case Drink:

								    if(recipeVersion.numServings && recipeVersion.numServings!=0) {

									    costPerServing = totalCost/recipeVersion.numServings;
							  		
				 					    logger.info('calculateRecipeCompLocationCosts - Calculated costPerServing of recipe version: %s for location: %s. Recipe Version: %s ', costPerServing, loc.location, recipeVersion._id)

										} else {
				 					    
				 					    logger.info('calculateRecipeCompLocationCosts - Could not calculate costPerServing of recipe version because numServings is not defined or zero. Recipe Version: %s ', recipeVersion._id)
										
										}    	

						    	break;

						    	default: 
				 					    logger.info('calculateRecipeCompLocationCosts - Problem!!! It is not identifying correct model. Recipe Version: %s ', recipeVersion._id)
						    	break;
						    }

					    } else { //Location cost

						    switch(Model) {

						    	case Subproduct:

								    if(recipeVersion.netWeight && recipeVersion.netWeight!=0) {

									    let calculatedUnitCost = totalCost/recipeVersion.netWeight;

							  		
											let locationCostObj = {
												location: loc.location,
												unitCost: calculatedUnitCost
											}
											
											locationCost.push(locationCostObj);
				 					    logger.info('calculateRecipeCompLocationCosts - Calculated and added unit cost of recipe version: %s for location: %s.Recipe Version: %s ', calculatedUnitCost, loc.location, recipeVersion._id)

										} else {
				 					    
				 					    logger.info('calculateRecipeCompLocationCosts - Could not add unit cost of recipe version because netWeight is not defined or zero. Recipe Version: %s ', recipeVersion._id)
										
										}
										break;		    		

						    	case Product:

										let locationCostObj = {
											location: loc.location,
											unitCost: totalCost
										}
										
										locationCost.push(locationCostObj);
			 					    logger.info('calculateRecipeCompLocationCosts - Calculated and added unit cost of recipe version: %s for location: %s.Recipe Version: %s ', totalCost, loc.location, recipeVersion._id)

						    		break;

						    	case Dish:
						    	case Drink:

								    if(recipeVersion.numServings && recipeVersion.numServings!=0) {

									    let calculatedUnitCost = totalCost/recipeVersion.numServings;
							  		
											let locationCostObj = {
												location: loc.location,
												unitCost: calculatedUnitCost
											}
											
											locationCost.push(locationCostObj);
				 					    logger.info('calculateRecipeCompLocationCosts - Calculated and added unit cost of recipe version: %s for location: %s.Recipe Version: %s ', calculatedUnitCost, loc.location, recipeVersion._id)

										} else {
				 					    
				 					    logger.info('calculateRecipeCompLocationCosts - Could not add unit cost of recipe version because numServings is not defined or zero. Recipe Version: %s ', recipeVersion._id)
										
										}    	

						    	break;

						    	default: 
				 					    logger.info('calculateRecipeCompLocationCosts - Problem!!! It is not identifying correct model. Recipe Version: %s ', recipeVersion._id)
						    	break;
						    }
						  }

					}) //end of sync location loop
					cb(null, true)

		}], (err, doc) => {

				if(err) return callback(err);

				logger.info('calculateRecipeCompLocationCosts - Finished calculations')
		    logger.info('calculateRecipeCompLocationCosts - calculated locationCost array %j for recipe version. Recipe Version: %s ', locationCost, recipeVersion._id)
		    logger.info('calculateRecipeCompLocationCosts - calculated unitCost %s for recipe version. Recipe Version: %s ', unitCost, recipeVersion._id)
		    logger.info('calculateRecipeCompLocationCosts - calculated costPerServing %s for recipe version. Recipe Version: %s ', costPerServing, recipeVersion._id)
		    logger.info('calculateRecipeCompLocationCosts - calculated compositionCost %s for recipe version. Recipe Version: %s ', compositionCost, recipeVersion._id)

		    let res = 
		    {
		    	locationCost: locationCost,
		    	unitCost: unitCost,
		    	costPerServing: costPerServing,
		    	compositionCost: compositionCost
		    }

		    callback(null, res)
		})

}


//Calculates the location cost array of a recipe version. Used when adding a new recipe version as well
//as whe updating the composition cost of recipe versions when the reference cost has changed.

exports.calculateRecipePackLocationCosts = (recipeVersion, recipeLocation, Model, callback) => {

		let packLocCost = [];
		let unitCost = 0;
		let packLocCostArray = [];
		let recipeLocCostArray = [];
		let Packaging = require('../models/packaging');
		let packagingCost = 0;

		logger.info('calculateRecipePackLocationCosts - Entering method...')
		//console.log('calculateRecipePackLocationCosts - Entering method...')

		async.waterfall([

			(cb) => { //Get location cost arrays of packagings in packagings list

				let packIdArray = recipeVersion.packaging.map((packElement) => {
					return packElement.packaging
				})

				logger.info('calculateRecipePackLocationCosts - Calculated array of pack Ids in packaging list')

				Packaging.find(
					{ 
						'_id': {$in: packIdArray}
					}, (err, packs) => {
						if (err) return cb(err)
						logger.info('calculateRecipePackLocationCosts - Obtained packaging docs in packaging list.')
						cb(null, packs)
				})

			}, (packs, cb) => { //Update location cost array in packagings in packaging list

				recipeVersion.packaging.forEach((packElement) => {

					let packId = new ObjectId(packElement.packaging)

					packs.forEach((pack) => {

						let id = new ObjectId(pack._id);
						
						if(packId.equals(id)) {
							packElement.locationCost = pack.locationCost;
							packElement.unitCost = pack.referencePrice;
						}

					})

				})

				logger.info('calculateRecipePackLocationCosts - Updated location cost array in packagings in packaging list.')
				//console.log('calculateRecipePackLocationCosts - Updated location cost array in packagings in packaging list.')

				cb(null, packs)

			}, (docs, cb) => {

					if(recipeLocation) {

						locationLoop = recipeLocation.map((loc) => {
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

  					logger.info('Location loop is recipe location array: %j', locationLoop)
					}
					else
					{
						docs.forEach((doc) => {
							if(doc.locationCost) {
								let packLocs = doc.locationCost.map((loc) => {
									return loc.location;
								})
								packLocCostArray = packLocCostArray.concat(packLocs)
							}
						})

						logger.info('calculateRecipePackLocationCosts - Computed cost locations of packagings.')
						//console.log('calculateRecipePackLocationCosts - Computed cost locations of packagings.')

						//remove duplicates
						locationLoop = locHelper.removeDuplicates(packLocCostArray)

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

						logger.info('calculateRecipePackLocationCosts - Computed location loop by removing duplicates.')
						//console.log('calculateRecipePackLocationCosts - Computed location loop by removing duplicates.')
					}

					cb(null, docs)

			}, (docs, cb) => { //Compute aggregate location which will be the location loop

					//Go over location loop for each recipe version. We know from how locationLoop is calculated, that there is at least one composition element 
					//for each location in locationLoop
					locationLoop.forEach((loc) => {

			      logger.info('calculateRecipePackLocationCosts - Evaluating location %j', loc)
			      //console.log('calculateRecipePackLocationCosts - Evaluating location ',loc)

						totalCost = 0;	

						//Calculate costs of all elements using conversion table
						recipeVersion.packaging.forEach((packElement) => {													

								let unitCost;
								let index;
								logger.info('calculateRecipePackLocationCosts - Evaluating packElement: %s', packElement.packaging)

								//--------------    SET UNIT COST OF ELEMENT FOR CALCULATIONS  ---------------------- //
								
								//Find location cost in location array and set unitCost to that value. If not available use reference price.

								logger.info('calculateRecipePackLocationCosts - Finding location cost in location array and set unitCost to that value.')
								logger.info('calculateRecipePackLocationCosts - packElement.locationCost %s',packElement.locationCost)
								logger.info('calculateRecipePackLocationCosts - loc.location %s', loc.location)

								if(packElement.locationCost&&loc.location) {
									//update locationCost array. Get array index for that location and update value
								  index = locHelper.arrayPriceIndexOf(packElement.locationCost, loc.location);

									if(index>-1) { //There's a match! 

										unitCost = packElement.locationCost[index].unitCost;
										locationMatch = true;

										logger.info('calculateRecipePackLocationCosts - Found location in location Array. Using location cost: %s as unit cost', unitCost)

                    if(!unitCost) {
                  		unitCost = packElement.unitCost || 0;
                  		packElement.locationCost.splice(index, 1)
                  		logger.error('Location cost is undefined. Removing from location cost and setting cost to referenceCost. Recipe version id %s', recipeVersion._id)	
                  	}       										
									
									} else { //no match, use reference cost
											unitCost = packElement.unitCost || 0;
											logger.info('calculateRecipePackLocationCosts - Could not find location in location Array. Using reference cost: %s as unit cost', unitCost)
									}

								} else { //Recipe element does not have a locationArray. Set unitCost to referenceCost.
									unitCost = packElement.unitCost || 0;
									logger.info('calculateRecipePackLocationCosts - Recipe element does not have a locationArray. Set unitCost to referenceCost: %s', unitCost)
								}	

								//--------------   CALCULATE RECIPE ELEMENT COST  ---------------------- //
					  		
				  			//Total Cost calculated to recipe version and location
								let numItems = packElement.numItems || 0;
                totalCost += unitCost * numItems;
				  		
				  		}) //End of recipe composition loop
						  //console.log('Finished recipe composition loop for recipeVersion ', recipeVersion._id)

						  //------------------  ADD UNIT COST TO LOCATION COST ARRAY ---------------------------------------//

					    logger.info('calculateRecipePackLocationCosts - Total version cost: %s for location: %s', totalCost, loc.location)
					    let calculatedUnitCost;

					    if (loc.location == null) { //reference cost

					    		let compositionCost;
					    		if(recipeVersion.compositionCost) compositionCost=recipeVersion.compositionCost; else compositionCost=0;

						    	packagingCost = totalCost;
						    	unitCost = compositionCost + packagingCost;
	 					    	logger.info('calculateRecipeLocationCosts - Calculated reference unit cost of %s', unitCost)

					    } else { //location cost
			  		
									let locationCostObj = {
										location: loc.location,
										unitCost: totalCost
									}
									
									packLocCost.push(locationCostObj);
							}

					}) //end of location loop
					//console.log('calculateRecipePackLocationCosts - End of location loop')
					cb(null, true)

		}], (err, doc) => {

				if(err) return callback(err)

		    let res = {
					packLocCost: packLocCost,
					unitCost: unitCost,
					packagingCost: packagingCost
		    }

 		    logger.info('calculateRecipeLocationCosts - calculated locationCost array %j', res)

		    //console.log('calculateRecipePackLocationCosts - result', res)
		    callback(null, res)
		})
}

//Updates reference price of ingredient with the average location price using filterLocation filter.
exports.calculateAvgArticleLocCostAndAllergens = (docs, filterLocation) => {

		var unitCost;
		var sumOfCosts;
		var totalAllergens = [];
		var allergens;

		if(docs && filterLocation && filterLocation.length) {

			logger.info('calculateAvgArticleLocCostAndAllergens - Entering method. Num of docs: ', docs.length)
			logger.info('calculateAvgArticleLocCostAndAllergens - filterLocation: %j', filterLocation)

	    docs.forEach((doc) => {

	    	 /* ----------------  LOCATION COST ---------------*/

	    		unitCost = 0;
	    		sumOfCosts=0;

    			logger.info('calculateAvgArticleLocCostAndAllergens - Evaluating article %s', doc._id)

    			if(doc.locationCost && doc.locationCost.length) {
        		
						filterLocation.forEach((loc) => {

							let locId = new ObjectId(loc._id || loc);

							let locMatch = doc.locationCost.find((locCost) => {
								let id = new ObjectId(locCost.location)
								return id.equals(locId)
							})

							if(locMatch){
								logger.info('calculateAvgArticleLocCostAndAllergens - Found a match in the article locationCost array.')
								unitCost = locMatch.unitCost;
							}
							else
							{
								logger.info('calculateAvgArticleLocCostAndAllergens - Did not find a match in the article locationCost array.')
								unitCost = doc.referencePrice;						
							}

							logger.info('calculateAvgArticleLocCostAndAllergens - unitCost %s', unitCost)

							sumOfCosts+=unitCost;
							logger.info('calculateAvgArticleLocCostAndAllergens -sum of unit costs %j',sumOfCosts)
						})

				  	doc.referencePrice = sumOfCosts / filterLocation.length;
						logger.info('calculateAvgArticleLocCostAndAllergens - Calculated composition element cost: %s', doc.referencePrice)
				}
				else
				{
					logger.warn('calculateAvgArticleLocCostAndAllergens - article has empty locationCost')
				}

     	  /* ----------------  ALLERGENS ---------------*/
 
    		if(doc.locationAllergens && doc.locationAllergens.length) {

						filterLocation.forEach((loc) => {

					    locId = new ObjectId(loc._id || loc);
					    let matchLocAllergens;
					    
					    if (doc.locationAllergens) {
						    matchLocAllergens = doc.locationAllergens.find((locAllergen) => {
						    	let id = new ObjectId(locAllergen.location);
						    	return id.equals(locId)
						    })		    	
					    }

					    if (matchLocAllergens) { //There's a match! 
					        logger.info('calculateAvgArticleLocCostAndAllergens - Found a match in the composition element locationCost array.')
					        allergens = matchLocAllergens.allergens;

					    } else { //no match, use reference cost

					        logger.info('calculateAvgArticleLocCostAndAllergens - Did not find a match in the composition element locationCost array.')
					        if (doc.allergens) {
					        	allergens = doc.allergens;		        	
					        } else {
					        	allergens = []
					        }

					    }

					    logger.info('calculateAvgArticleLocCostAndAllergens - allergens %j', allergens)

				      allergens.forEach((elementAllergenObj) => { 

			            let elementAllergObjectId = new ObjectId(elementAllergenObj.allergen);

			            if (totalAllergens.length > 0) { //If the updated allergen list is empty, just add the allergen otherwise check whether it exist and its level
			                let match = false;
			                totalAllergens.forEach((allergenObj) => {
			                    let allergObjectId = new ObjectId(allergenObj.allergen);
			                    if (elementAllergObjectId.equals(allergObjectId)) {
			                        //console.log('match is true')
			                        match = true;
			                        if (elementAllergenObj.level > allergenObj.level) {
			                            //Level is higher therefore update level
			                            allergenObj.level = elementAllergenObj.level;
			                        }
			                    }
			                })
			                if (!match) { //allergen is not in the list of allergens, add it.	
			                    let allObj = {
			                        allergen: elementAllergenObj.allergen,
			                        level: elementAllergenObj.level
			                    }
			                    totalAllergens.push(allObj);
			                }
			            } else { //totalAllergens is empty, just add the allergen
			                let allObj = {
			                    allergen: elementAllergenObj.allergen,
			                    level: elementAllergenObj.level
			                }
			                totalAllergens.push(allObj)
			            }
			        })

						})
						doc.allergens = totalAllergens;
				}
				else
				{
					logger.info('calculateAvgArticleLocCostAndAllergens - article does not have or has empty locationAllergens')
				}
	    })
	  } 
	  else 
	  {
	  	if(!docs) logger.error('calculateAvgArticleLocCostAndAllergens - docs is undefined. Skipping.')
	  	if(!filterLocation || !filterLocation.length) logger.error('calculateAvgArticleLocCostAndAllergens - filterLocation is undefined or empty. Skipping.')
	  }
}


//Caluclates location cost/allergens for composition element in recipe composition list based on filterLocation
exports.calculateCompElementAvgLocCostAndAllergens = (compElement, filterLocation, Model) => {

	var locLoop = [];
	var totalAllergens = [];
	var unitCost = 0;
	var sumOfCosts=0;
	var compElementCost = 0;
	var locId;
	var allergens;

	logger.info('calculateCompElementAvgLocCostAndAllergens - Entering method.')
  logger.info('calculateCompElementAvgLocCostAndAllergens - filterLocation input param %j', filterLocation)
  logger.info('calculateCompElementAvgLocCostAndAllergens - compElement location %s', compElement.location)

	// if(Model == Subproduct) { 
	// 	//Calulate location intersection between filterLocation and composition element location (key set in controller getVersion)
	// 	//Note: removed the intersection calculation because it led to confusion.
	// 	//locLoop = locHelper.locationIntersect(filterLocation, compElement.location)
	// 	locLoop = filterLocation;
		logger.info('calculateCompElementAvgLocCostAndAllergens - Composition element is a subproduct. Calculate location loop.')
	// } else if (Model == Ingredient){ //Ingredient, 
	// 	locLoop = filterLocation;
		logger.info('calculateCompElementAvgLocCostAndAllergens - Composition element is an ingredient.')
	// }

	if(!filterLocation) locLoop = [];
	else locLoop = filterLocation;

	logger.info('calculateCompElementAvgLocCostAndAllergens - Calculated location loop')

	if(locLoop.length) {

		//*****    Calculate average location Cost   ****//

		locLoop.forEach((loc) => {

	    locId = new ObjectId(loc._id || loc);

	    let matchLoc = compElement.locationCost.find((locCost) => {
	    	let id = new ObjectId(locCost.location);
	    	return id.equals(locId)
	    })		    	

			if(matchLoc) { //There's a match! 

				logger.info('calculateCompElementAvgLocCostAndAllergens - Found a match in the composition element locationCost array.')
				unitCost = matchLoc.unitCost;
			
			} else { //no match, use reference cost

				logger.info('calculateCompElementAvgLocCostAndAllergens - Did not find a match in the composition element locationCost array.')
				unitCost = compElement.unitCost;
			}

			logger.info('calculateCompElementAvgLocCostAndAllergens - unitCost %s', unitCost)

			sumOfCosts+=unitCost;
			logger.info('calculateCompElementAvgLocCostAndAllergens -sum of unit costs %j',sumOfCosts)
		})

  	logger.info('locLoop.length %s', locLoop.length)

  	compElementCost = sumOfCosts / locLoop.length;
		logger.info('calculateCompElementAvgLocCostAndAllergens - Calculated composition element cost: %s', compElementCost)

		compElement.unitCost = compElementCost;

		//***********  Calculate average (worst case scenario) allergens for location loop  ***//

		locLoop.forEach((loc) => {

		    locId = new ObjectId(loc._id || loc);
		    let matchLocAllergens;

		    if (compElement.locationAllergens) {
			    matchLocAllergens = compElement.locationAllergens.find((locAllergen) => {
			    	let id = new ObjectId(locAllergen.location);
			    	return id.equals(locId)
			    })		    	
		    }

		    if (matchLocAllergens) { //There's a match! 
		        logger.info('calculateCompElementAvgLocCostAndAllergens - Found a match in the composition element locationCost array.')
		        allergens = matchLocAllergens.allergens;

		    } else { //no match, use reference cost

		        logger.info('calculateCompElementAvgLocCostAndAllergens - Did not find a match in the composition element locationCost array.')
		        if (compElement.allergens) {
		        	allergens = compElement.allergens;		        	
		        } else {
		        	allergens = []
		        }
		    }

		    logger.info('calculateCompElementAvgLocCostAndAllergens - allergens %j', allergens)

	      allergens.forEach((elementAllergenObj) => { 

            let elementAllergObjectId = new ObjectId(elementAllergenObj.allergen);

            if (totalAllergens.length > 0) { //If the updated allergen list is empty, just add the allergen otherwise check whether it exist and its level
                let match = false;
                totalAllergens.forEach((allergenObj) => {
                    let allergObjectId = new ObjectId(allergenObj.allergen);
                    if (elementAllergObjectId.equals(allergObjectId)) {
                        //console.log('match is true')
                        match = true;
                        if (elementAllergenObj.level > allergenObj.level) {
                            //Level is higher therefore update level
                            allergenObj.level = elementAllergenObj.level;
                        }
                    }
                })
                if (!match) { //allergen is not in the list of allergens, add it.	
                    let allObj = {
                        allergen: elementAllergenObj.allergen,
                        level: elementAllergenObj.level
                    }
                    totalAllergens.push(allObj);
                }
            } else { //totalAllergens is empty, just add the allergen
                let allObj = {
                    allergen: elementAllergenObj.allergen,
                    level: elementAllergenObj.level
                }
                totalAllergens.push(allObj)
            }
        })
		})

		compElement.allergens = totalAllergens;

  } else {
  	//Nothin to do...no need to update unitCost. It will use reference unit cost.
  }
}

//Updates unitCost of recipe with the average location cost using filterLocation filter. Used when listing all recipes.
exports.calculateAvgRecipeLocCostAndAllergens = (docs, Model, filterLocation) => {

		var locIntersect;
		var unitCost;
		var compositionUnitCost;
		var packagingUnitCost;
		var sumOfCosts;
		var sumOfProductCompositionCosts;
		var sumOfProductPackagingCosts;
		var recipeUnitCost;
		var recipeCompUnitCost;
		var recipePackUnitCost;
		var locCostArray = [];
		var Subproduct = require('../models/subproduct');
		var Dish = require('../models/dish');
		var Product = require('../models/product');
		var Drink = require('../models/drinks');
		var compositionLocCostArray;
		var packagingLocCostArray;
  	var totalAllergens = [];
  	var allergens;

		logger.info('calculateAvgRecipeLocCostAndAllergens - Entering method')
		logger.info('calculateAvgRecipeLocCostAndAllergens - There are %s docs', docs.length)

		switch(Model) {
			
			case Subproduct:
				logger.info('calculateAvgRecipeLocCostAndAllergens - Model is Subproduct')
			break;
			
			case Product:
				logger.info('calculateAvgRecipeLocCostAndAllergens - Model is Product')
			break;
			
			case Dish:
				logger.info('calculateAvgRecipeLocCostAndAllergens - Model is Dish')
			break;
			
			case Drink:
				logger.info('calculateAvgRecipeLocCostAndAllergens - Model is Drink')
			break;
			
			default:
				logger.error('calculateAvgRecipeLocCostAndAllergens - Problem!!! Model is not defined.')
			break;

		}

   	docs.forEach((doc)=>{

			logger.info('calculateAvgRecipeLocCostAndAllergens - Evaluating recipe %s', doc._id)
			logger.info('calculateAvgRecipeLocCostAndAllergens - Recipe location cost is %j', doc.versions.locationCost)

  		sumOfCosts = 0;
  		sumOfProductCompositionCosts = 0;
  		sumOfProductPackagingCosts = 0;

  		if(filterLocation) locIntersect = filterLocation;
  		else locIntersect = doc.location;

      /*----------------  LOCATION COST --------------------*/

      if(doc.versions.locationCost && doc.versions.locationCost.length) {

   				logger.info('calculateAvgRecipeLocCostAndAllergens - Recipe has locationCost array')

   				logger.info({locIntersect: locIntersect}, 'calculateAvgRecipeLocCostAndAllergens - Calculated location intersect')
   				//console.log('doc versions totalCost locCostArray',doc.versions)
   				if(Model == Product) {
   					locCostArray = doc.versions.totalLocCost || []; //In case of a Product, we need to use the totalCost array, which is the sum of comp and pack location costs.
   					compositionLocCostArray = doc.versions.locationCost;
   					packagingLocCostArray = doc.versions.packLocCost || [];
   				} 
   				else 
   				{
   					locCostArray = doc.versions.locationCost;
   				}

      		if(locIntersect.length){

        		locIntersect.forEach((loc) => {

					    locId = new ObjectId(loc._id || loc);

					    let matchLoc = locCostArray.find((locCost) => {
					    	let id = new ObjectId(locCost.location);
					    	return id.equals(locId)
					    })		    	

							if(matchLoc) { //There's a match! 

								unitCost = matchLoc.unitCost;

								//console.log(unitCost,'if match with index: ',index,'locCostArray', locCostArray)
							} else { //no match, use reference cost

									switch(Model) {

	                	case Subproduct:
	                	case Product:
	                		unitCost = doc.versions.unitCost;
	                		break;

	                	case Dish:
	                	case Drink:
	                		unitCost = doc.versions.costPerServing;
	                		break;
	                }
	                //console.log('no match', unitCost)
							}

							sumOfCosts+=unitCost;

							if(Model == Product) {

								let indexComp = locHelper.arrayPriceIndexOf(compositionLocCostArray, locId);

								if(indexComp>-1) { //There's a match! 

									compositionUnitCost = compositionLocCostArray[indexComp].unitCost;

								} else { //no match, use reference cost

									if(doc.versions.netWeight!=0) compositionUnitCost=doc.versions.compositionCost/doc.versions.netWeight;
									else compositionUnitCost = 0;
										
								}

								sumOfProductCompositionCosts+=compositionUnitCost;

								let indexPack = locHelper.arrayPriceIndexOf(packagingLocCostArray, locId);

								if(indexPack>-1) { //There's a match! 

									packagingUnitCost = packagingLocCostArray[indexPack].unitCost;
									//console.log(unitCost,'if match with index: ',index,'locCostArray', locCostArray)
								} else { //no match, use reference cost

									if(doc.versions.netWeight!=0) packagingUnitCost=doc.versions.packagingCost/doc.versions.netWeight;
									else packagingUnitCost=0;
								}
								
								sumOfProductPackagingCosts+=packagingUnitCost;
							}
        		
        		})

	        	recipeUnitCost = sumOfCosts / locIntersect.length;

	        	if(Model == Product) {
	        			recipeCompUnitCost = sumOfProductCompositionCosts / locIntersect.length;
	        			recipePackUnitCost = sumOfProductPackagingCosts / locIntersect.length;
	        	}

	     			logger.info('calculateAvgRecipeLocCostAndAllergens - Calculated recipe cost: %s', recipeUnitCost)
	     			//console.log(recipeCost,'RecipeCost',Model,'Model')
						switch(Model) {

	          	case Subproduct: 
	          		doc.versions.unitCost = recipeUnitCost;
	          		logger.info('calculateAvgRecipeLocCostAndAllergens- Updated unit cost of subproduct to %s', doc.versions.unitCost)
	          		break;

	          	case Dish:
	          	case Drink:
	          		doc.versions.costPerServing = recipeUnitCost;
	          		// if(Model == Dish) logger.info('calculateAvgRecipeLocCostAndAllergens - Updated unit cost of dish to %s', doc.versions.costPerServing)
	          		// if(Model == Drink) logger.info('calculateAvgRecipeLocCostAndAllergens - Updated unit cost of drink to %s', doc.versions.costPerServing)

	          		break;

	          	case Product:
	          		doc.versions.unitCost = recipeUnitCost;
	          		doc.versions.packagingCost = recipePackUnitCost * doc.versions.netWeight;
	          		doc.versions.compositionCost = recipeCompUnitCost * doc.versions.netWeight;
	          		logger.info('calculateAvgRecipeLocCostAndAllergens - Updated unit cost of product to %s', doc.versions.unitCost)
	          		break;

	          	default:
	          	  logger.error("calculateAvgRecipeLocCostAndAllergens - Could not match Model!")
	          	  break;
	          }
	          //console.log('RecipeCost',doc.versions.unitCost)
	        }
      }
      else
      {
      	logger.info('calculateAvgRecipeLocCostAndAllergens - locationCost is empty.')
      }

      /*----------------  LOCATION ALLERGENS --------------------*/

      if(doc.versions.locationAllergens && doc.versions.locationAllergens.length) {

  			 locIntersect.forEach((loc) => {

				    locId = new ObjectId(loc._id || loc);
				    let matchLocAllergens;

				    if (doc.versions.locationAllergens) {
					    matchLocAllergens = doc.versions.locationAllergens.find((locAllergen) => {
					    	let id = new ObjectId(locAllergen.location);
					    	return id.equals(locId)
					    })		    	
				    }

				    if (matchLocAllergens) { //There's a match! 
				        logger.info('calculateCompElementAvgLocCostAndAllergens - Found a match in the composition element locationCost array.')
				        allergens = matchLocAllergens.allergens;

				    } else { //no match, use reference cost

				        logger.info('calculateCompElementAvgLocCostAndAllergens - Did not find a match in the composition element locationCost array.')
				        if (doc.versions.allergens) {
				        	allergens = doc.versions.allergens;		        	
				        } else {
				        	allergens = []
				        }
				    }

				    logger.info('calculateCompElementAvgLocCostAndAllergens - allergens %j', allergens)

			      allergens.forEach((elementAllergenObj) => { 

		            let elementAllergObjectId = new ObjectId(elementAllergenObj.allergen);

		            if (totalAllergens.length > 0) { //If the updated allergen list is empty, just add the allergen otherwise check whether it exist and its level
		                let match = false;
		                totalAllergens.forEach((allergenObj) => {
		                    let allergObjectId = new ObjectId(allergenObj.allergen);
		                    if (elementAllergObjectId.equals(allergObjectId)) {
		                        //console.log('match is true')
		                        match = true;
		                        if (elementAllergenObj.level > allergenObj.level) {
		                            //Level is higher therefore update level
		                            allergenObj.level = elementAllergenObj.level;
		                        }
		                    }
		                })
		                if (!match) { //allergen is not in the list of allergens, add it.	
		                    let allObj = {
		                        allergen: elementAllergenObj.allergen,
		                        level: elementAllergenObj.level
		                    }
		                    totalAllergens.push(allObj);
		                }
		            } else { //totalAllergens is empty, just add the allergen
		                let allObj = {
		                    allergen: elementAllergenObj.allergen,
		                    level: elementAllergenObj.level
		                }
		                totalAllergens.push(allObj)
		            }
		        })

  			 })
		 		 doc.versions.allergens = totalAllergens;
      }
      else
      {
      	logger.info('calculateAvgRecipeLocCostAndAllergens - locationAllergens is empty')
      }
   })

}

exports.getConversionTable = (cb) => { 
	var conversionTable = [];
	var baseUnits;
	var nonBaseUnits;

	//Find base units
	MeasurementUnit.find({'base': {$ne: null}})
	.exec((err, docs) => {
		if (err) return cb(err)
		baseUnits=docs;

		//Find non base units
		MeasurementUnit.find({'base': {$eq : null}}, {
			parentUnits: 1,
		})
		.populate('parentUnits.unit')
		.exec((err, docs) => {
			if (err) return cb(err);
			nonBaseUnits=docs;

            //traverse base units    
            for (var buIndex=0; buIndex<baseUnits.length; buIndex++) {
            	let baseUnitId = new ObjectId(baseUnits[buIndex]._id);

            	let baseUnitConversionsObj = {
            		"baseUnit": baseUnits[buIndex],
            		"conversions": []
            	}
                //traverse non base units 
                for (var nonBuIndex=0; nonBuIndex<nonBaseUnits.length; nonBuIndex++) {

                    //traverse conversions of non base unit and record if any of its parentUnits is pointing to the base unit
                    nonBaseUnits[nonBuIndex].parentUnits.find((conv) =>{
                    	let conversionId = new ObjectId(conv.unit._id);

                    	if (conversionId.equals(baseUnitId)) {
                    		let convObj = {
                    			"convUnit" : nonBaseUnits[nonBuIndex],
                    			"quantity" : conv.quantity
                    		}
                    		baseUnitConversionsObj.conversions.push(convObj);
                    	}
                    })
                }
                conversionTable.push(baseUnitConversionsObj);
            }
            cb(null, conversionTable)                     
        })
	})
}


/* -------------------------------------------------------------------------------------------------------------------------------------------- */
/* --          Calculates the ingredient/packaging average price (it really means cost) based on provider's articles and ignoring location   ---*/
/* -------------------------------------------------------------------------------------------------------------------------------------------- */

exports.calculateAveragePrice = (_id, callback) => { //gastroElement can either be a dish or a product

	var Article = require('../models/article');
	var async = require('async');

	var averagePrice = 0;

	async.waterfall([
        (cb) => {

        	Article.find({'category.item':_id}, (err, docs) => {
        		if(err) return cb(err)
						cb(null, docs)
        	})

        }, (docs, cb) => {

        		let totalPrice = 0;
						let totalItems = 0;

						if(docs.length) {

							//calculate average price
							docs.forEach((article) => { 
								if (article.netPrice && article.netPrice !=0) { 
									totalPrice += article.netPrice;
									totalItems++;
								}
							})					
							averagePrice = totalPrice / totalItems;
						}

						cb(null, docs)

        }], (err, docs) => {
          if(err) return callback(err)
        	callback(null, averagePrice)
        })

 }


 exports.computeRecipeCompCostsRecursively = (id, Model, parent, callback) => {

  var Subproduct = require('../models/subproduct');
	var Product = require('../models/product');
	var Drink = require('../models/drinks');
  var Dish = require('../models/dish');
  var Ingredient = require('../models/ingredient');
  var compElementsChanged = [];
  var erroneousCosts = false;
  var activeVersion;
  var match = 0;
	const logger = loggerHelper.queueRefreshRecipesCompCosts;
  var recipeLocation;
  var recipe;

  logger.info('Starting computeRecipeCompCostsRecursively method...')
  if(Model == Subproduct) logger.info('computeRecipeCompCostsRecursively - Processing subproduct with id: %s', id)
  if(Model == Product) logger.info('computeRecipeCompCostsRecursively - Processing product with id: %s', id)
  if(Model == Dish) logger.info('computeRecipeCompCostsRecursively - Processing dish with id: %s', id)
  if(Model == Drink) logger.info('computeRecipeCompCostsRecursively - Processing drink with id: %s', id)

  waterfall([
      (cb) => { //Get active version of recipe
				
				Model.findOne(
					{
						_id: id
					}
				).exec((err, doc) => {            
            if(err) return cb(err)
            if(!doc) {
            	logger.error('Error retrieving recipe!', doc._id)
            	let err=new Error('Error retrieving recipe')
            	return cb(err)
            }
          	recipe=doc;
            recipeLocation=doc.location;
            activeVersion=doc.versions.find((version) => { return version.active == true})
            if(!activeVersion) {
            	logger.error('Recipe %s does not have an active version!', doc._id)
            	let err = new Error('Subproduct does not have an active version!')
            	return cb(err)
            }
            logger.info('Recipe location is %j', recipeLocation)
         		cb(null, doc);
        })

      }, (doc, cb) => { //Populate ingredients and subproducts, and its costs

        async.each(activeVersion.composition, (compElement, cb_async) => {

          if(compElement.element.kind == 'subproduct') { //composition element is a subproduct
            
            Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
              if (err) return cb_async(err)

              if(compElement.element.item != null) {

                //Filter active version
                let active = compElement.element.item.versions.filter((version) => {
                  return version.active;
                })

                compElement.element.item.versions = JSON.parse(JSON.stringify(active));

               //Update composition element unitCost with average location cost based on filterLocation
                exports.calculateCompElementAvgLocCostAndAllergens(compElement, recipeLocation, Subproduct);

              	cb_async()
             }
             else
             {
              logger.error('compElement.element.item is null, %s, skipping', compElement)

             	cb_async();
             }
              
            });

          } else { //composition element is an ingredient

            Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
              if (err) return cb_async(err)

              if(compElement.element.item != null) {

	              //Update composition element unitCost with average location cost based on filterLocation
	              exports.calculateCompElementAvgLocCostAndAllergens(compElement, recipeLocation, Ingredient);

              	cb_async()           

	             } 
	             else
	             {
	              logger.error('compElement.element.item is null, %s, skipping', compElement)

	             	cb_async();
	             }
            }); 
          }       

        }, (err) => { //finished async loop
        	if(err) return cb(err)
        	logger.info('computeRecipeCompCostsRecursively - Finished populating recipe\'s composition elements and updating costs')
          cb(null, doc);
        });

      }, (doc, cb) => { //Update costs of composition elements
      	
      	logger.info('computeRecipeCompCostsRecursively - Update costs of composition elements')
      	
      	compElementsChanged = [];
      	erroneousCosts = false;
      	
      	async.eachSeries(activeVersion.composition, (compElement, cb_async) => {
      		
      		if(compElement.element.item) {
      			
      			if(compElement.element.kind == 'subproduct') {

      				logger.info('computeRecipeCompCostsRecursively - Composition element is a subproduct')
      				let subproductId = new ObjectId(compElement.element.item._id)
      				let match = parent.some((_id) => {
      					let id = new ObjectId(_id);
      					return id.equals(subproductId)
      				})
      				if(match) {
      				  logger.error('computeRecipeCompCostsRecursively - Circular loop detected when calculating subproduct\'s costs in recipe.')
      					process.nextTick(()=>cb_async());
      				} 
      				else 
      				{
    						parent.push(compElement.element.item._id);
    						exports.computeRecipeCompCostsRecursively(compElement.element.item._id, Subproduct, parent, (err, costs) => {
    							parent.pop()
    							if(err){
    								logger.error('computeRecipeCompCostsRecursively - Error calculating costs of subproduct %s', compElement.element.item._id)
    								cb_async()
    							} else {
    								logger.info('computeRecipeCompCostsRecursively - Calculated costs for subproduct %s : %j', compElement.element.item._id, costs)
    								if (costs){
    									if (compElement.unitCost != costs.unitCost ) {
    										erroneousCosts=true
	          						compElement.unitCost = costs.unitCost
	          						let obj = {
	          							compElementId: compElement._id,
				      						unitCost: costs.unitCost
				      					}
				      					compElementsChanged.push(obj)
				      				}
				      				if (compElement.locationCost.length == costs.locationCost.length) {
				      					match = 0;
				      					compElement.locationCost.forEach((locationCost1) => {
				      						costs.locationCost.forEach((locationCost2) => {
				      							let loc1Id=new ObjectId(locationCost1.location);
				      							let loc2Id=new ObjectId(locationCost2.location);
				      							if (loc2Id.equals(loc1Id) ) {
				      								if (locationCost1.unitCost==locationCost2.unitCost ) {
				      									match ++
				      								}
				      							}
				      						})
				      					})
				      					if (match != compElement.locationCost.length) {
				      						erroneousCosts=true
				      						compElement.locationCost = costs.locationCost
				      						let obj = {
				      							compElementId: compElement._id,
				      							locationCost: costs.locationCost
				      						}
				      						compElementsChanged.push(obj)
				      					}
				      				} else {
				      					erroneousCosts=true;
				      					compElement.locationCost = costs.locationCost
				      					let obj = {
				      						compElementId: compElement._id,
				      						locationCost: costs.locationCost
				      					}
				      					compElementsChanged.push(obj)
				      				}
            				cb_async();
				      			}
				      			else
				      			{
				      	      logger.error('computeRecipeCompCostsRecursively - computeRecipeCompCostsRecursively did not return costs')
				      				cb_async()
				      			}
				      		}
				      	})
	            }
	          } else if(compElement.element.kind == 'ingredient') {
	          	
	          	if (compElement.unitCost != compElement.element.item.referencePrice ) {
	          		erroneousCosts=true
      					compElement.unitCost = compElement.element.item.referencePrice
      					let obj = {
      						compElementId: compElement._id,
      						unitCost: compElement.element.item.referencePrice
      					}
      					compElementsChanged.push(obj)
      				}
      				if (compElement.locationCost.length == compElement.element.item.locationCost.length) {
      					match = 0;
      					compElement.locationCost.forEach((locationCost1) => {
      						compElement.element.item.locationCost.forEach((locationCost2) => {
      							let loc1Id=new ObjectId(locationCost1.location);
      							let loc2Id=new ObjectId(locationCost2.location);
      							if (loc2Id.equals(loc1Id) ) {
      								if (locationCost1.unitCost==locationCost2.unitCost ) {
      									match ++
      								}
      							}
      						})
      					})
      					if (match != compElement.locationCost.length) {
      						erroneousCosts=true
      						compElement.locationCost = compElement.element.item.locationCost
      						let obj = {
      							compElementId: compElement._id,
      							locationCost: compElement.element.item.locationCost
      						}
      						compElementsChanged.push(obj)
      					}
      				} else {
      					erroneousCosts=true;
      					compElement.locationCost = compElement.element.item.locationCost
      					let obj = {
      						compElementId: compElement._id,
      						locationCost: compElement.element.item.locationCost
      					}
      					compElementsChanged.push(obj)
      				}
      				cb_async();
      			}
      		} else {
      			logger.error('compElement.element.item is null, %s, skipping', compElement)
      			cb_async();
      		}
      	}, (err, results) => {
      		logger.info('Finished update costs of composition elements.')
      		cb(null, doc);
      	})
			}, (doc, cb) => { 

      		if(erroneousCosts) { //Update active version of recipe because the costs in at least one of the composition elements has changed.

      			logger.info('Costs in at least one of the composition elements are erroneous and have changed. Update recipe.')

          	recipe.save((err, doc) => {
          		if(err) return cb(err)
          	 	cb(null, doc)
          	})

			     }
			     else
			     {
			     		cb(null, doc)
			     }

      }, (doc, cb) => { 

      		async.forEach(activeVersion.composition, (compElement) => {
      			if(compElement.element.item != null) {
      			compElement.element.item = compElement.element.item._id
      			}
      	})
			     	
			  cb(null, doc)

      }, (doc, cb) => { //Calculate aggregate costs of composition elements
      		logger.info('Calling calculateRecipeCompLocationCosts method...')
					exports.calculateRecipeCompLocationCosts(activeVersion, recipeLocation, Model, (err, res) => {
					  if(err) return cb(err)
					  logger.info('Calculated recipe composition location costs: %j', res)
					  cb(null, res)
					})  

      }], (err, doc) => {
        if (err) return callback(err)   
        callback(null, doc)
      }) 
}