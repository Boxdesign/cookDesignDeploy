var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.articleLocCostUpdate;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('articleLocCostUpdate', (job, done) =>{  

	var config = require('../config/config');
	var waterfall = require('async-waterfall');
	var async = require('async');
	var {ObjectId} = require('mongodb');
	var locHelper = require('../helpers/locations');
  var config = require('../config/config');
	var page;
	var perPage = config.articleLocCostUpdate.perPage;
	var maxLogs = config.articleLocCostUpdate.maxLogs;
	var ArticleLocCostUpdateLog = require('../models/articleLocCostUpdateLog')
  var Location = require('../models/location')
  var Packaging = require('../models/packaging')
	var Ingredient = require('../models/ingredient');
	var Article = require('../models/article');
	var during = require('async/during');
  var totalPrice;
  var totalItems;
  var Model;
  var docArray=[];
  var lastUpdateDate;
  var lastUpdatePage;
  var lastUpdateType;
  var locations;
  var lastArticlesUpdated;
  var numArticlesToUpdate;
  var articlesToUpdate;
  var nextUpdatedType;
  var logDate;
  var saveArticle;
  var articlesUpdated;

  logger.info('Entering job to calculate ingredient or packaging avg cost based on its articles.')

  async.waterfall([

    (cb) => { //Get location array

			Location.find({})  
				.exec((err,doc)=> {
					if(err) return cb(err)

					if(!doc || !doc.length) {
						let err = new Error('Could not find locations!')
						return cb(err)
					}
					locations = doc.map((x) => {return x._id})
  				logger.info('Retrieved %s locations!', locations.length);
					cb(null,doc)
				})

		}, (doc, cb) => {

			ArticleLocCostUpdateLog.find(
				{ 
					"success":true
				},
				{
					"success":1,
					"type":1,
					"date":1,
					"page":1
				})
				.sort({"date":-1})
				.exec((err,logs) => {

				 	if(err) return cb(err)
			 		
			 		if(logs && logs.length){  //Found last successful log

			 			lastUpdateDate = logs[0].date 
			 			lastUpdatePage = logs[0].page
			 			lastUpdateType = logs[0].type
			 			lastArticlesUpdated = logs[0].numArticlesUpdated;

						logger.info('Found last successful article location cost update log %s', lastUpdateDate);

			 		
			 		} else {

			 			let date = new Date();
			 			lastUpdateDate = date.toISOString();
			 			lastUpdatePage = -1;
			 			lastUpdateType = 'ingredient'
						logger.info('Could not find a successful log or simply any log. Using actual date: %s, and default values.', lastUpdateDate);

			 		}
			 		cb(null,doc)
				})

		}, (doc, cb) => { //Get total number of articles

					if(lastUpdateType == 'ingredient') {
            Model=Ingredient;
          } else if(lastUpdateType == 'packaging') {
            Model=Packaging;
          }			

          Model.count({})
          .exec((err, count) => {

          	if(err) return cb(err)

          	let nextItems = Number(perPage) * Number(lastUpdatePage) + Number(perPage);
         		let date = new Date();
			 			logDate = date.toISOString();
          	
          	if(nextItems >= Number(count)) { //Previous job reached the end of the collection! Move on to the next collection.
          		
          		switch (lastUpdateType) {

          			case 'ingredient':
          				Model = Packaging;
						 			page = 0;
						 			nextUpdatedType = 'packaging'
						 			logger.info('Switched model to packaging.')
						 		break;

						 		case  'packaging':
          				Model = Ingredient;
						 			page = 0;
						 			nextUpdatedType = 'ingredient'
						 			logger.info('Switched model to ingredient.')
						 		break;
          		}

          	}	else {
          		nextUpdatedType = lastUpdateType;
          		page = lastUpdatePage + 1;
          	}

          	cb(null, doc)
          })				

		// }, (doc, cb) => { //Get list of articles

		//  			logger.info('page %s', page)
		// 			logger.info('lastUpdateType %s', lastUpdateType)
		// 			logger.info('lastUpdateDate %s', lastUpdateDate)			

  //         Model.find({})
  //         .skip(Number(perPage) * Number(page))
  //         .limit(Number(perPage))
  //         .exec((err, docs) => {

  //         	if(err) return cb(err)
          		
  //         	if(!docs.length) { 
		// 						let err = new Error('Could not find articles!')
		// 						return cb(err)
  //         	}
  //         	articlesToUpdate = docs;
  //         	logger.info('Retried %s articles of type %s to update.', articlesToUpdate.length, nextUpdatedType)
  //         	cb(null, docs)

  //         })

    }, (docs, cb) => {

				articlesUpdated=0;
				logger.info('page %s', page)
				logger.info('lastUpdateType %s', lastUpdateType)
				logger.info('lastUpdateDate %s', lastUpdateDate)
				logger.info('Maximum number of articles to update: %s', config.articleLocCostUpdate.maxUpdatedArticles)

    		during((callback) => { //	asynchronous truth test to perform before each execution of fn. Invoked with (callback).
    			
					logger.info('Articles updated: %s', articlesUpdated)
					logger.info('Page: %s', page)

					if(articlesUpdated <= config.articleLocCostUpdate.maxUpdatedArticles) {		

		          Model.find({})
		          .skip(Number(perPage) * Number(page))
		          .limit(Number(perPage))
		          .exec((err, docs) => {

		          	if(err) return callback(err)
		          		
		          	if(!docs.length) { 
										let err = new Error('Could not find articles!')
										return callback(err)
		          	}
		          	articlesToUpdate = docs;
		          	logger.info('Retrieved article %s of type %s.', articlesToUpdate[0].lang[0].name, nextUpdatedType)

				        async.eachSeries(articlesToUpdate, (article, cb_async_article) => {

				        		saveArticle = false;
				        		logger.info('Evaluating article %s', article.lang[0].name)

						        async.eachSeries(locations, (location, cb_async_loc) => { //loop through all article's locations. Must calculate cost for each of these locations.
						          
						          Article.find( //Find articles for this ingredient or packaging that include the location evaluated. There will be at least one result.
						            {'category.item': article._id,
						             'location' : {$in: [location]}
						          }, (err, articles) => {
						      
						            if(err) return cb_async_loc(err)

						            let totalPrice=0;
						            let totalItems=0;
						            let validCalculatedCost = false;

						            if(articles.length>0) { //There are articles for this ingredient and location, calculate average price
						              
						              //calculate average price
						              articles.forEach((article) => { 

						                if (article.netPrice && article.netPrice !=0) { 
						                  totalPrice += article.netPrice;
						                  totalItems++;
						                  validCalculatedCost = true;
						                }
						              })

						              let calculatedLocCost;     

						              if(validCalculatedCost) {
						              	calculatedLocCost = totalPrice / totalItems;
						              } 

						              if(!validCalculatedCost) logger.error('Could not calculate location cost because none of the articles has a net price defined.')

				                  if (!article.locationCost) article.locationCost = [];

				                  //Get array index for that location and update value
				                  let index = locHelper.arrayPriceIndexOf(article.locationCost, location);
				                  
				                  if(index>-1) 
				                  { //There's a match!

				                    if(validCalculatedCost) 
				                    {

					                    let articleLocCost = article.locationCost[index].unitCost;

				                    	if(articleLocCost!=calculatedLocCost) {
				                    		logger.error('Location cost mismatch. Location cost for location %s should be %s instead of %s', location, calculatedLocCost, articleLocCost)
				                    		article.locationCost[index].unitCost=calculatedLocCost;
				                    		logger.info('Updated location cost to %s', calculatedLocCost)
				                    		saveArticle=true;
				                    		process.nextTick(() => cb_async_loc())
				                   //  		article.save((err) => {
									              //   if (err) return cb_async_loc(err)
									              //   logger.info('Saved article')
									              //   cb_async_loc()
									              // });
				                    		
				                    	} 
				                    	else 
				                    	{
				                    		process.nextTick(() => cb_async_loc())
				                    	}
				                    // else 
				                    // 	logger.info('Location cost match. All good.')
				                   	}
				                   	else 
				                   	{
					                    logger.info('The article has an obsolete cost entry for this location, removed the entry.')
				                   		article.locationCost.splice(index, 1) //remove from array
				                   		saveArticle=true;
				                   		process.nextTick(() => cb_async_loc())
				                  //  		article.save((err) => {
								              //   if (err) return cb_async_loc(err)
								              //   logger.info('Saved article')
								              //   cb_async_loc()
								              // });
				                   	}
				                    
				                  } 
				                  else 
				                  { //no match, add price for this location

				                    if(validCalculatedCost) {

					                    logger.error('The article does not have a cost entry %s for this location %s', calculatedLocCost, location)
					                    let costObj = {
					                      location: location,
					                      unitCost: calculatedLocCost
					                    }
					                    article.locationCost.push(costObj);
				 	                    logger.info('Added cost of %s for location %s', calculatedLocCost, location)
				 	                    saveArticle=true;
				 	                    process.nextTick(() => cb_async_loc())
															// article.save((err) => {
								       //          if (err) return cb_async_loc(err)
								       //          logger.info('Saved article')
								       //          cb_async_loc()
								       //        });            

					                  } 
					                  else 
					                  {
					                  	//Nothing to do...could not calculate location cost and there is no entry for this location.
					                  	process.nextTick(() => cb_async_loc())
					                  }  
				                  }
						            } 
						            else 
						            { //there are no articles for this ingredient/packaging and location

						              //Get ingredient or packaging to update location cost array if required              
				                  if (!article.locationCost) article.locationCost = [];

				                  //Get array index for that location and update value
				                  let index = locHelper.arrayPriceIndexOf(article.locationCost, location);
				                  
				                  if(index>-1) { //There's a match!
				                    //article.price[index].value=0;
				                    logger.error('The article has an obsolete cost entry for this location %s.', location)
				                    article.locationCost.splice(index, 1) //remove from array
				                    logger.info('Removed location cost from array.')
				                    saveArticle=true;
				                    process.nextTick(() => cb_async_loc()) 
														// article.save((err) => {
							       //          if (err) return cb_async_loc(err)
							       //          logger.info('Saved article')
							       //          cb_async_loc()
							       //        });              
				                    
				                  } else { //no match, set price to zero for this location. Move on
				                    //logger.info('The ingredient or packaging does not have a cost entry for this location as expected. All good.')
				                    // let priceObj = {
				                    //  location: location,
				                    //  value: 0
				                    // }
				                    // article.price.push(priceObj);
				                    process.nextTick(() => cb_async_loc())  
				                  }              

						            }
						            
						          })

							      }, (err) => { //finished location async loop
							        
							        if (err) return cb_async_article(err)

							        if(saveArticle) {

						        	  article.save((err) => {
					                if (err) {
		                    		logger.error('Error saving article')
		                				logger.error(err)			                	
					                	return cb(err)
					                }
		                   		articlesUpdated++;
					                logger.info('Saved article')
					                cb_async_article()
					              });

					             } 
					             else 
					             {
					             		process.nextTick(() => cb_async_article());
					             }
					          //process.nextTick(() => cb_async_article());		        
							      
							      })

				      }, (err) => { //finished articles async loop
				        if (err) return callback(err)
								callback(null, true)  //Continue during loop
				      })
          	})

					}
					else //Reached maximum number of updated articles, break during loop...
					{
						logger.info('Reached maximum number of updated articles, breaking during loop...')
						return callback(null, false)
					}

    		 }, (callback) => { //An async function which is called each time test passes. Invoked with (callback).

						if(lastUpdateType == 'ingredient') {
	            Model=Ingredient;
	          } else if(lastUpdateType == 'packaging') {
	            Model=Packaging;
	          }			

	          Model.count({})
	          .exec((err, count) => {

	          	if(err) return cb(err)

	          	let nextItems = Number(perPage) * Number(lastUpdatePage) + Number(perPage);
	         		let date = new Date();
				 			logDate = date.toISOString();
	          	
	          	if(nextItems >= Number(count)) { //Previous job reached the end of the collection! Move on to the next collection.
	          		
	          		logger.info('Previous job reached the end of the collection! Move on to the next collection')
	          		switch (lastUpdateType) {

	          			case 'ingredient':
	          				Model = Packaging;
							 			page = 0;
							 			nextUpdatedType = 'packaging'
							 			logger.info('Switched model to packaging.')
							 		break;

							 		case  'packaging':
	          				Model = Ingredient;
							 			page = 0;
							 			nextUpdatedType = 'ingredient'
							 			logger.info('Switched model to ingredient.')
							 		break;
	          		}

	          	}	else {
	          		nextUpdatedType = lastUpdateType;
	          		page++;
	          		//logger.info('Page is now %s ', page)
	          	}

          		process.nextTick(() => callback())
	          })

    		 }, (err) => { //A callback which is called after the test function has failed and repeated execution of fn has stopped. callback will be passed an error, if one occurred, otherwise null.

    		 		cb(null, true)
    		 })

		},(doc,cb) => { //Check max number of logs and remove oldest log if required

			ArticleLocCostUpdateLog.find(
				{},
				{
					"success":1,
					"type":1,
					"date":1,
					"page":1
				})
				.sort({"date":1})
				.exec((err,logs) => {

				 	if(err) return cb(err)

			 		if(logs.length >= maxLogs) {

			 			logs[0].remove((err, doc) => {
			 				if(err) return cb(err)
			 				logger.info('Removed oldest log')
			 				cb(null, true)
			 			})
			 		}
			 		else 
			 		{
			 			cb(null, true)
			 		}

				})

		},(doc,cb) => { //Generate log

				let date = new Date();

				let logEntry = {
					type : nextUpdatedType,
					numArticlesUpdated: articlesUpdated,
					date: date.toISOString(),
					success: true,
					page: page
				}

				var log = new ArticleLocCostUpdateLog(logEntry);

				log.save((err, doc) => {
					if(err) return cb(err)
 					logger.info('Saved log entry in ArticleLocCostUpdateLog collection.');

					cb(null, doc)
				})

    }], (err, doc) => {
    	
    	if(err) {

    		logger.error('There was an error executing queue %s', err.message)

				let logEntry = {
					type : nextUpdatedType,
					numArticlesUpdated: articlesToUpdate.length,
					date: date.toISOString(),
					success: false,
					page: page
				}

				log.save((err, doc) => {
					return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
				})    		
    	}

      done()
  })
});