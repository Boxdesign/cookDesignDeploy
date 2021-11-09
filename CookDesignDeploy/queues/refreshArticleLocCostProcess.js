var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.refreshArticleLocCost;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('refreshArticleLocCost', function(job, done){

 		var totalNumIngs;
  	var articleCount=0;
  	var updatedArticles=0;
  	var async = require('async');
		var twentyFivePercent = false;
		var fiftyPercent = false;
		var seventyFivePercent = false;
		var model = job.data.model;
		var Model;
		var Ingredient = require('../models/ingredient')
		var Packaging = require('../models/packaging')

		logger.info('refreshLocationCost - Entering method...')

		switch(model){
			case 'ingredient':
				Model = Ingredient;
				break;

			case 'packaging':
				Model = Packaging;
				break;
		}

    async.waterfall([

      (cb)=> {
        
        Model.count({}, (err, count) => {
          if(err) return cb(err)
          totalNumIngs = count;
        	logger.info('refreshLocationCost - There are %s %s to refresh', count, model)
          cb(null, true)
        })
      
      }, (doc, cb) => {

      	logger.info('refreshLocationCost - Starting %s location update...', model)
        
        async.during(
        (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
          return callback(null, articleCount < totalNumIngs);
        },
        (callback) => {

        	Model
          .findOne({})
          .skip(articleCount)
          .limit(1)
          .exec((err, doc) => {

          	if(err) callback(err)

          	articleCount++;

          	let percentage = (articleCount / totalNumIngs) *100;

          	if(!twentyFivePercent) {
          		if(percentage>25){
          			twentyFivePercent=true;
          			logger.info('refreshLocationCost - 25% completed...')
          		}
          	}

          	if(!fiftyPercent) {
          		if(percentage>50){
          			fiftyPercent=true;
          			logger.info('refreshLocationCost - 50% completed...')
          		}
          	}  

          	if(!seventyFivePercent) {
          		if(percentage>75){
          			seventyFivePercent=true;
          			logger.info('refreshLocationCost - 75% completed...')
          		}
          	}

          	if(model == 'ingredient' && doc.quartering) {
          		//If ingredient is a quartering it does not have providers. Location costs are derived from parent ingredient not providers, skip to next ingredient.
          		callback();
          	}
          	else
          	{
	          	singleArticleLocCost(doc.id, model, (err, updated) => {
	          		if(err) {
	          			logger.error(err)
	          		}

	          		if(updated) updatedArticles++;

	          		callback();
	          	})				
          	}
					})

        }, (err) => { // Finished looping through all ingredients
        	 if(err) return cb(err)
  	       logger.info('refreshLocationCost - Finished looping through all %s...', model)
  	     	 if(updatedArticles) logger.error('refreshLocationCost - There were %s incorrect %s', updatedArticles, model)
  	     	 else logger.info('refreshLocationCost - All %s location costs are correct!!!', model)
        	 cb(null, true)
 		    })   	

      }], (err, docs) => {
        	if(err) return done(err)
        	done();
      })

})


function singleArticleLocCost(articleId, model, callback) {  

	var config = require('../config/config');
	var waterfall = require('async-waterfall');
	var async = require('async');
	var {ObjectId} = require('mongodb');
	var locHelper = require('../helpers/locations');
  var config = require('../config/config');
  var Location = require('../models/location')
  var Packaging = require('../models/packaging')
	var Ingredient = require('../models/ingredient');
	var Article = require('../models/article');
  var Model;
  var docArray=[];
  var locations;
  var saveArticle=false;

  logger.info('Entering job to calculate single %s avg cost based on its articles.', model)

  async.waterfall([

    (cb) => { //Get location array

			Location.find({})  
				.exec((err,docs)=> {
					if(err) return cb(err)

					if(!docs || !docs.length) {
						let err = new Error('Could not find locations!')
						return cb(err)
					}
					locations = docs.map((x) => {return x._id})
  				logger.info('Retrieved %s locations!', locations.length);
					cb(null,docs)
				})

    }, (docs, cb) => {

    		if(!articleId) {
					let err = new Error('Article id param not provided. Skipping!')
					return cb(err)    			
    		}

    		if(!model) {
					let err = new Error('Model param not provided. Skipping!')
					return cb(err)    			
    		}

    		cb(null, docs)

    }, (docs, cb) => {

    			if(model == 'ingredient') {
    				logger.info('Article is an ingredient.')
    				Model = Ingredient;
    			} else if(model == 'packaging') { 
    				logger.info('Article is a packaging.')
    				Model = Packaging;
    			}

          Model.findOne({_id: articleId})
          .exec((err, doc) => {

          	if(err) return cb(err)
          		
          	if(!doc) { 
								let err = new Error('Could not find article!')
								return cb(err)
          	}

          	let article = doc;

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

		              if(!validCalculatedCost) logger.warn('Could not calculate location cost because none of the articles has a net price defined.')

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
	                    logger.error('The article has an obsolete cost entry for this location, removed the entry.')
	                 		article.locationCost.splice(index, 1) //remove from array
	                 		saveArticle=true;
	                 		process.nextTick(() => cb_async_loc())
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
			        
			        if(err) return cb(err)

			        if(saveArticle) {

		        	  article.save((err) => {
	                if (err) {
	              		logger.error('Error saving article')
	          				logger.error(err)			                	
	                	return cb(err)
	                }
	                logger.info('Saved article')
	                cb(null, true)
	              });

	             } 
	             else 
	             {
	             		logger.info('Article not saved because there is nothing to update.')
	             		cb(null, true)
	             }
			      })
          })

    }], (err, doc) => {
    	
    	if(err) {
    		logger.error('There was an error executing queue %s', err.message)
    		return callback(err)
    	}
    	logger.info('Successfully completed job.')
      callback(null, saveArticle)
  	})
};