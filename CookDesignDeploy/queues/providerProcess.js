var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueProvider;

const queue = kue.createQueue({redis: config.redisUrl});

queue.process('provider', function(job, done){  

	var Article = require('../models/article');
  let providerId = job.data.providerId;
  let provider = job.data.provider;
  let deletedLocations = job.data.deletedLocations;
	var config = require('../config/config');
	
	var waterfall = require('async-waterfall');
	var async = require('async');
	var {ObjectId} = require('mongodb');

	Article.find({'provider':providerId})
  .exec((err,docs) => {
  	
  	if(err) cb(err)

	  logger.info("Job queue - updateProviderArticlesLocation - Entering provider job queue.")
  	
  	if(docs.length>0) {  		  		
  		
	  	logger.info("Job queue - updateProviderArticlesLocation - Provider has articles, update their locations and save them.")
			//Update articles location
			async.eachSeries(docs, function(article, cb_async) {
				//we first get the actual complete article
				Article.findById(article._id, (error,doc)=>{
					//update article's location and save
					deletedLocations.forEach((deletedLocation, index) => {
						var index = doc.location.indexOf(deletedLocation);
						if (index > -1) {
						    doc.location.splice(index, 1);
						}
					})
					//doc.location = provider.location;
					doc.save((err) => {
						if(err) {
            	logger.error('Error saving article')
        			logger.error(err)							
							cb_async(err)
						}
						cb_async();						
					})		
				});
			}, function(err,doc) { //finished iterating through docs
					if(err) return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
	  			logger.info("Job queue - updateProviderArticlesLocation - Finished updating articles.")
					done();
			});

  	} else { //Location has changed, but provider does not have articles. Move on.
  			logger.info("Job queue - updateProviderArticlesLocation - Location has changed, but provider does not have articles. Move on.")
  			done();
  	}
  })

});