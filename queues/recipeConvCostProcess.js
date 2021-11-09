var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueRecipeConvCost;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('updateRecipeConvCost', function(job, done){ 
  var config = require('../config/config');
	var waterfall = require('async-waterfall');
	var async = require('async');
	var {ObjectId} = require('mongodb');
	var costHelper = require('../helpers/cost');
	var locHelper = require('../helpers/locations')

	//Method inputs
	var measuringUnitId = new ObjectId(job.data.measurementUnitId); //id of measuring unit whose conversion has changed
	var baseUnitId = new ObjectId(job.data.parentUnitId); //id of conversion (to base unit) that has changed
	var ingredientId = new ObjectId(job.data.id); //id of ingredient which equivalence unit has changed
	var equivalenceUnitFlag = job.data.equivalenceUnitFlag;
  var updatedEqQty = job.data.equivalenceQty;
	var measuringUnitPipeline = {};
  var baseUnitPipeline = {};
	var elementPipeline = {};

	var Subproduct = require('../models/subproduct');
	var Dish = require('../models/dish');
	var Product = require('../models/product');
	var Drink = require('../models/drinks');

  var conversionTable = [];
  var Models = [Subproduct, Product, Dish, Drink];
  var locCostArray = [];
  var previousLocationLoop = [];
  var filterPipeline;


  logger.info('updateRecipeConvCost - Entering update recipes convertion cost function'); 
  logger.info('updateRecipeConvCost - measuringUnitId %s', measuringUnitId); 
  logger.info('updateRecipeConvCost - baseUnitId %s', baseUnitId); 
  logger.info('updateRecipeConvCost - equivalenceUnitFlag %s', equivalenceUnitFlag)
  logger.info('updateRecipeConvCost - ingredient id %s', ingredientId)
  logger.info('updateRecipeConvCost - updatedEqQty %s', updatedEqQty)

	if(equivalenceUnitFlag) { //Equivalence unit update. Job coming from ingredient model.   

		filterPipeline = {
			"versions.composition.measuringUnit" : null,
			"versions.composition.element.item" : ingredientId
		}

	} else { //Measuring unit conversion cost update. Job coming from measuring unit model.

		filterPipeline = {
			"versions.composition.measuringUnit" : measuringUnitId,
			"versions.composition.baseUnit" : baseUnitId
		}
	}
  
  async.eachSeries(Models, (Model, cb_async_model) => { 
      
      if(Model == Dish) logger.info('updateRecipeConvCost - Updating dishes composition cost')
      if(Model == Drink) logger.info('updateRecipeConvCost - Updating drinks composition cost')
      if(Model == Product) logger.info('updateRecipeConvCost - Updating products composition cost')
      if(Model == Subproduct) logger.info('updateRecipeConvCost - Updating subproducts composition cost')

      //Find recipes which include subproduct or ingredient. We are only interested in those recipes which have at least one of the 
    	//locations updated (add, edit or delete)
      Model.find(
	      filterPipeline
    	).exec((err, recipes) => {

       	if(err) return cb_async_model(err)

        if(Model == Dish) logger.info('updateRecipeConvCost - Found %s dishes with comp element', recipes.length)
        if(Model == Drink) logger.info('updateRecipeConvCost - Found %s drinks with comp element', recipes.length)
        if(Model == Product) logger.info('updateRecipeConvCost - Found %s products with comp element', recipes.length)
        if(Model == Subproduct) logger.info('updateRecipeConvCost - Found %s subproducts with comp element', recipes.length)

        //Go over recipes. If docs is empty it won't go in.
        async.eachSeries(recipes, (recipe, cb_async_recipe) => {

          logger.info('updateRecipeConvCost - Evaluating recipe with id %s: ', recipe._id)
          logger.info('updateRecipeConvCost - Recipe location is %j', recipe.location)

        	//Get active version of recipe
        	let activeVersion = recipe.versions.find((x) => {return x.active})

          if(activeVersion) {

          		logger.info('updateRecipeConvCost - retrieved active version of recipe with version id %s', activeVersion._id)

							//--------------    UPDATE EQUIVALENCE UNIT QUANTITY (IF REQUIRED)  ---------------------- //
							if(equivalenceUnitFlag) {	

								activeVersion.composition.forEach((compElement) => {

									let elementId = new ObjectId(compElement.element.item);
									if(elementId.equals(ingredientId)) {	
										compElement.equivalenceUnit.quantity = updatedEqQty; 
									}
								})
							}
		          
		          async.waterfall([

		          	(cb) => {

				          //If the cost update was for a reference cost, recalculate the price of the recipe version for all the composition locations
				          costHelper.calculateRecipeCompLocationCosts(activeVersion, recipe.location, Model, (err, res) => {
				            if(err) return cb(err)
				            
				            switch(Model){

				            	case Subproduct:
				                activeVersion.locationCost = res.locationCost;
				                activeVersion.unitCost = res.unitCost;
				            		logger.info('updateRecipeConvCost - Recalculated subproduct unit and location cost. Location cost is %j and unit cost is %s', res.locationCost,res.unitCost);
				            	break;

				            	case Product:
				                activeVersion.locationCost = res.locationCost;
				                activeVersion.compositionCost = res.compositionCost;
				                activeVersion.totalCost = activeVersion.packagingCost + activeVersion.compositionCost;
 				            		logger.info('updateRecipeConvCost - Recalculated product compositionCost and location cost. Location cost is %j and compositionCost is %s', res.locationCost,res.compositionCost);
				            	break;

				            	case Dish:
				          			activeVersion.locationCost = res.locationCost;
				          			activeVersion.costPerServing = res.costPerServing;
 				            		logger.info('updateRecipeConvCost - Recalculated dish costPerServing and location cost. Location cost is %j and costPerServing is %s', res.locationCost,res.costPerServing);
				          		break;

				            	case Drink:
				          			activeVersion.locationCost = res.locationCost;
				          			activeVersion.costPerServing = res.costPerServing;
 				            		logger.info('updateRecipeConvCost - Recalculated drink costPerServing and location cost. Location cost is %j and costPerServing is %s', res.locationCost,res.costPerServing);
				            	break;
				            }

				            cb(null)
				          })                                

		          	},(cb) => {

									if(Model == Product) {
		                  //recalculate sum of composition and packaging cost arrays
		                  locHelper.sumLocCostArrays(activeVersion.locationCost || [], activeVersion.packLocCost || [], (err, res) => {
		                      if(err) return cb(err)
		                      activeVersion.totalLocCost=res;
		                      logger.info('Calculated and updated totalLocCost of product: %j',res)
		                      cb(null)
		                  })

		              } else {
		                cb(null)
		              } 

		          	},(cb) => { //Save recipe

		          		recipe.save((err) => {
		          			if(err) return cb(err)
		          			cb(null)
		          		})

		          }], (err, docs) => { //Finished cb waterfall
		          		if(err) {
		          			logger.error(err)
		          			return cb_async_recipe(err)
		          		}
		          		cb_async_recipe()
		          })
		       }
		       else
		       {
		       		logger.error("Could not find active version for recipe %s", recipe._id)
		       		cb_async_recipe()
		       }

	      }, (err) => { //End of recipes loop
	      	if(err) return cb_async_model(err)
	      	cb_async_model()
	      })

	    }) //Model find

    }, (err) => { //End of model loop
      if (err) return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
      logger.info('updateRecipeConvCost - Finished queue job successfully')
      done();
    })

})