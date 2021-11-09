var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueUpdateMeasUnit;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('measUnit', function(job, done){

    var Subproduct = require('../models/subproduct');
    var Dish = require('../models/dish');
    var Product = require('../models/product');
    var Drink = require('../models/drinks');
    var MeasUnit = require('../models/measurementUnit')
    var Models = [Subproduct, Product, Dish, Drink];
    var matches = [];
    var measUnitId = new ObjectId(job.data.measUnit)
    var id = new ObjectId(job.data.id)
    var baseUnitShortName;

 		logger.info('measUnitProcess ---->>>>>> Entering update mesuring unit in recipes queue...')

    waterfall([

        (cb_1) => { //Get new measurement unit short name

          MeasUnit.findById(measUnitId, (err, doc) => {
            if(err) return cb(err)
            baseUnitShortName = doc.lang[0].shortName; //ToDo: filter by user language. Problem is that user data is in the request
                                                       // and the request can't be accessed from a Mongoose hook
            logger.info('Retrieved new measurement unit short name')
            cb_1(null, true)
          })

        }, (docs, cb_1) => {

          async.eachSeries(Models, (Model, cb_async1) => { //iteration function, to jump to the next iteration call cb_async1
             
          	switch (Model) {
          		case Subproduct:
          			logger.info('Evaluating subproducts.')
          		break;
          		case Product:
          			logger.info('Evaluating products.')
          		break;
          		case Dish:
          			logger.info('Evaluating dishes.')
          		break;
          		case Drink:
          			logger.info('Evaluating drinks.')
          		break;            		            		
          	}

						Model.find(
						 	{
						 		"versions.composition.element.item": id
							}
						).exec((err, docs) => {          	

                if (err)  return cb_1(err); 

                switch (Model) {
	            		case Subproduct:
	            			logger.info('Found %s subproducts', docs.length)
	            		break;
	            		case Product:
	            			logger.info('Found %s products.', docs.length)
	            		break;
	            		case Dish:
	            			logger.info('Found %s dishes.', docs.length)
	            		break;
	            		case Drink:
	            			logger.info('Found %s drinks.', docs.length)
	            		break;            		            		
	            	}

	            	if(docs.length) {

	                waterfall([
	                  (cb_2) => {

	                      docs.forEach((doc) => {

													let activeVersion = doc.versions.find((version) => {return version.active})

													if(activeVersion) {

		                        //Go over composition of version
		                        activeVersion.composition.forEach((compElement) => { 
		                            
		                            let compElementId = new ObjectId(compElement.element.item);

		                            if(compElementId.equals(id)) {
		                              compElement.baseUnit= measUnitId;
		                              compElement.baseUnitShortName= baseUnitShortName; 
		                              //If measuring unit is not equal to base unit, then it will no longer be valid.
		                              //As a workaround, set measuringUnit to equal base unit and recalculate costs.
		                              compElement.measuringUnit = measUnitId;
		                              compElement.measuringUnitShortName = baseUnitShortName;
		                            }
		                        })
		                       }
	                      })

	                      cb_2(null, docs)

	                  }, (docs, cb_2) => {
	                  	
												switch (Model) {

					            		case Subproduct:
					            			logger.info('Updated measuring unit in subproduct docs, next step is saving them.')
					            		break;
					            		case Product:
					            			logger.info('Updated measuring unit in products docs, next step is saving them.')
					            		break;
					            		case Dish:
					            			logger.info('Updated measuring unit in dishes docs, next step is saving them.')
					            		break;
					            		case Drink:
					            			logger.info('Updated measuring unit in drinks docs, next step is saving them.')
					            		break;            		            		
					            	}

	                      //Save updated docs
	                      async.eachSeries(docs, (doc, cb_async2) => {

	                        doc.save((err) => {
	                        	if(err) {
				                    	logger.error('Error saving recipe')
				                			logger.error(err)                          		
	                        	}
	                        	cb_async2();           
	                          })    
	                      }, (err) => { //finished async2 loop
	                          
	                          if(err) return cb_2(err)

					                  switch (Model) {
							            		case Subproduct:
							            			logger.info('Finished saving subproducts.')
							            		break;
							            		case Product:
							            			logger.info('Finished saving products.')
							            		break;
							            		case Dish:
							            			logger.info('Finished saving dishes.')
							            		break;
							            		case Drink:
							            			logger.info('Finished saving drinks.')
							            		break;            		            		
							            	}  

	                          cb_2(null, true)
	                      });

	                }], (err, doc) =>   {
	                  if(err) return cb_async1(err);
	                  cb_async1();
	                }) 
	              }
	              else
	              {
						      if(Model == Dish) logger.info('allergenQueue - There are no dishes, move on.')
						      if(Model == Drink) logger.info('allergenQueue - There are no drinks, move on.')
						      if(Model == Product) logger.info('allergenQueue - There are no products, move on.')
						      if(Model == Subproduct) logger.info('allergenQueue - There are no subproducts, move on.')
	              	cb_async1();
	              }
                                     
            })
          }, (err) => { //function called when iteration finished
              if(err) return cb_1(err)
              logger.info('Finished updating recipes')
              cb_1(null, true) //jump to waterfall final step
          });

      }], (err, doc) =>   {
		      if (err) {
		      	logger.error(err)
		      	return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
		      }
 					logger.info('measUnitProcess <<<<<----Finished update mesuring unit in recipes queue...')
		      done();
      }) 
});