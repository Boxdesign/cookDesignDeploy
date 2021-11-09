var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var gastroCostHelper = require('../helpers/gastroCost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueGastroCompCost;
const queue = kue.createQueue({redis: config.redisUrl});

queue.process('updateGastroCompCost', function(job, done){  

  //Method inputs
  var locationLoop = job.data.locationLoop;
  var recipeId = new ObjectId(job.data.id); //id of recipe (dish, drink or product) which cost has changed
  var waterfall = require('async-waterfall');
	var async = require('async');
  var locCostArray = [];
 	var GastroOffer = require('../models/gastroOffer');
 	var costHelper = require('../helpers/cost');
	var gastroCostHelper = require('../helpers/gastroCost');
	var locHelper = require('../helpers/locations')

  logger.info(' updateGastroCompCost <<<<<< -------- Entering update gastro composition cost function. Recipe id: %s', recipeId);
  logger.info('updateGastroCompCost - Location loop: %j', locationLoop)

  let referenceCostUpdate = locationLoop.find((loc) => {return loc.location == null})

  if(referenceCostUpdate) {
  	logger.info('updateGastroCompCost - reference price has changed. Find all recipes that include packaging regardless of location.')
  	filterPipeline = {
	      	"versions.composition.element.item":recipeId
	      }
  }
  else
  {
  	logger.info('updateGastroCompCost - reference price has not changed. Find all gastros that include recipe and include at least one of the updated locations.')
  	let locs = locationLoop.map((x) => {return x.location;}) //Map location loop back to array of location ids
  	filterPipeline = {
	      	"versions.composition.element.item":recipeId,
	      	"location": {$in: locs}
	      }
  }
     
  logger.info('updateGastroCompCost - Updating gastros cost')

  //Find gastro which include subproduct or ingredient. We are only interested in those gastros which have at least one of the 
	//locations updated (add, edit or delete)
  GastroOffer.find(
    filterPipeline
	).exec((err, gastros) => {

   	if(err) return cb_async_model(err)

    logger.info('updateGastroCompCost - Found %s gastros with recipe element', gastros.length)

    //Go over gastros. If docs is empty it won't go in.
    async.eachSeries(gastros, (gastro, cb_async_gastro) => {

    	let gastroType = gastro.type[0];

      logger.info('updateGastroCompCost - Evaluating gastro with id %s ', gastro._id)
      logger.info('updateGastroCompCost - Gastro location is %j', gastro.location)
      logger.info('updateGastroCompCost - Gastro type is %s', gastroType)

    	//Get active version of gastro
    	let activeVersion = gastro.versions.find((version) => {return version.active})

      if(activeVersion) {

      		logger.info('updateGastroCompCost - Retrieved active version of gastro with version id %s', activeVersion._id)
          
          async.waterfall([

          	(cb) => {

			        gastroCostHelper.calculateGastroOfferLocCost(activeVersion, gastroType, gastro.location, (err, res) => {
			          if(err) return cb(err)

								switch(gastroType) {

									case 'menu':
				  				case 'dailyMenuCarte':
				  				case 'buffet':
				  				case 'fixedPriceCarte':

		  		          activeVersion.locationCost = res.locationCost;
					          if(gastroType == 'menu' || gastroType == 'buffet') activeVersion.totalCost = res.cost;
										else activeVersion.meanCost = res.cost;

										logger.info('updateGastroCompCost - calculated locationCost %j', activeVersion.locationCost)
										if(gastroType == 'menu') logger.info('updateGastroCompCost - calculated totalCost %s', activeVersion.totalCost)
										else logger.info('updateGastroCompCost - calculated meanCost %s', activeVersion.meanCost)

										break;

								  case 'catalog':
								  case 'carte':
								  		logger.info('updateGastroCompCost - calculateGastroOfferLocCost is just used to save the location cost')
								  		//Nothing to do. In this case the function calculateGastroOfferLocCost is just used to save the location cost
								  		//of the gastro elements (dishes, drinks or products) in each gastro element of the composition array.
								  	break;

								  default:
								    	logger.error('updateGastroCompCost - Could not identify gastro type!')
								    break;
								 }

			          cb(null)
			        })

          	},(cb) => { //Save gastro

          		gastro.save((err) => {
          			if(err) return cb(err)
          			logger.info('updateGastroCompCost - Saved gastro offer')
          			cb(null)
          		})

          }], (err) => { //Finished cb waterfall
          		if(err) {
          			logger.error(err)
          			return cb_async_gastro(err)
          		}
          		cb_async_gastro()
          })
       }
       else
       {
       		logger.error("Could not find active version for gastro %s", gastro._id)
       		cb_async_gastro()
       }

    }, (err) => { //End of gastros loop
  		if (err) return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
  		logger.info('updateGastroCompCost - Finished queue job successfully')
  		done();
    })

  }) //Model find

})