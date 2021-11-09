var kue = require('kue');
var config = require('../config/config');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.report;

const queue = kue.createQueue({redis: config.redisUrl});

queue.process('reportGastroIngredients', function(job, done){

	var async = require('async');
  var config = require('./../config/config');
  var AWS = require('aws-sdk');
  var report = require('../helpers/report')
  let params = job.data.params;
  let userProfile = job.data.userProfile;
  let token = job.data.token;
  var url;
  var Article = require('../models/article')
  var GastroOffer = require('../models/gastroOffer')
  var ProviderArticle = require('../models/article')
  var json2csv = require('json2csv');
  var fs = require('fs');
  var filterLocations = [];
  var productList = [];
  var ingredientList = [];
  var ingredientListToExport = [];
  var resultList = [];
  var kindPipeline;
  var ingredientAndArticlesByLocations = [];
  var filterLocation;
  var filterId;
  var filterIdPipeline;
  var filterTypePipeline;
  var filterLocationPipeline;
  var gastroOffers;
 	var request = require('request');
  let socket = userProfile.socket;


 	AWS.config.accessKeyId = config.awsBucket.accessKey;
 	AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

 	logger.info('Entering gastro export job.')			

  logger.debug('Report Controller --- getGastroIngredients --- Entering method')

 		async.waterfall([
    	
    	(cb) => { //Get active version of gastronomic offer

       if (params.filterId) {
          filterId = JSON.parse(params.filterId).map(function(doc) { return new ObjectId(doc); });
      } else {
          filterId = [];
      }

      filterIdPipeline = {}
			if (filterId.length > 0) {
          filterIdPipeline = {'_id': {$in: filterId}}
      }

			if (params.filterLocation) {
          filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
      } else {
          filterLocation = [];
      }

      //If an array of filter locations if provided, build the filter location pipeline
      filterLocationPipeline = {};
      if (filterLocation.length > 0) {
          filterLocationPipeline = {'location': {$in: filterLocation}}
      }

      filterTypePipeline = {}  
      if(params._gastroType) filterTypePipeline = { type: params._gastroType } //'simpleMenu','dailyMenuCarte', 'buffet', 'carte', 'fixedPriceCarte', 'catalog'

      // console.log(filterLocationPipeline, 'filterLocationPipeline')
      // console.log(filterTypePipeline, 'filterTypePipeline')
      // console.log(params.filterText, 'params.filterText')

			GastroOffer.aggregate([
				{
	 				$unwind: {
	 					path: "$versions",
	 					preserveNullAndEmptyArrays: true
	 				}
	 			},
	 			{
	 				$unwind: {
	 					path: "$versions.lang",
	 					preserveNullAndEmptyArrays: true
	 				}
	 			},
	 			{$match: filterIdPipeline},
	 			{$match: filterTypePipeline},
	 			{$match: {'versions.active' : true}}
    	], (err, docs) => {
    			if(err) return cb(err)
  				gastroOffers = docs.filter((gastroOffer) => {
			 			return gastroOffer.versions.composition.length 
			 		})
 		 			cb(null, docs)
    	})

 		}, (docs, cb) => {

 				logger.info('Filtering gastro offers...Total count: %s', gastroOffers.length)

				GastroOffer.populate(gastroOffers, {path: "versions.type versions.season"}, (err, docs) => {
	          if (err) {
	          	logger.error('Error populating gastro offers')
	          	logger.error(err)
	          	return cb(err)
	          }
          	resultList = docs
          	logger.info('List of %s gastro offers populated', resultList.length);
            cb(null, docs)
        });

		},(docs,cb)=>{

			async.eachSeries(resultList, (gastroOffer,cb_async)=>{
		    			//console.log(gastroOfferId,'gastroOfferId')
  			report.getGastroIngredients(gastroOffer._id, userProfile,(err,doc)=>{

        	if(err) return cb(err);

        	if(doc.length)	{
        		logger.info('Retrieved %s ingredients from gastro offer %s', doc.length, gastroOffer._id)
        		ingredientList = ingredientList.concat(doc);
        	}
        	else
        	{
        		logger.info('Gastro offer %s does not contain any ingredients', gastroOffer._id)
        	}

          cb_async();

        });

  		},(err)=>{
	      logger.debug('Report Controller --- getIngredientsInGastroOffer --- Obtain of reportHelper.getGastroIngredients array of ingredients Ids in gastroOffer. Total length: %s',ingredientList.length)
  			if(err) return cb(err)
    		cb(null,true)
  		})

		},(docs,cb) => {

			ingredientList = ingredientList.map((ingredient)=>{ 
				//console.log(ingredient,'ingredient')
				return {
					name: ingredient.lang[0].name,
					providerArticles: [],
					_id: ingredient._id
				}

			})
			//console.log(ingredientList.length,'resultList.length')
			ingredientList = removeDuplicates(ingredientList)
			//console.log(ingredientList.length,'RESULTLIST')
			cb(null,docs)

		},(docs,cb) => { //Get list of provider articles related to each ingredient

      async.eachSeries(ingredientList, (ingredient, cb_async) => {

          ProviderArticle.find({
                  'category.kind': 'ingredient',
                  'category.item': ingredient._id
              })
          		.populate('provider')
              .exec((err, docs) => {
                  if (err) return cb_async(err)
                  ingredient.providerArticles = docs;
                  cb_async()
              })

      }, (err) => {
          if (err) return cb(err)
					ingredientList = ingredientList.map((ingredient)=>{ return {
						name: ingredient.name,
						providerArticles: ingredient.providerArticles
					}})
          cb(null, docs)
      })

    },(docs,cb)=> { //Break out ingredient list based on provider articles

    	ingredientList.forEach((ingredient) => {

    		if(ingredient.providerArticles.length){

    			ingredient.providerArticles.forEach((providerArticle) => {

    				let ingObj = {
	    				name: ingredient.name,
	    				provider: providerArticle.provider.commercialName,
	    				reference: providerArticle.reference,
      				externalReference: providerArticle.externalReference
	    			}
    				ingredientListToExport.push(ingObj)

    			})

    		}
    		else
    		{
    			let ingObj = {
    				name: ingredient.name,
    				provider: '-- No articles found --',
    				reference: '-- No articles found --',
    				externalReference: '-- No articles found --'
    			}
    			ingredientListToExport.push(ingObj)
    		}
    	})

    	cb(null, docs)

    },(docs,cb)=> {

    	var fields = ['name', 'provider', 'reference', 'externalReference'];
    	var fieldNames = ['Nombre ingrediente', 'Proveedor', 'Referencia', 'Referencia externa'];

			json2csv({ data: ingredientListToExport, fields: fields, fieldNames: fieldNames }, (err, csv) => {
			  
			  if (err) return cb(err);
			  
			  fs.writeFile('/tmp/reportGastroIngredients.csv', csv, (err) => {
				  if (err) return cb(err);
				  cb(null, docs)
				});			  
			});

		 }, (docs, cb) => { //Upload zipped file to S3

 		    var fs = require('fs-extra');
 		    var d = new Date();
				var n = d.toISOString();
 
		    fs.readFile('/tmp/reportGastroIngredients.csv', (err, buffer) => {
		    	if(err) return cb(err)
		      var s3obj = new AWS.S3({
		        params: {
		          Bucket: config.awsBucket.bucketName,
		          Key: 'report/reportGastroIngredients.csv',
		          ContentType: 'text/csv',
		          ACL: 'public-read',
		          Body: buffer
		        }
		      })

		      s3obj.upload().send((err,data) => {
		      	if(err) return cb(err)
		      	url = data.Location;
		      	cb(null, docs)
		      });
		    });		    

 		}], (err, docs) => {


        if (err) {

        	logger.error('Error exporting gastro offer ingredient data to csv.', err)
        	
        	let message = {
        		status: 'error',
        		type: 'report'
        	};

					request.post(
						{
							url: config.apiUrl + '/socketio/send', 
							json: true, 
							headers: {
							    'Authorization': config.workerToken
							},							
							body: {
								socket: socket, 
								message: message
							} 
						}, (err, res, body) => {

		 				  //io.emit(token, {status: 'error', type: 'article', params: params})
		        	return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
		        	//res.status(err.statusCode || 500).json(err.message).end();
					})
     	
        } else {

	        let message = {
	        	status: 'success',
        		type: 'report', 
	        	url: url
	        }

	        logger.info('worker token %s', config.workerToken)

					request.post(
						{	url: config.apiUrl + '/socketio/send', 
							headers: {
							    'Authorization': config.workerToken
							},
							json: true, 
							body: 
								{	
									socket: socket, 
									message: message
								} 
							}, (err, res, body) => {
				 			
					 			logger.info("Export completed successfully. File saved in ", url)
							  //io.emit(token, {status: 'success', url: url, type: 'article', params: params})
							  done()
						})

				}

 		})
})

var removeDuplicates = (arr) => {
  //console.log(arr,'arr')
  // console.log(arr.length,'arr2')
  var i,j,cur,found;
  for(i=arr.length-1;i>=0;i--){
    cur = new ObjectId(arr[i]._id);
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= new ObjectId(arr[j]._id);
      if(cur.equals(id)){
        if(i!=j){
          arr.splice(i,1);
        }
        found=true;
      }
    }
  }
  return arr;
}