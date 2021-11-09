var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.refreshAllergens;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('refreshAllergens', function(job, done){

    var Subproduct = require('../models/subproduct');
    var Product = require('../models/product');
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var totalNumRecipes;
    var recipeCount=0;
    var allergenHelper = require('../helpers/allergen')
    var erroneousAllergens=0;
    var erroneousLocationAllergens=0;
    var erroneousAllergensNames = [];
    var erroneousLocationAllergens=0;
    var erroneousLocationAllergensNames = [];
    var model = job.data.model
    var Model;

    switch(model){
    	case 'Subproduct':
    		Model=Subproduct
    		break;

    	case 'Product':
    		Model=Product
    		break;

    	case 'Dish':
    		Model=Dish;
    		break;

    	case 'Drink':
    		Model=Drink;
    		break;
    }

    async.waterfall([

      (cb)=> {

          Model.count({}, (err, count) => {
              if(err) return cb(err)
              totalNumRecipes = count;
              cb(null, true)
          })

      }, (doc, cb) => {

            async.during(
            (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                return callback(null, recipeCount < totalNumRecipes);
            },
            (callback) => {
                
              Model.findOne({},
              {
                  versions: {$elemMatch: {active: true}}
              })
	            .skip(recipeCount)
	            .limit(1)
	        		.exec((err, doc) => {

	              let parent = [];
	              parent = parent.concat(doc._id);
                //Calculate allergens in subproduct
                // console.log('Retrieved subproduct with id %s', doc._id)
                // console.log('Subproduct number is %s', recipeCount)
                recipeCount++;
                allergenHelper.computeRecipeAllergensRecursively(doc._id, Model, parent, (err, res) => {
                    if(err) {
                        logger.error('refreshAllergens - Error computing allergens of '+ model + ' with id %s', doc._id)
                        callback();
                    } 
                    else 
                    {
                    		let allergens = res.referenceAllergens;
                    		let locationAllergens = res.locationAllergens;
                    		let erroneousAllergensFlag = false;

                    		async.waterfall([

                    			(cb_2) => {

		                    		logger.info('refreshAllergens - Comparing reference allergens...')
		                        //Compare computed allergens with actual subproduct allergens
		                        logger.info('refreshAllergens - Calculated referenceAllergens: %j', allergens)
		                        logger.info('refreshAllergens - Current referenceAllergens: %j', doc.versions[0].allergens)
		                        
		                        allergenHelper.hasChanged(allergens, doc.versions[0].allergens, (hasChanged) => {
		                            
		                            if(hasChanged) {
		                            		erroneousAllergensFlag=true;
		                                erroneousAllergens++;
		                                
		                                let errAllergen = {
		                                    id: doc._id,
		                                    name: doc.versions[0].lang[0].name,
		                                    actualAllergens: doc.versions[0].allergens,
		                                    computedAllergens:allergens
		                                }

		                                erroneousAllergensNames.push(errAllergen);
		                                logger.warn('refreshAllergens - Computed allergens of %s are different!', doc.versions[0].lang[0].name)

		                            }
		                            else
		                            {   
		                                logger.info('refreshAllergens - Computed reference allergens are equal')
		                            }

		                            cb_2(null)
		                            
		                        })

		                      }, (cb_2) => {

			                    		logger.info('refreshAllergens - Comparing location allergens...')
			                        //Compare computed allergens with actual subproduct allergens

			                        let currentLocationAllergens;
			                        if(doc.versions[0].locationAllergens){
			                        	currentLocationAllergens=doc.versions[0].locationAllergens;
			                        }
			                        else
			                        {
			                        	currentLocationAllergens=[];
			                        	//Force save of recipe to set locationAllergens to []
			                        	erroneousAllergensFlag=true
			                        }

		                        	logger.info('refreshAllergens - Calculated locationAllergens: %j', locationAllergens)
		                        	logger.info('refreshAllergens - Current locationAllergens: %j', currentLocationAllergens)

			                        allergenHelper.compareLocationAllergens(locationAllergens, currentLocationAllergens, (err, equal) => {
			                        		if(!equal) {
			                        				erroneousAllergensFlag=true;
			                                erroneousLocationAllergens++;
			                                
			                                let errLocationAllergen = {
			                                    id: doc._id,
			                                    name: doc.versions[0].lang[0].name,
			                                    actualAllergens: doc.versions[0].locationAllergens,
			                                    computedAllergens:locationAllergens
			                                }

			                                erroneousLocationAllergensNames.push(errLocationAllergen);
			                                logger.warn('refreshAllergens - Computed location allergens of %s are different!', doc.versions[0].lang[0].name)
			                        		}
			                        	  else
			                            {   
			                                logger.info('refreshAllergens - Computed location allergens are equal')
			                            }

			                            cb_2(null)
			                        })	                      	


                    			}], (cb_2) => {

			                        if(erroneousAllergensFlag) {

					                        //Update allergen in recipe...
					                        Model.findOne(
					                        {
					                            _id: doc._id
					                        })
					                        .exec((err, recipe) => {

					                            recipe.versions.forEach((version) => {
					                                if(version.active){
					                                    version.allergens = allergens
					                                    version.locationAllergens = locationAllergens;
					                                }
					                            })

					                            recipe.save((err, doc) => {
					                                if(err) return callback(err);
					                                callback()
					                            })

					                        })

					                    }
					                    else
					                    {
					                    	process.nextTick(()=>callback())
					                    }

                    		})
                    }                               
                })                                              
            })
          },
          (err) => { // Finished looping through all recipes
            let responseMessage1 = "There were " + erroneousAllergens + " " + model +" with erroneous reference allergens which have been updated."
            let responseMessage2 = "There were " + erroneousLocationAllergens + " " + model +" with erroneous location allergens which have been updated."
            let res = {
                message: responseMessage1 + responseMessage2,
                erroneousAllergens: erroneousAllergensNames,
                erroneousLocationAllergens: erroneousLocationAllergensNames
            }
            if(erroneousAllergens>0 || erroneousLocationAllergens > 0) logger.error('Completed refreshAllergens method for '+ model + '. Result: %j', res)
            else logger.info('Successfully completed refreshAllergens method for '+ model + '. Result: %j', res)
        		cb(null, res)
          });      

      }], (err, docs) => {
        	if(err) return done(err)
        	done();
      })

})