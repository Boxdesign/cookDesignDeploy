var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var locHelper = require('../helpers/locations')

var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.articleQueue;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('article', function(job, done){  

	var config = require('../config/config');
	var waterfall = require('async-waterfall');
	var async = require('async');
	var {ObjectId} = require('mongodb');
	var locHelper = require('../helpers/locations')

  let articleCategory = job.data.article.category.kind;
  var articleId = job.data.article.category.item;

	var Ingredient = require('../models/ingredient');
	var Packaging = require('../models/packaging');
	var ProviderArticle = require('../models/article');
	var Location = require('../models/location');

  var totalPrice;
  var totalItems;
  var Model;
  var docArray=[];
  var saveArticle = false;
  var article;
  var locationCost = [];
  var locations;

  logger.info('Entering method to calculate ingredient or packaging avg cost based on its articles. Ing/Pack id: %s', articleId)

  async.waterfall([

    (cb) => {    

        if(articleCategory == 'ingredient') {
          Model=Ingredient;
        } else if(articleCategory == 'packaging') {
          Model=Packaging;
        }

        Model.findById(articleId, (err, doc) => {
        	if(err) return cb(err)
        	if(!doc) {
        		let err = new Error("Could not find ingredient or packaging")
        		return cb(err)
        	}
        	article=doc;
        	cb(null, true)
        })

    }, (doc, cb) => { //Get all locations

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

    }, (doc, cb) => {

        async.eachSeries(locations, function(location, cb_async_loc) { //loop through locationLoop. Must calculate cost for each of these locations.
          
          //console.log('updating location price')
          logger.info('>>>>> Evaluating location %s', location)

          ProviderArticle.find( //Find articles for this ingredient or packaging that include the location evaluated. There will be at least one result.
            {'category.item': articleId,
             'location' : {$in: [location]}
          }, (err, articles) => {
      
            if(err) return cb(err)

            let totalPrice=0;
            let totalItems=0;
            let validCalculatedCost = false;

            if(articles.length>0) { //There are articles for this ingredient and location, calculate average price
              
              logger.info('There are articles for this ingredient/packaging and location: %s', location)
              
              //calculate average price
              articles.forEach((article) => { 
                if (article.netPrice && article.netPrice !=0) { 
                  totalPrice += article.netPrice;
                  totalItems++;
                  validCalculatedCost=true;
                }
              })

              let calculatedLocCost;

              if(validCalculatedCost) {
		              calculatedLocCost = totalPrice / totalItems;
		              let costObj = {
		              	location: location,
		              	unitCost: calculatedLocCost
		              }
		              locationCost.push(costObj)
		              logger.info('Calculated cost for this location is %s', calculatedLocCost)
		          }
		          else 
		          {
		          	logger.info('Could not calculate location cost for location %s because none of the articles has a net price defined.', location)
		          }
            }
            else
            {
              logger.info('There are no articles for this ingredient/packaging and location: %s. Move on to next location.', location)
            } 
	          process.nextTick(() => cb_async_loc())   
          })

      }, (err) => { //finished async location loop

        if(err) return cb(err)

        article.locationCost = locationCost;

    	  article.save((err) => {
          if (err) {
        		logger.error('Error saving article')
    				logger.error(err)			                	
          	return cb(err)
          }
          logger.info('Saved article')
          cb(null, true)
        });

      })


    }], (err, doc) => {
    	if(err) return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
      done()
  })
});