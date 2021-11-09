/* 

This helper updates the calculation costs of gastronomic offers when the cost of a dish or product changes.

---- Dishes ----
When the cost per serving of a dish changes, the helper proceeds as follows:

1. Looks for gastronomic offers that include this dish
2. Updates the cost per serving of the dish in the gastronomic offer composition list.
3. Updates the totalCost (costPerServing * numServings) of the composition element that includes this dish.
2. Depending on the type of gastronomic offer (menuType), carries out one type of calculation or another.
	2.1 If it's a menu, the cost calculation is a simple sum of costs.
	2.2. If it's a dailyMenuCarte, buffet or fixedPriceCarte, it calculates the mean costs.
3. It is not necessary to tag families or up/down arrows because the composition list hasn't changed, other than the cost update.

--- Products ---
When the cost of a product changes (compositionCost + packagingCost), the helper proceeds as follows:
1. Looks for gastronomic offers (catalogs) that include this product
2. Updates the cost of the product in the gastronomic offer composition list. Note: in theory this should not be necessary as the 
composition list should just have a reference to the product. However, I have not been able to populate this product id reference in the 
endpoint response, therefore I've had to add this as a composition list field.
3. Catalogs do not have total cost therefore there is no need to carry out any automatic cost calculation for catalogs when the 
cost of a product (compositionCost + packagingCost) changes.

*/

var GastroOffer = require('../models/gastroOffer');
var {ObjectId} = require('mongodb');
var async = require('async');
var waterfall = require('async-waterfall');
var locHelper = require('../helpers/locations');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.gastroCost;

//Calculates the location cost of a gastro offer, excluding catalogs. Used when adding a new version of a gastro offer.
exports.calculateGastroOfferLocCost = (gastroVersion, type, gastroLocation, callback) => {

		let dishArray = [];
		let dishIdArray;
		let drinkArray = [];
		let locationCost = [];
		let compositionCost = 0;
		let dishLocCostArray = [];
		let drinkLocCostArray = [];
		let gastroLocCostArray = []
		var Dish = require('../models/dish');
		var Drink = require('../models/drinks');
  	var Product = require('../models/product');
		var cost = 0;
		var meanCost = 0;
		var totalCost = 0;
		var locationLoop;

		logger.info('calculateGastroOfferLocCost - Entering method')

		async.waterfall([ //First waterfall

			(cb) => { //Get ids of products in composition list

				let productArray = gastroVersion.composition.filter((compElement) => {
					return compElement.element.kind == 'product'
				})

				let productIdArray = productArray.map((compElement) => {
					return new ObjectId(compElement.element.item._id || compElement.element.item);
				})

				logger.info('calculateGastroOfferLocCost - Calculated array of product Ids in gastro composition list. Gatro Version: %s ', gastroVersion._id)

				Product.aggregate([
		 			{
		 				$unwind: {
		 					path: '$versions',
		 					preserveNullAndEmptyArrays: true
		 				}
		 			},
					{ $match: { '_id': {$in: productIdArray}}},
					{ $match: { 'versions.active': true}}
					], (err, products) => {
						
						if(err) return cb(err)
						logger.info('calculateGastroOfferLocCost - Obtained products docs in gastro composition list. Gastro Version: %s ', gastroVersion._id)
						cb(null, products)
					})

			}, (products, cb) => { //Update location cost array and reference cost in composition elements that are products

				gastroVersion.composition.forEach((compElement) => {

					let elementId = new ObjectId(compElement.element.item._id || compElement.element.item)

					products.forEach((product) => {

						let id = new ObjectId(product._id);
						
						if(elementId.equals(id)) {
							if(product.versions.totalLocCost) compElement.locationCost = product.versions.totalLocCost;
							else compElement.locationCost = [];
							compElement.cost = product.versions.unitCost;
						}

					})

				})

				cb(null,products)


		}, (docs, cb) => { //Get ids of dishes in composition list

				let dishArray = gastroVersion.composition.filter((compElement) => {
					return compElement.element.kind == 'dish'
				})

				let dishIdArray = dishArray.map((compElement) => {
					return new ObjectId(compElement.element.item._id || compElement.element.item);
				})

				logger.info('calculateGastroOfferLocCost - Calculated array of dish Ids in gastro composition list. Gatro Version: %s ', gastroVersion._id)

				Dish.aggregate([
		 			{
		 				$unwind: {
		 					path: '$versions',
		 					preserveNullAndEmptyArrays: true
		 				}
		 			},
					{ $match: { '_id': {$in: dishIdArray}}},
					{ $match: { 'versions.active': true}}
					], (err, dishes) => {
						
						if(err) cb(err)
						logger.info('calculateGastroOfferLocCost - Obtained %s dishes docs in gastro composition list. Gastro Version: %s ', dishes.length, gastroVersion._id)
						cb(null, dishes)
					})

			}, (dishes, cb) => { //Update location cost array in composition elements that are dishes

				gastroVersion.composition.forEach((compElement) => {

					let elementId = new ObjectId(compElement.element.item._id || compElement.element.item)

					dishes.forEach((dish) => {

						let id = new ObjectId(dish._id);
						
						if(elementId.equals(id)) {
							if(dish.versions.locationCost) compElement.locationCost = dish.versions.locationCost;
							else compElement.locationCost = [];
							compElement.cost = dish.versions.costPerServing;
						}

					})

				})

				cb(null,dishes)
			
			}, (dishes, cb) => { //docs is list of dishes (filtered with active version). Compute cost location of dishes

					dishes.forEach((dish) => {
						if(dish.versions.locationCost) {
							let dishLocs = dish.versions.locationCost.map((loc) => {
								return loc.location;
							})
							dishLocCostArray = dishLocCostArray.concat(dishLocs)
						}
					})

					logger.info('calculateGastroOfferLocCost - Computed cost locations of dishes. Gastro Version: %s ', gastroVersion._id)
					cb(null, true)

			}, (docs, cb) => { //Get location cost arrays of drinks in composition list

					let drinkArray = gastroVersion.composition.filter((compElement) => {
						return compElement.element.kind == 'drink'
					})

					let drinkIdArray = drinkArray.map((compElement) => {
						return new ObjectId(compElement.element.item._id || compElement.element.item);
					})

					logger.info('calculateGastroOfferLocCost - Calculated array of drink Ids in gastro composition list. Gatro Version: %s ', gastroVersion._id)

					Drink.aggregate([
			 			{
			 				$unwind: {
			 					path: '$versions',
			 					preserveNullAndEmptyArrays: true
			 				}
			 			},
						{ $match: { '_id': {$in: drinkIdArray}}},
						{ $match: { 'versions.active': true}}
						], (err, drinks) => {
							
							if(err) return cb(err)
							logger.info('calculateGastroOfferLocCost - Obtained drinks docs in gastro composition list. Gastro Version: %s ', gastroVersion._id)
							cb(null, drinks)
						})	

			}, (drinks, cb) => { //Update location cost array in composition elements that are drinks

				gastroVersion.composition.forEach((compElement) => {

					let elementId = new ObjectId(compElement.element.item._id || compElement.element.item)

					drinks.forEach((drink) => {

						let id = new ObjectId(drink._id);
						
						if(elementId.equals(id)) {

							if(drink.versions.locationCost) compElement.locationCost = drink.versions.locationCost;
							else compElement.locationCost = [];
							compElement.cost = drink.versions.costPerServing;
						}

					})

				})

				cb(null,drinks)

			}, (drinks, cb) => {  //Compute cost location of drinks

					drinks.forEach((drink) => { 
						if(drink.versions.locationCost) {
							let drinkLocs = drink.versions.locationCost.map((loc) => {
								return loc.location;
							})
							drinkLocCostArray = drinkLocCostArray.concat(drinkLocs)
						} 
					})

					logger.info('calculateGastroOfferLocCost - Computed cost locations of drinks. Gastro Version: %s ', gastroVersion._id)
					cb(null, true)

			}, (docs, cb) => { //If gastro type if catalog or carte, finish method here. Just needed to update location costs of gastro elements
	
					switch(type) {
						case 'carte':
						case 'catalog':
							return cb(true)
							break;

						default:
							cb(null, docs)
							break;

					}
			
			}, (docs, cb) => { //If gastroLocation not provided, compute aggregate location which will be the location loop

					if(gastroLocation) {

						locationLoop = gastroLocation.map((loc) => {
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

  					logger.info('Location loop is gastro location array: %j', locationLoop)
					}
					else
					{

						//Concat dish and drinks arrays to get list locationCost arrays in gastro's version composition list
						gastroLocCostArray = dishLocCostArray.concat(drinkLocCostArray)

						logger.info('calculateGastroOfferLocCost - Computed cost locations of dishes and drinks combined. Gastro Version: %s ', gastroVersion._id)

						//remove duplicates
						locationLoop = locHelper.removeDuplicates(gastroLocCostArray)

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

						logger.info('calculateGastroOfferLocCost - Computed location loop by removing duplicates. Gastro Version: %s ', gastroVersion._id)
					}

					cb(null, docs)

			}, (docs, cb) => { 

					//Go over location loop for each gastro version. We know from how locationLoop is calculated, that there is at least one composition element 
					//for each location in locationLoop
					async.eachSeries(locationLoop, (loc, cb_asyncLocLoop) => {

			      logger.info('calculateGastroOfferLocCost - Gastro Version: %s ', gastroVersion._id)

						async.waterfall([ //Second waterfall

							(cb2) => {

								//Calculate costs of all elements using conversion table
								gastroVersion.composition.forEach((compElement) => {													

										let costPerServing;
										let index;
										logger.info('calculateGastroOfferLocCost - Evaluating compElement: %s. Gastro Version: %s ', compElement.element.item, gastroVersion._id)

										//--------------    SET UNIT COST OF ELEMENT IN LOCATION FOR CALCULATIONS  ---------------------- //
										
										//Find location cost in location array and set costPerServing to that value. If not available use reference price.

										logger.info('calculateGastroOfferLocCost - Finding location cost in location array and set costPerServing to that value. Gastro Version: %s ', gastroVersion._id)

										if(compElement.locationCost&&loc.location) {
											//update locationCost array. Get array index for that location and update value
										  index = locHelper.arrayPriceIndexOf(compElement.locationCost, loc.location);

											if(index>-1) { //There's a match! 

												costPerServing = compElement.locationCost[index].unitCost;
												locationMatch = true;

                        if(!costPerServing) {
                      		costPerServing = compElement.cost || 0;
                      		compElement.locationCost.splice(index, 1)
                      		logger.error('Location cost is undefined. Removing from location cost and setting cost to referenceCost. Gastro Version: %s', gastroVersion._id)	
                      	}

												logger.info('calculateGastroOfferLocCost - Found location in location Array. Using location cost: %s as unit cost. Gastro Version: %s ', costPerServing, gastroVersion._id)
											
											} else { //no match, use reference cost
													costPerServing = compElement.cost || 0;
													logger.info('calculateGastroOfferLocCost - Could not find location in location Array. Using reference cost: %s as unit cost. Gastro Version: %s ', costPerServing, gastroVersion._id)
											}

										} else { //Recipe element does not have a locationArray. Set costPerServing to referenceCost.
											costPerServing = compElement.cost || 0;
											logger.info('calculateGastroOfferLocCost - Recipe element does not have a locationArray. Set costPerServing to referenceCost: %s Gastro Version: %s ', costPerServing, gastroVersion._id)
										}	

										//--------------   CALCULATE GASTRO ELEMENT COST  ---------------------- //
										let numServings = compElement.numServings || 0;
										compElement.totalCost =  costPerServing * numServings;	
					  		
						  		}) //End of recipe composition loop. totalCost updated for location 
									
									switch (type) {
						  			case 'menu':
						  			case 'buffet':
					  			  	//Calculate sum of all costs
					  			  	exports.calculateSumOfDishesCosts(JSON.parse(JSON.stringify(gastroVersion)), (err, res) => {
					  			  		if(err) cb(err)
					  			  		totalCost = res;
										    logger.info('calculateGastroOfferLocCost - Total version cost: %s for location: %s. Gastro Version: %s ', totalCost, loc.location, gastroVersion._id)
										    cb2(null, true)
					  			  	});
					  			  	break;

						  			case 'dailyMenuCarte':
						  			case 'fixedPriceCarte':
						  			 	//Calculate mean cost
						  			 	exports.CostsForDailyMenuAndFixedPriceCartes(JSON.parse(JSON.stringify(gastroVersion)), type, (err, res) => {
						  			  		if(err) cb(err)
						  			  		meanCost = res;
											    logger.info('calculateGastroOfferLocCost - Version mean cost: %s for location: %s. Gastro Version: %s ', meanCost, loc.location, gastroVersion._id)
											    cb2(null, true)
						  			  	});
						  			 	break;
						  			
						  			default:
										    logger.info('calculateGastroOfferLocCost - Problem!! It should never get here.')
										    cb2(null, true)
										break;
						  		}

						  }, (doc, cb2) => {

								  //------------------  ADD UNIT COST TO LOCATION COST ARRAY ---------------------------------------//

							    if(loc.location == null) { //Reference cost

										switch(type) {
											case 'menu':
						  				case 'buffet':
												cost = totalCost;
		   		 					    logger.info('calculateGastroOfferLocCost - Updated reference cost variable to : %s for location: %s' , totalCost, loc.location)
											break;

						  				case 'dailyMenuCarte':
						  				case 'fixedPriceCarte':
												cost = meanCost;
		   		 					    logger.info('calculateGastroOfferLocCost - Updated reference cost variable to : %s for location: %s', meanCost, loc.location)
											break;
										}

							    } else { //Location cost

							    	let locationCostObj;

								    switch(type) {

								    	case 'menu':
						  				case 'buffet':

													locationCostObj = {
														location: loc.location,
														unitCost: totalCost
													}
													
													locationCost.push(locationCostObj);
						 					    logger.info('calculateGastroOfferLocCost - Calculated and added total cost of gastro version: %s for location: %s .Gastro Version: %s ', totalCost, loc.location, gastroVersion._id)

								    	break;

						  				case 'dailyMenuCarte':
						  				case 'fixedPriceCarte':
								  		
													locationCostObj = {
														location: loc.location,
														unitCost: meanCost
													}
													
													locationCost.push(locationCostObj);
						 					    logger.info('calculateGastroOfferLocCost - Calculated and added mean cost of gastro version: %s for location: %s .Gastro Version: %s ', meanCost, loc.location, gastroVersion._id)

								    	break;

								    	default: 
						 					    logger.info('calculateGastroOfferLocCost - Problem!!! It is not identifying correct model. Gastro Version: %s ', gastroVersion._id)
								    	break;
								    }
								  }
								  cb2(null, true)

								}], (err, doc) => { //End of second waterfall
										cb_asyncLocLoop()
								})

					}, () => { //end of async location loop
							cb(null, true) //Just to end of first waterfall
					}) 					

		}], (err, doc) => { //End of first waterfall

				if(err) {
					if(err == true) callback(null, true)
					else return callback(err)
				}
				else
				{

			    logger.info('calculateGastroOfferLocCost - calculated locationCost array for recipe version. Gastro Version: %s ', gastroVersion._id)
			    
			    let res = 
			    {
			    	locationCost: locationCost,
			    	cost: cost
			    }

			    callback(null, res)
			  }
		})

}

//Updates unitCost of gastro with the average location cost using filterLocation filter. Used when listing all recipes.
exports.calculateAvgGastroLocCost = (docs) => {

		var locIntersect;
		var unitCost;
		var sumOfCosts;
		var totalCost;
		var meanCost;
		var gastroCost;
		var locCostArray = [];
		var menuType;

		logger.info('calculateAvgGastroLocCost - Entering method')

    docs = docs.map((doc) => {

  		sumOfCosts = 0;
  		menuType = doc.type[0];

      if(doc.versions.locationCost && doc.versions.locationCost.length) {

   				logger.info('calculateAvgGastroLocCost - Gastro has locationCost array')

      		//Calulate location intersection between filterCost and recipeLocation
      		//locIntersect = locHelper.locationIntersect(filterLocation, doc.location)
					//Note: removed the intersection calculation because it led to confusion.
      		locIntersect = doc.location;

   				//logger.info({locIntersect: locIntersect}, 'calculateAvgGastroLocCost - Calculated location intersect')

					locCostArray = doc.versions.locationCost;

      		if(locIntersect.length){

        		locIntersect.forEach((iLoc) => { //Filter location loop

        			let locId = iLoc._id || iLoc

        			let index = locHelper.arrayPriceIndexOf(locCostArray, locId);

							if(index>-1) { //There's a match! 

								switch(menuType) {
									
									case 'menu':
				  				case 'buffet':
										totalCost = locCostArray[index].unitCost;
										logger.info('calculateAvgGastroLocCost - Location match, totalCost = %s', totalCost)
									break;

				  				case 'dailyMenuCarte':
				  				case 'fixedPriceCarte':
				  					meanCost = locCostArray[index].unitCost;
										logger.info('calculateAvgGastroLocCost - Location match, meanCost = %s', meanCost)
				  				break;

				  				default:
				  				 //nothing to do
										logger.info('calculateAvgGastroLocCost - Did not match menu type')
				  				break;
								}								
							
							} else { //no match, use reference cost

								switch(menuType) {

									case 'menu':
				  				case 'buffet':
                		totalCost = doc.versions.totalCost;
										logger.info('calculateAvgGastroLocCost - No location match. Using reference  totalCost= %s', totalCost)
                	break;

				  				case 'dailyMenuCarte':
				  				case 'fixedPriceCarte':
                		meanCost = doc.versions.meanCost;
										logger.info('calculateAvgGastroLocCost - No location match. Using reference  meanCost= %s', meanCost)                		
                	break;

				  				default:
				  				 //nothing to do
										logger.info('calculateAvgGastroLocCost - Did not match menu type')
				  				break;	                
			  				}
							}
							
							//Caculate sum
							switch(menuType) {

								case 'menu':
			  				case 'buffet':
              		sumOfCosts+=totalCost;
              	break;

			  				case 'dailyMenuCarte':
			  				case 'fixedPriceCarte':
              		sumOfCosts+=meanCost;
              	break;

			  				default:
			  				 //nothing to do
									logger.info('calculateAvgGastroLocCost - Did not match menu type')
			  				break;              	
              }
       		
        		}) //Finished filter location loop

	        	gastroCost = sumOfCosts / locIntersect.length;
	     			logger.info('calculateAvgGastroLocCost - Calculated recipe cost: %s', gastroCost)

						switch(menuType) {

							case 'menu':
		  				case 'buffet':
	          		doc.versions.totalCost = gastroCost;
	          	break;

		  				case 'dailyMenuCarte':
		  				case 'fixedPriceCarte':	          	
	          		doc.versions.meanCost = gastroCost;
	          	break;

		  				default:
		  				 //nothing to do
								logger.info('calculateAvgGastroLocCost - Did not match menu type')
		  				break;	          	
	          }
	        }
      }
   })
}

//Caluclates location cost for gastro element (dish, drink or product) in gastro composition list based on filterLocation
//Used in gastro getVersion
exports.calculateGastroElementAvgLocCostAndAllergens = (gastroElement, filterLocation) => {

	var locLoop = [];
	var unitCost = 0;
	var sumOfCosts=0;
	var gastroElementCost = 0;
	var allergens = [];
	var totalAllergens = [];

	logger.info('calculateGastroElementAvgLocCostAndAllergens - Entering method.')
  logger.info('calculateGastroElementAvgLocCostAndAllergens - filterLocation input param.')
  //logger.info({'gastroElement.location': gastroElement.location},'calculateGastroElementAvgLocCostAndAllergens - gastroElement location.')

	// if(Model == Subproduct) { 
	// 	//Calulate location intersection between filterLocation and composition element location (key set in controller getVersion)
	// 	//Note: removed the intersection calculation because it led to confusion.
	// 	//locLoop = locHelper.locationIntersect(filterLocation, gastroElement.location)
	// 	locLoop = filterLocation;
	// 	logger.info('calculateGastroElementAvgLocCostAndAllergens - Composition element is a subproduct. Calculate location loop.')
	// } else if (Model == Ingredient){ //Ingredient, 
	// 	locLoop = filterLocation;
	// 	logger.info('calculateGastroElementAvgLocCostAndAllergens - Composition element is an ingredient.')
	// }

	if(filterLocation) locLoop = filterLocation;

	logger.info('calculateGastroElementAvgLocCostAndAllergens - Calculated location loop: %j', locLoop)

	if(locLoop.length) {

		locLoop.forEach((loc) => {

			let locId = loc._id || loc;

			let index;

			if(gastroElement.locationCost) {

				index = locHelper.arrayPriceIndexOf(gastroElement.locationCost, locId);

			}
			else
			{
				index = -1;
				logger.error('gastroElement locationCost is undefined, id %s', gastroElement._id)
			}

			if(index>-1) { //There's a match! 

				logger.info('calculateGastroElementAvgLocCostAndAllergens - Found a match in the composition element locationCost array.')
				unitCost = gastroElement.locationCost[index].unitCost;
			
			} else { //no match, use reference cost

				logger.info('calculateGastroElementAvgLocCostAndAllergens - Did not find a match in the composition element locationCost array.')
				unitCost = gastroElement.cost;
			}

			sumOfCosts+=unitCost;
		})

  	gastroElementCost = sumOfCosts / locLoop.length;
		logger.info('calculateGastroElementAvgLocCostAndAllergens - Calculated composition element cost: %s', gastroElementCost)

		gastroElement.cost = gastroElementCost;


		//***********  Calculate average (worst case scenario) allergens for location loop  ***//
		locLoop.forEach((loc) => {

		    locId = new ObjectId(loc._id || loc);
		    let matchLocAllergens;
		    if (gastroElement.locationAllergens && gastroElement.locationAllergens.length) {

			    matchLocAllergens = gastroElement.locationAllergens.find((locAllergen) => {
			    	let id = new ObjectId(locAllergen.location);
			    	return id.equals(locId)
			    })		    	
		    }
		    if (matchLocAllergens) { //There's a match! 
		        logger.info('calculateCompElementAvgLocCostAndAllergens - Found a match in the composition element locationCost array.')
		        console.log('calculateCompElementAvgLocCostAndAllergens - Found a match in the composition element locationCost array.')
		        allergens = matchLocAllergens.allergens;

		    } else { //no match, use reference allergens

		        logger.info('calculateCompElementAvgLocCostAndAllergens - Did not find a match in the composition element locationCost array.')
		        allergens = gastroElement.allergens || [];
		    }
		    logger.info('calculateCompElementAvgLocCostAndAllergens - allergens %s', allergens)
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
		gastroElement.allergens = totalAllergens;

  } else {
  	//Nothin to do...no need to update unitCost. It will use reference unit cost.
  }
}


exports.calculateSumOfDishesCosts = (gastroOfferVersion, cb) => {
	var sumOfDishesCosts = 0;

	if(gastroOfferVersion.composition.length>0) {
		gastroOfferVersion.composition.forEach((dish, index) => {
			sumOfDishesCosts+=dish.totalCost;
		})
	}

	cb(null,sumOfDishesCosts);
}

exports.calculateSumOfDrinksCosts = (gastroOfferVersion, cb) => {
	var sumOfDrinksCosts = 0;

	if(gastroOfferVersion.composition.length>0) {
		gastroOfferVersion.composition.forEach((drink, index) => {
			sumOfDrinksCosts+=drink.totalCost;
		})
	}

	cb(null,sumOfDrinksCosts);
}

exports.CostsForDailyMenuAndFixedPriceCartes = (gastroOfferVersion, menuType, callback) => {

	var previousFamilyInitIndex=0;
	var previousSubfamilyInitIndex=0;
	var subfamilyTotalCost=0;
	var familyTotalCost=0;
	var meanCost = 0;

	async.waterfall([

		(cb) => { //tag families in gastro version composition list
			tagFamilies(gastroOfferVersion, (err, doc) => {
					cb(null, true)
			})

		}, (ok, cb) => {

			if(gastroOfferVersion.composition.length>0) {

				//console.log(gastroOfferVersion.composition, 'CostsForDailyMenuAndFixedPriceCartes - gastroOfferVersion.composition')

				gastroOfferVersion.composition.forEach((element, index)=>{
					//console.log(index, 'CostsForDailyMenuAndFixedPriceCartes index')

					if (element.subfamilyInit) {	

						if (index>0) {
							
							if(gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyLength && !isNaN(subfamilyTotalCost)) {

									gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost = subfamilyTotalCost 

									if (menuType == 'dailyMenuCarte') {
									gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost /= gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyLength;
										
									}

									//console.log(gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost, 'subfamilyMeanCost')
							} else {
								gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost=0;
							}

							familyTotalCost += gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost;
							//console.log(familyTotalCost, 'familyTotalCost')

						
						}
						if(element.totalCost) subfamilyTotalCost = element.totalCost;
						//console.log(subfamilyTotalCost, 'subfamilyTotalCost')
						previousSubfamilyInitIndex=index;
					
					} else {
						
						if(element.totalCost) subfamilyTotalCost += element.totalCost;
						//console.log(subfamilyTotalCost, 'subfamilyTotalCost')
					}

					if (element.familyInit) {

						if (index>0) {

							//console.log(familyTotalCost, 'familyTotalCost')
							//console.log(previousFamilyInitIndex, 'previousFamilyInitIndex')
							//console.log(previousFamilyInitIndex, 'previousFamilyInitIndex')
							//console.log(gastroOfferVersion.composition[previousFamilyInitIndex].numSubfamilies, 'gastroOfferVersion.composition[previousFamilyInitIndex].numSubfamilies')
							if(gastroOfferVersion.composition[previousFamilyInitIndex].numSubfamilies && !isNaN(familyTotalCost)) {

								gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost = familyTotalCost 

									if (menuType == 'dailyMenuCarte') {
										gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost /= gastroOfferVersion.composition[previousFamilyInitIndex].numSubfamilies;
									}

								//console.log(gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost, 'familyMeanCost')
							} else {
								gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost=0;
							}
							
							meanCost += gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost;
							//console.log(meanCost, 'meanCost')
						}

						familyTotalCost = 0;
						previousFamilyInitIndex=index;
					}

				})

				//Add mean cost of last family and subfamily item

				if(gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyLength && !isNaN(subfamilyTotalCost)){
						gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost = subfamilyTotalCost 

						if (menuType == 'dailyMenuCarte') {
							gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost /= gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyLength;
						}

				} else {
					gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost=0;
				}
				
				familyTotalCost += gastroOfferVersion.composition[previousSubfamilyInitIndex].subfamilyMeanCost;
				
				if(gastroOfferVersion.composition[previousFamilyInitIndex].numSubfamilies && !isNaN(familyTotalCost)){
						gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost = familyTotalCost 
						if (menuType == 'dailyMenuCarte') {
							gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost /= gastroOfferVersion.composition[previousFamilyInitIndex].numSubfamilies;
						}
				} else {
					gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost = 0;
				}
				
				meanCost += gastroOfferVersion.composition[previousFamilyInitIndex].familyMeanCost;
			
			} else {
			
				meanCost=0;
			
			}
			cb(null, true)

		}], (err, doc) => {
			if(!meanCost) meanCost = 0;
			//console.log(meanCost, 'meanCost')
 			callback(null, meanCost);
	})
}


	var tagFamilies = (gastroVersion, callback) => {
		//Sets familyInit and subfamilyInit tags and calculates number of families, subfamilies and items per subfamily and family.
		var previousFamilyId=null;
		var previousSubfamilyId=null;
		var familyLength = 0;
		var subfamilyLength = 0;
		var previousFamilyInitIndex=0;
		var previousSubfamilyInitIndex=0;
		var numFamilies=0;
		var numSubfamilies=0;
		var subfamilyId=0;
		var Family = require('../models/family');
		var families;

		// console.log('entering tagFamilies')
		logger.info('Entering tagFamilies method...')

		async.waterfall([

			(cb) => { //Get families

					Family.find({}, (err, families) => {

						if(err) return cb(err)
						cb(null, families)
					})

			}, (families, cb) => { //Set id for subfamilies equal to null

					//Filter dishes with subfamily null
					let elementsWithSubfamilyNull = gastroVersion.composition.filter((element) => {
						return element.subfamily==null;
					})

					//Set subfamily id based on position of family in families array
					elementsWithSubfamilyNull.forEach((elementSubFamNull) => {

						var familyIndex;
						let elementFamId
						//console.log(elementSubFamNull.family,'subfamNull Family')
						if(elementSubFamNull.family._id){

						  elementFamId = new ObjectId(elementSubFamNull.family._id);

						} else {

							elementFamId = new ObjectId(elementSubFamNull.family);

						}
						

						//get index of family in families array. There has to be a match, the alternative is not possible if 
						//referential integrity is working corectly.
						families.forEach((family, index) => {
							let famId = new ObjectId(family._id)
							if(elementFamId.equals(famId)) familyIndex=index;
						})

						//Set id based on family index. 
						// Same method is used when adding/editing a dish without subfamily and setting a (bogus) id.
						elementSubFamNull.subfamily = -(familyIndex+1);
					})

					logger.info('Finished setting \'bogus\' ids to composition elements with subfamily null...')

					cb(null, true)

			}, (docs, cb) => { 

				//reset tags
				gastroVersion.composition.forEach((element)=>{
					element.familyInit=false;
					element.subfamilyInit=false;
				});

				gastroVersion.composition.forEach((element, index)=>{
					familyLength++;
					subfamilyLength++;

					// console.log(element.family, 'familyId')
					// console.log(previousFamilyId, 'previousFamilyId')
					if(element.family._id){
						 familyId = new ObjectId(element.family._id)
					} else {
						 familyId = new ObjectId(element.family)
					}
					
					let previousFamId = new ObjectId(previousFamilyId)

					if(!familyId.equals(previousFamId))  {
						// console.log('current familyId and previous are different!')
						numFamilies++;
						element.familyInit=true;
						// element.familyId=numFamilies;
						if(index>0) {
							gastroVersion.composition[previousFamilyInitIndex].familyLength=familyLength-1;
							gastroVersion.composition[previousFamilyInitIndex].numSubfamilies=numSubfamilies;
						}
						familyLength=1;
						numSubfamilies=0;
						// subfamilyId=0;
						if(element.family._id){
							previousFamilyId=element.family._id;
						} else {
							previousFamilyId=element.family;
						}
						
						// console.log(previousFamilyId, 'previousFamilyId after setting')
						previousFamilyInitIndex=index;
					}

					// console.log(element.subfamily, 'subFamilyId')
					// console.log(previousSubfamilyId, 'previousSubfamilyId')
					let subfamilyId
					if(element.subfamily._id){

						subfamilyId = new ObjectId(element.subfamily._id)

					} else {
						subfamilyId = new ObjectId(element.subfamily)

					}
					
					let previousSubfamId = new ObjectId(previousSubfamilyId)

					if(!subfamilyId.equals(previousSubfamId)) {
						// console.log('current subFamilyId and previous are different!')
						numSubfamilies++;
						element.subfamilyInit=true;
						// if (element.subfamily!=null) subfamilyId++;
						// element.subfamilyId=numFamilies+'.'+subfamilyId;
						if(index>0) {
							gastroVersion.composition[previousSubfamilyInitIndex].subfamilyLength=subfamilyLength-1;
						}
						subfamilyLength=1;
						if(element.subfamily._id){

							previousSubfamilyId=element.subfamily._id;

						} else {

							previousSubfamilyId=element.subfamily;

						}
						
						previousSubfamilyInitIndex=index;
					}			
				})

				if(gastroVersion.composition.length>0) {
					//Add length of last family and subfamily item
					gastroVersion.composition[previousFamilyInitIndex].familyLength=familyLength;
					gastroVersion.composition[previousFamilyInitIndex].numSubfamilies=numSubfamilies;
					gastroVersion.composition[previousSubfamilyInitIndex].subfamilyLength=subfamilyLength;
				}

				cb(null, true)

			}, (docs, cb) => { 	//Reset subfamilies to null

					gastroVersion.composition.forEach((element)=> {
						if(element.subfamily && element.subfamily < 0 ) element.subfamily=null;
					})

					cb(null, true)

			}], (err, doc) => {
					if(err) return callback(err)
					callback()
		})	
	}


exports.CostsForDailyMenuAndFixedPriceCartesForPrint = (gastroOfferCompositionVersion, menuType, cb) => {
	//console.log(gastroOfferCompositionVersion[0],'GOCV[0]')
	var previousFamilyInitIndex=0;
	var previousSubfamilyInitIndex=0;
	var subfamilyTotalCost=0;
	var familyTotalCost=0;

	var meanCost = 0;

	if(gastroOfferCompositionVersion.length>0) {
		gastroOfferCompositionVersion.forEach((element, index)=>{
			if (element.subfamilyInit) {				
				if (index>0) {
					gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyMeanCost = subfamilyTotalCost

					if (menuType == 'dailyMenuCarte') {
						gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyMeanCost /= gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyLength;
					}

					familyTotalCost += gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyMeanCost;
				}
				subfamilyTotalCost = element.cost * element.numServings;
				previousSubfamilyInitIndex=index;
			} else {
				subfamilyTotalCost += element.cost * element.numServings;
			}

			if (element.familyInit) {
				if (index>0) {
					gastroOfferCompositionVersion[previousFamilyInitIndex].familyMeanCost = familyTotalCost

					if (menuType == 'dailyMenuCarte') {
						gastroOfferCompositionVersion[previousFamilyInitIndex].familyMeanCost /= gastroOfferCompositionVersion[previousFamilyInitIndex].numSubfamilies;
					}
					
					meanCost += gastroOfferCompositionVersion[previousFamilyInitIndex].familyMeanCost;
				}
				familyTotalCost = 0;
				previousFamilyInitIndex=index;
			}
		})

		//Add mean cost of last family and subfamily item
		gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyMeanCost = subfamilyTotalCost 

					if (menuType == 'dailyMenuCarte') {
					gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyMeanCost /= gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyLength;

					}

		familyTotalCost += gastroOfferCompositionVersion[previousSubfamilyInitIndex].subfamilyMeanCost;
		gastroOfferCompositionVersion[previousFamilyInitIndex].familyMeanCost = familyTotalCost 

					if (menuType == 'dailyMenuCarte') {
					gastroOfferCompositionVersion[previousFamilyInitIndex].familyMeanCost /= gastroOfferCompositionVersion[previousFamilyInitIndex].numSubfamilies;

					}

		meanCost +=gastroOfferCompositionVersion[previousFamilyInitIndex].familyMeanCost;
	} else {
		meanCost=0;
	}
	console.log(meanCost,'meanCost')
	cb(null, meanCost);
}

