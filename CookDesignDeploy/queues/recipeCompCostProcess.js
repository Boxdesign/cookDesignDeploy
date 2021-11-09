var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueRecipeCompCost;

const queue = kue.createQueue({redis: config.redisUrl});

queue.process('updateRecipeCompCost', function(job, done){  

  //Method inputs
  var locationLoop = job.data.locationLoop;
  var id = new ObjectId(job.data.id); //id of ingredient or subproduct which cost has changed

	var Subproduct = require('../models/subproduct');
	var Dish = require('../models/dish');
	var Product = require('../models/product');
	var Drink = require('../models/drinks');
  
  var conversionTable = [];
  var Models = [Subproduct, Dish, Drink, Product];
  var waterfall = require('async-waterfall');
  var async = require('async');
  var filterPipeline;

  logger.info('UpdateRecipeCompCost - Entering queue...'); 
  logger.info('UpdateRecipeCompCost - id of ingredient or subproduct which cost has changed is %s', id); 
  logger.info('UpdateRecipeCompCost - Location loop is %j', locationLoop);  

  //if locationLoop contains a change in reference price (location is null), then all recipes containing this ingredient or subproduct must be updated
  //if locationLoop does not contain a change in reference price, then must find those recipes that contain the ingredient and subproduct and include at least one of the locations which cost has been updated.

  let referencePriceUpdate = locationLoop.find((loc) => {return loc.location == null})

  if(referencePriceUpdate) {
  	logger.info('UpdateRecipeCompCost - reference price has changed. Find all recipes that include ingredient or subproduct regardless of location.')
  	filterPipeline = {
	      	"versions.composition.element.item":id
	      }
  }
  else
  {
  	logger.info('UpdateRecipeCompCost - reference price has not changed. Find all recipes that include ingredient or subproduct and include at least one of the updated locations.')
  	let locs = locationLoop.map((x) => {return x.location;}) //Map location loop back to array of location ids
  	filterPipeline = {
	      	"versions.composition.element.item":id,
	      	"location": {$in: locs}
	      }
  }
  
  async.eachSeries(Models, (Model, cb_async_model) => { 
      
      if(Model == Dish) logger.info('UpdateRecipeCompCost - Updating dishes composition cost')
      if(Model == Drink) logger.info('UpdateRecipeCompCost - Updating drinks composition cost')
      if(Model == Product) logger.info('UpdateRecipeCompCost - Updating products composition cost')
      if(Model == Subproduct) logger.info('UpdateRecipeCompCost - Updating subproducts composition cost')

      //Find recipes which include subproduct or ingredient. We are only interested in those recipes which have at least one of the 
    	//locations updated (add, edit or delete)
      Model.find(
	      filterPipeline
    	).exec((err, recipes) => {

       	if(err) return cb_async_model(err)

        if(Model == Dish) logger.info('UpdateRecipeCompCost - Found %s dishes with comp element', recipes.length)
        if(Model == Drink) logger.info('UpdateRecipeCompCost - Found %s drinks with comp element', recipes.length)
        if(Model == Product) logger.info('UpdateRecipeCompCost - Found %s products with comp element', recipes.length)
        if(Model == Subproduct) logger.info('UpdateRecipeCompCost - Found %s subproducts with comp element', recipes.length)

        //Go over recipes. If docs is empty it won't go in.
        async.eachSeries(recipes, (recipe, cb_async_recipe) => {

          logger.info('UpdateRecipeCompCost - Evaluating recipe with id %s: ', recipe._id)
          logger.info('UpdateRecipeCompCost - Recipe location is %j', recipe.location)

        	//Get active version of recipe
        	let activeVersion = recipe.versions.find((x) => {return x.active})

          if(activeVersion) {

          		logger.info('UpdateRecipeCompCost - retrieved active version of recipe with version id %s', activeVersion._id)
		          
		          async.waterfall([

		          	(cb) => {

				          //If the cost update was for a reference cost, recalculate the price of the recipe version for all the composition locations
				          costHelper.calculateRecipeCompLocationCosts(activeVersion, recipe.location, Model, (err, res) => {
				            if(err) return cb(err)
				            
				            switch(Model){

				            	case Subproduct:
				                activeVersion.locationCost = res.locationCost;
				                activeVersion.unitCost = res.unitCost;
				            		logger.info('UpdateRecipeCompCost - Recalculated subproduct unit and location cost. Location cost is %j and unit cost is %s', res.locationCost,res.unitCost);
				            	break;

				            	case Product:
				                activeVersion.locationCost = res.locationCost;
				                activeVersion.compositionCost = res.compositionCost;
				                activeVersion.totalCost = activeVersion.packagingCost + activeVersion.compositionCost;
 				            		logger.info('UpdateRecipeCompCost - Recalculated product compositionCost and location cost. Location cost is %j and compositionCost is %s', res.locationCost,res.compositionCost);
				            	break;

				            	case Dish:
				          			activeVersion.locationCost = res.locationCost;
				          			activeVersion.costPerServing = res.costPerServing;
 				            		logger.info('UpdateRecipeCompCost - Recalculated dish costPerServing and location cost. Location cost is %j and costPerServing is %s', res.locationCost,res.costPerServing);
				          		break;

				            	case Drink:
				          			activeVersion.locationCost = res.locationCost;
				          			activeVersion.costPerServing = res.costPerServing;
 				            		logger.info('UpdateRecipeCompCost - Recalculated drink costPerServing and location cost. Location cost is %j and costPerServing is %s', res.locationCost,res.costPerServing);
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
		          			if(err) {
		          				logger.error('Error saving recipe %j', recipe)
		          				logger.error(err)
		          			}
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
      logger.info('UpdateRecipeCompCost - Finished queue job successfully')
      done();
    })
	
})