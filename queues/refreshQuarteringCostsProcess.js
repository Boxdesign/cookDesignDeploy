var kue = require('kue');
var config = require('../config/config');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.refreshQuarteringCosts;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('refreshQuarteringCosts', function(job, done){

 		var totalNumIngs;
  	var ingCount=0;
  	var async = require('async');  	
    var quarteringHelper = require('../helpers/quartering'); 
    var waste = 100;
		var netCostWithoutWaste;
		var cost;
		var locationLoop = [];
		var quarterings;
		var locHelper = require('../helpers/locations')
	  var Ingredient = require ('../models/ingredient');
    var recipeCostQueue = require('../queues/recipeCompCost')
 
  	logger.info('updateQuarteringsCost - Entering method...')

    async.waterfall([

      (cb)=> {
        
        Ingredient.count({}, (err, count) => {
          if(err) return cb(err)
          totalNumIngs = count;
        	logger.info('updateQuarteringsCost - There are %s ingredients to refresh', count)
          cb(null, true)
        })
      
      }, (doc, cb) => { 

      	logger.info('updateQuarteringsCost - Starting ingredient quarterings update...')
        
        async.during(
        (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).

          return callback(null, ingCount < totalNumIngs);
        },
        (callback) => {

			    async.waterfall([

			      (cb_2)=> { //Get ingredient

		        	Ingredient
		          .findOne({})
		          .skip(ingCount)
		          .limit(1)
		          .exec((err, doc) => {

		          	if(err) callback(err)

		          	ingredient = doc;
		          	ingCount++;

  	          	cb_2(null, true)

		         })

			      }, (doc, cb_2) => { //Check whether ingredient has quarterings

			      	//find all quartering siblings
				      Ingredient.find({quartering: ingredient._id}, function(err, docs) {
				          //Calculate waste
				         
				         if(docs.length) 
				         {
				         	logger.info('<<<<---- Ingredient %s has %s quarterings, calculate... --->>>>', ingredient.lang[0].name, docs.length)
				         	 quarterings = docs;
				         	 cb_2(null, true)
				         }
				         else
				         {
				         		logger.info('Ingredient does not have quarterings, move on to next one...');
				         		//logger.info('Ingredient %s does not have quarterings, move on...', ingredient.lang[0].name)
				         		return cb_2(true)
				         }
				         
				       });

			      }, (doc, cb_2) => { //Ingredient has quarterings

			  				waste = 100;
			  				locationLoop=[];

			  				quarterings.forEach(function (quartering) {
			         	//console.log(quartering.ingredientPercentage)
			            waste-=quartering.ingredientPercentage;
		        		 });			      	

								let refObject = {
			         		location: null,
			         		unitCost: ingredient.referencePrice
				        }

	         			locationLoop.push(refObject);

	         			if(ingredient.locationCost) locationLoop = locationLoop.concat(ingredient.locationCost)			      	

			     			async.eachSeries(quarterings, (qtr, qtr_callback) => {

			     				if(!qtr.locationCost) qtr.locationCost = []

				        	let locationCost = [];
				        	let referencePrice;
				        	logger.info('|--- Evaluating quartering with id %s ---|', qtr._id)
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
  										qtr.family = ingredient.family
  										qtr.subfamily = ingredient.subfamily
  										qtr.measurementUnit = ingredient.measurementUnit
  										qtr.allergens = ingredient.allergens

											qtr.save((err, doc) => {
			                  if (err) return qtr_callback(err);
			                  logger.info('Successfully saved quartering. Move on to next one...')
			                  qtr_callback();
											})

									})

						   	}, (err) => { //End of quartering loop
						   		if(err) return cb_2(err)
						   		logger.info('Finished calculating ref cost and location cost for all ingredient\'s quarterings, move on to next ingredient...')
						   		cb_2(null, true)
						   	})


			      }], (err,doc) => { //Ebd of cb_2 waterfall

			      	if(err){
			      		if(err == true)  { //Ingredient does not have quarterings
			      			callback()
			      		}
			      		else
			      		{
			      			logger.error(err)
			      			callback()
			      		}
			      	}
			      	else
			      	{
			      		callback();
			      	}      	
			      })					

        }, (err) => { // Finished looping through all ingredients
        	 if(err) return cb(err)
  	       logger.info('updateQuarteringsCost - Finished looping through all ingredients...')
        	 cb(null, true)
 		    })   	

      }], (err, docs) => { //end of cb_1 waterfall
          if(err) return done(err)
          logger.info('Finished method successfully!!')
          done();
      })
})