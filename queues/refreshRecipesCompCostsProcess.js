var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueRefreshRecipesCompCosts;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('refreshRecipesCompCosts', function(job, done){
    var model = job.data.model
    var totalNumRecipes;
    var recipeCount=0;
    var costHelper = require('../helpers/cost')
    var erroneousUnitCost=0;
    var erroneousLocationCost=0;
    var erroneousCompositionCost=0;
    var erroneousUnitCostsNames = [];
    var erroneousLocationCostsNames = [];
    var erroneousCompositionCostsNames = [];
    var responseMessage;
    var Model;
    var match = 0;
    var Subproduct = require('../models/subproduct');                                                             
    var Product = require('../models/product');
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');  
    var recipeType;  
    var activeVersion;  
    var recipe;

    logger.info('refreshRecipesCompCosts ----->>>> Starting RefreshRecipesCompCosts...')

    switch(model) {
      case 'Subproduct':
        Model = Subproduct;
        recipeType = 'subproduct';
      break;
      case 'Product':  
        Model = Product;
        recipeType = 'product';
      break;
      case 'Dish':
        Model = Dish;
        recipeType = 'dish';
      break;
      case 'Drink':
        Model = Drink;
        recipeType = 'drink';
      break;      
    }

    async.waterfall([

      (cb)=> {

        Model.count({}, (err, count) => {
          if(err) return cb(err)
          totalNumRecipes = count;
        	//totalNumRecipes = 1;
          cb(null, true)
        })

      }, (doc, cb) => {

        async.during(
        (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
          return callback(null, recipeCount < totalNumRecipes);
        },
        (callback) => {

          Model
          .findOne({})
          .skip(recipeCount)
          .limit(1)
          .exec((err, doc) => {

          	if(err) return cb(err)

           	recipe = doc;          	
          	activeVersion = recipe.versions.find((version) => {return version.active == true})
            
            let parent = [];
            parent = parent.concat(recipe._id);

            recipeCount++;

            //Calculate costs in recipe
            costHelper.computeRecipeCompCostsRecursively(recipe._id, Model, parent, (err, costs) => {
              if(err) {
                logger.error('Error computing costs of recipe with id %s', recipe._id)
                callback();
              } else {

              	let erroneousRecipeCost = false;

                //-------------------------------Compare computed costs with actual recipe costs---------------------------------------
                //-- Compare unit costs
                switch(Model) {

                  case Subproduct:
                      if (activeVersion.unitCost != costs.unitCost ) {
                      erroneousRecipeCost=true;
                      erroneousUnitCost++  
                      let errUnitCosts = {
                        id: recipe._id,
                        name: activeVersion.lang[0].name,
                        actualUnitCosts: activeVersion.unitCost,
                        computedUnitCosts:costs.unitCost
                      }
                      erroneousUnitCostsNames.push(errUnitCosts);
                      logger.warn('Computed subproduct unit costs of %s are different! Current cost: %s vs. Computed cost: %s ', activeVersion.lang[0].name, activeVersion.unitCost,costs.unitCost)
                    }       
                    break;                                 
                  case Product:  
                    if (activeVersion.unitCost != costs.unitCost ) {
                      erroneousRecipeCost=true;
                      erroneousUnitCost++  
                      let errUnitCosts = {
                        id: recipe._id,
                        name: activeVersion.lang[0].name,
                        actualUnitCosts: activeVersion.unitCost,
                        computedUnitCosts:costs.unitCost
                      }
                      erroneousUnitCostsNames.push(errUnitCosts);
                      logger.warn('Computed product unit costs of %s are different! Current cost: %s vs. Computed cost: %s', activeVersion.lang[0].name, activeVersion.unitCost,costs.unitCost)
                    }
                     if (activeVersion.compositionCost != costs.compositionCost ) {
                     	erroneousRecipeCost=true;
                      erroneousCompositionCost++  
                      let errCompositionCosts = {
                        id: recipe._id,
                        name: activeVersion.lang[0].name,
                        actualUnitCosts: activeVersion.compositionCost,
                        computedUnitCosts:costs.compositionCost
                      }
                      erroneousCompositionCostsNames.push(errCompositionCosts);
                      logger.warn('Computed product composition costs of %s are different! Current cost: %s vs. Computed cost: %s', activeVersion.lang[0].name, activeVersion.compositionCost, costs.compositionCost)
                    }

                    break;

                  case Dish:
                  case Drink:
                    if (activeVersion.costPerServing != costs.costPerServing ) {
                    	erroneousRecipeCost=true;
                      erroneousUnitCost++  
                      let errUnitCosts = {
                        id: recipe._id,
                        name: activeVersion.lang[0].name,
                        actualUnitCosts: activeVersion.costPerServing,
                        computedUnitCosts:costs.costPerServing
                      }
                      erroneousUnitCostsNames.push(errUnitCosts);
                      if(Model == Dish) logger.warn('Computed dish costPerServing of %s are different! Current costPerServing: %s vs. Computed costPerServing: %s', activeVersion.lang[0].name, activeVersion.costPerServing, costs.costPerServing)
                      if(Model == Drink) logger.warn('Computed drink costPerServing of %s are different! Current costPerServing: %s vs. Computed costPerServing: %s', activeVersion.lang[0].name, activeVersion.costPerServing, costs.costPerServing)
                    }
                  break;

                  default: 
                      logger.error('Could not match any model!')
                  break;
                }

                //-- Compare location costs
                if (activeVersion.locationCost.length == costs.locationCost.length) {
                  match = 0;
                  
                  activeVersion.locationCost.forEach((locationCost1) => {
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
                  
                  if (match != activeVersion.locationCost.length) {
                  	erroneousRecipeCost=true;
                    erroneousLocationCost++
                    let errLocationCosts = {
                      id: recipe._id,
                      name: activeVersion.lang[0].name,
                      actualLocationCost: activeVersion.locationCost,
                      computedLocationCost:costs.locationCost
                    }
                    erroneousLocationCostsNames.push(errLocationCosts);
                    logger.warn('Computed location costs of %s are different!', activeVersion.lang[0].name)
                  }
                
                } else {

                	erroneousRecipeCost=true;
                  erroneousLocationCost++;
                  let errLocationCosts = {
                    id: recipe._id,
                    name: activeVersion.lang[0].name,
                    actualLocationCost: activeVersion.locationCost,
                    computedLocationCost:costs.locationCost
                  }
                  erroneousLocationCostsNames.push(errLocationCosts);
                  logger.warn('Computed location costs of %s are different!', activeVersion.lang[0].name)
                }

                if(erroneousRecipeCost) {

                	logger.info('Recipe costs are incorrect, update and saved.')
	                //Update costs in recipe...
	                switch(Model) {
	                  case Subproduct:
	                      activeVersion.unitCost = costs.unitCost
	                      activeVersion.locationCost = costs.locationCost
	                    break;
	                  case Product: 
	                      activeVersion.unitCost = costs.unitCost
	                      activeVersion.compositionCost = costs.compositionCost
	                      activeVersion.locationCost = costs.locationCost
	                    break;
	                  case Dish:
	                  case Drink:
	                      activeVersion.costPerServing = costs.costPerServing
	                      activeVersion.locationCost = costs.locationCost                  
	                    break;
	                }

	                recipe.save((err, doc) => {
	                  if(err) {
	                  	logger.error('Error saving recipe %s', recipe._id)
                      logger.error(err)                      
	                  	callback();
	                  }
	                  else
	                  {
	                  	logger.info('Recipe saved with updated cost')
	                  	let av = doc.versions.find((version) => {return version.active == true})
	                  	logger.info('Location cost for %s: %j', av.lang[0].name, av.locationCost)
	                  	callback()
	                  }
	                })
	              }
	              else
	              {
	              	logger.info('Recipe costs are correct, move on to next recipe.')
	              	callback()
	              }
              }
            })
          })   

        }, (err) => { // Finished looping through all recipes
          if(erroneousUnitCost>0) logger.error('There were %s erroneous unit cost from %s recipes of type %s', erroneousUnitCost, totalNumRecipes, recipeType)
          if(erroneousLocationCost>0) logger.error('There were %s erroneous location cost from %s recipes of type %s', erroneousLocationCost, totalNumRecipes, recipeType)
          if(erroneousCompositionCost>0) logger.error('There were %s erroneous composition cost from %s recipes of type %s', erroneousCompositionCost, totalNumRecipes, recipeType)
          responseMessage = "There were " + erroneousUnitCost + " recipes of type " + recipeType + " with erroneous unit cost," + erroneousLocationCost + " with erroneous location cost and "+ erroneousCompositionCost +" with erroneous composition cost which have been updated."
          let result = {
            message: responseMessage,
            erroneousUnitCost: erroneousUnitCostsNames,
            erroneousLocationCost: erroneousLocationCostsNames,
            erroneousCompositionCost: erroneousCompositionCostsNames
          }
          logger.info('Result: %j', result)
          logger.info('Successfully completed refreshCosts method for recipes. ')
          cb(null, result)
        })    

      }], (err, docs) => {
          if(err) return done(err)
          done();
      })  
})