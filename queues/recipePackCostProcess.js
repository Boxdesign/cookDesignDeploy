var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queuePackCost;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('updateRecipePackCost', function(job, done){  

	var config = require('../config/config');
	var waterfall = require('async-waterfall');
	var async = require('async');
	var {ObjectId} = require('mongodb');
	var costHelper = require('../helpers/cost');
	var locHelper = require('../helpers/locations')	

  var locationLoop = job.data.locationLoop;
  var id = new ObjectId(job.data.id); //id of packaging which cost has changed

	var Product = require('../models/product');

  logger.info('UpdateRecipePackCost - Entering update products packaging cost function'); 
  
  let referencePriceUpdate = locationLoop.find((loc) => {return loc.location == null})

  if(referencePriceUpdate) {
  	logger.info('UpdateRecipePackCost - reference price has changed. Find all products that include packaging regardless of location.')
  	filterPipeline = {
	      	"versions.packaging.packaging":id
	      }
  }
  else
  {
  	logger.info('UpdateRecipePackCost - reference price has not changed. Find all products that include ingredient or subproduct and include at least one of the updated locations.')
  	let locs = locationLoop.map((x) => {return x.location;}) //Map location loop back to array of location ids
  	filterPipeline = {
	      	"versions.packaging.packaging":id,
	      	"location": {$in: locs}
	      }
  }
     
  logger.info('UpdateRecipePackCost - Updating products packaging cost')

  //Find recipes which include subproduct or ingredient. We are only interested in those recipes which have at least one of the 
	//locations updated (add, edit or delete)
  Product.find(
    filterPipeline
	).exec((err, recipes) => {

   	if(err) return cb_async_model(err)

    logger.info('UpdateRecipePackCost - Found %s products with packaging element', recipes.length)

    //Go over recipes. If docs is empty it won't go in.
    async.eachSeries(recipes, (recipe, cb_async_recipe) => {

      logger.info('UpdateRecipePackCost - Evaluating product with id %s: ', recipe._id)
      logger.info('UpdateRecipePackCost - Recipe location is %j', recipe.location)

    	//Get active version of recipe
    	let activeVersion = recipe.versions.find((x) => {return x.active})

      if(activeVersion) {

      		logger.info('UpdateRecipePackCost - retrieved active version of product with version id %s', activeVersion._id)
          
          async.waterfall([

          	(cb) => {

		          //If the cost update was for a reference cost, recalculate the price of the recipe version for all the composition locations
            	costHelper.calculateRecipePackLocationCosts(activeVersion, recipe.location, Product, (err, res) => {		            

		            if(err) return cb(err)
                activeVersion.packLocCost = res.packLocCost;
                activeVersion.packagingCost = res.packagingCost;
                activeVersion.unitCost = res.unitCost;
                activeVersion.totalCost = activeVersion.packagingCost + activeVersion.compositionCost;
                logger.info('UpdateRecipePackCost - Calculated packLocCost: %j',activeVersion.packLocCost)
                logger.info('UpdateRecipePackCost - Calculated packagingCost: %j',activeVersion.packagingCost)
                logger.info('UpdateRecipePackCost - Calculated unitCost: %j',activeVersion.unitCost)
                logger.info('UpdateRecipePackCost - Calculated totalCost: %j',activeVersion.totalCost)

		            cb(null)
		          })                                

          	},(cb) => {

              //recalculate sum of composition and packaging cost arrays
              locHelper.sumLocCostArrays(activeVersion.locationCost || [], activeVersion.packLocCost || [], (err, res) => {
                  if(err) return cb(err)
                  activeVersion.totalLocCost=res;
                  logger.info('UpdateRecipePackCost - Calculated and updated totalLocCost of product: %j',res)
                  cb(null)
              })


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
       		logger.error("Could not find active version for product %s", recipe._id)
       		cb_async_recipe()
       }

    }, (err) => { //End of recipes loop
  		if (err) return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
  		logger.info('UpdateRecipePackCost - Finished queue job successfully')
  		done();
    })

  }) //Model find

})