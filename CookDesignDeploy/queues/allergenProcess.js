var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.allergenQueue;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('allergen', function(job, done){  

	var config = require('../config/config');
	var waterfall = require('async-waterfall');
	var async = require('async');
	var {ObjectId} = require('mongodb');
	var allergenHelper = require('../helpers/allergen')

  let _id = job.data._id;
  let updatedAllergens = job.data.updatedAllergens;

	var id = new ObjectId(_id); //id of ingredient or subproduct which allergens have changed
	var Dish = require('../models/dish');
	var Drink = require('../models/drinks');
	var Product = require('../models/product');
	var Subproduct = require('../models/subproduct');
 	var Models=[Dish,Drink,Product,Subproduct];

 	logger.info('allergenQueue <<<<<<------ Entering allergen queue process for recipe %s...',id)

	async.eachSeries(Models,function(Model,cb_async_model){

    if(Model == Dish) logger.info('allergenQueue - Evaluating dishes')
    if(Model == Drink) logger.info('allergenQueue - Evaluating drinks')
    if(Model == Product) logger.info('allergenQueue - Evaluating products')
    if(Model == Subproduct) logger.info('allergenQueue - Evaluating subproducts')	

		Model.find(
		 	{
		 		"versions.composition.element.item":id
			}
		).exec((err, docs) => {

				if (err) return cb_async(err)
				
	      if(Model == Dish) logger.info('allergenQueue - Found %s dishes that contain recipe', docs.length)
	      if(Model == Drink) logger.info('allergenQueue - Found %s drinks that contain recipe', docs.length)
	      if(Model == Product) logger.info('allergenQueue - Found %s products that contain recipe', docs.length)
	      if(Model == Subproduct) logger.info('allergenQueue - Found %s subproducts that contain recipe', docs.length)

				if(docs.length>0) { //matches. Re-calculate recipe allergens. computeAllergens updates docs with updated allergens.


					async.waterfall([

						(cb) => {

					      if(Model == Dish) logger.info('allergenQueue - Re-calculate dishes allergens')
					      if(Model == Drink) logger.info('allergenQueue - Re-calculate drinks allergens')
					      if(Model == Product) logger.info('allergenQueue - Re-calculate products allergens')
					      if(Model == Subproduct) logger.info('allergenQueue - Re-calculate subproducts allergens')							

								allergenHelper.computeAllergens(docs, id, updatedAllergens, Model, (err,docs) => {
									if(err) return cb(err)
						      cb(null, docs)
								})

						}, (docs, cb) => {

					      if(Model == Dish) logger.info('allergenQueue - Saving dishes')
					      if(Model == Drink) logger.info('allergenQueue - Saving drinks')
					      if(Model == Product) logger.info('allergenQueue - Saving products')
					      if(Model == Subproduct) logger.info('allergenQueue - Saving subproducts')

						  	async.eachSeries(docs, (doc, cb_async) =>{

						  		doc.save((err) => {
						  			if(err) {
		          				logger.error('Error saving allergen %j', doc)
						  				logger.error(err)
						  			}
						  			cb_async()
						  		})

						  	}, (err) => { //End of recipes loop
						  		if(err) return cb(err)
						      if(Model == Dish) logger.info('allergenQueue - Finished saving dishes')
						      if(Model == Drink) logger.info('allergenQueue - Finished saving drinks')
						      if(Model == Product) logger.info('allergenQueue - Finished saving products')
						      if(Model == Subproduct) logger.info('allergenQueue - Finished saving subproducts')
						  		cb(null)
						  	})

						}], (err) => {
								if(err) return cb_async_model(err);
								cb_async_model();
						})
				} 
				else //no matches
				{
		      if(Model == Dish) logger.info('allergenQueue - There are no dishes, move on.')
		      if(Model == Drink) logger.info('allergenQueue - There are no drinks, move on.')
		      if(Model == Product) logger.info('allergenQueue - There are no products, move on.')
		      if(Model == Subproduct) logger.info('allergenQueue - There are no subproducts, move on.')
					cb_async_model();
				}
		})
	}, (err) => { // end of async loop
		if(err) return done(err)
		logger.info('allergenQueue ------->>>> Finished allergen queue process')
    done();
	})

});