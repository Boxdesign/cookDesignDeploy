var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.quartering;


exports.updateQuarteringsCost = (ingredient, parentIngredient, locationLoop, callback) => {

	var waste;
	var Ingredient = require('../models/ingredient')
	var quarterings;

	logger.info('Entering updateQuarteringsCost...')
	
	waterfall([

	  	(cb) => { 

  			let id;
  			if (parentIngredient) id=ingredient._id;
  			else id=ingredient.quartering;

  			//Get quarterings
	      Ingredient.find({quartering: id}, (err, docs) => {
		       quarterings = docs;

		       if(quarterings.length) { //There are quarterings, re-calculate quarterings reference price and location cost
 			       logger.info('Found %s quarterings', quarterings.length)
	          	//Calculate waste
		          waste=100;
			        quarterings.forEach(function (quartering) {
			         	//console.log(quartering.ingredientPercentage)
			            waste-=quartering.ingredientPercentage;
		        	});
  			      logger.info('Calculated waste: %s', waste)
			        //console.log('Waste: ' + waste);
			        cb(null, true)
		       }
		       else //There are no quarterings. Nothing to do...skip to end.
		       {
  			      logger.info('There are no quarterings, skip to end...')
		       		return cb(true)
		       }
	       });

		  }, (doc, cb) => {

     			async.eachSeries(quarterings, (qtr, qtr_callback) => {

	        	let locationCost = [];
	        	let referencePrice;
	        	logger.info('Evaluating quartering with id %s', qtr._id)
		         //Step 3 Calculate and save the reference price for all quarterings
		         async.eachSeries(locationLoop, (loc, cb_loc) => {

					   		netCostWithoutWaste=loc.unitCost/((100-waste)/100);

			         	let netPercentageCost =(qtr.netPercentage/100)*netCostWithoutWaste;
			         	let cost = netPercentageCost / (qtr.ingredientPercentage / 100)

	            	if (loc.location == null) { //updating referencePrice

	            		 referencePrice = cost;
	            	} 
	            	else 
	            	{
		            	//Get array index for that location and update value
									let priceObj = {
										location: loc.location,
										unitCost: cost
									}
									locationCost.push(priceObj);	
								}
								process.nextTick(()=>cb_loc());

			     	}, (err) => { //finished location loop

			     			logger.info('Finished location loop')
			     			logger.info('Calculated reference cost of %s', referencePrice)
								logger.info('Calculated location cost array of %j', locationCost)

								qtr.referencePrice = referencePrice
  							qtr.locationCost = locationCost

								if(parentIngredient){
									//If ingredient is a parent ingredient with quarterings, in addition to update referencePrice and locationCost in quarterings, update 
									//as well family, subfamily, measurementUnit and allergens.

									qtr.family = ingredient.family,
									qtr.subfamily = ingredient.subfamily,
									qtr.measurementUnit = ingredient.measurementUnit,
									qtr.allergens = ingredient.allergens
								 }

								qtr.save((err, doc) => {
                  if (err) return qtr_callback(err);
                  logger.info('Successfully saved quartering. Move on to next one...')
                  qtr_callback();
								})

			     	});

     			}, (err) => { //end of quartering loop
     					if(err) return cb(err)
     					logger.info('Finished quartering loop')
     					cb(null, true)
     			})				

	  	}], (err, doc) => { //finished waterfall
	  		if(err) {
	  			if(err == true) {
	  				logger.info('Finished updateQuarteringsCost')
	  				callback(null, doc)
	  			}
	  			else
	  			{
	  				logger.error('There is an error!')
	  				logger.error(err)
	  				callback(err)
	  			} 
	  		}
	  		else
	  		{
	  			logger.info('Finished updateQuarteringsCost')
	  			callback(null, doc)
	  		}
	  	})
}
