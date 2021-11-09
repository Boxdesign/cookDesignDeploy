var kue = require('kue');
var config = require('../config/config');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.report;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('reportGastroIngredientsByLocation', function(job, done){

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
  var json2csv = require('json2csv');
  var fs = require('fs');
  var filterLocations = [];
  var productList = [];
  var ingredientList = [];
  var resultList = [];
  var kindPipeline;
  var ingredientAndArticlesByLocations = [];
  var filterLocation;
  var filterId;
  var filterTypePipeline;
  var filterLocationPipeline;
  var gastroOffers
 	var request = require('request');
  let socket = userProfile.socket;


		AWS.config.accessKeyId = config.awsBucket.accessKey;
		AWS.config.secretAccessKey = config.awsBucket.secret;
		AWS.config.region = config.awsBucket.region;

		logger.info('Entering gastro export job.')			

		if(params._gastroType == ''){
			
		} else {
			if(params._qty == 'some'){
				if (params.filterId) {
						filterId = JSON.parse(params.filterId).map(function(doc) { return new ObjectId(doc); });
				} else {
						filterId = [];
				}
			}
		}    	

		if (params.filterLocations) {
				filterLocation = JSON.parse(params.filterLocations).map(function(doc) { return new ObjectId(doc); });
		} else {
				filterLocation = [];
		}

		//If an array of filter locations if provided, build the filter location pipeline
		filterLocationPipeline = {};
		if (filterLocation.length > 0) {
				filterLocationPipeline = {$in: filterLocation}
		}

    logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- Entering method')
		logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- FilterLocations: %j', filterLocation)

 		async.waterfall([
    	
    	(cb)=>{
    			if(params._qty=='some'){ //The ids of the gastro offers is provided. 

    				async.eachSeries(filterId, (gastroOfferId,cb_async)=>{
		    			//console.log(gastroOfferId,'gastroOfferId')
		    			report.getGastroIngredients(gastroOfferId, userProfile,(err,doc)=>{
		          	if(err) return cb(err);
		          	if(doc.length)	ingredientList = ingredientList.concat(doc);
		            cb_async();
		          });

		    		},(err)=>{
				      logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- Obtain of reportHelper.getGastroIngredients array of ingredients Ids in gastroOffer. Total length: %s',ingredientList.length)
		    			if(err) return cb(err)
		      		cb(null,true)
		    		})

    			} else {
						//If gastro offer type is provided...
    				if(params._gastroType == 'carte' || params._gastroType == 'menu' || params._gastroType == 'dailyMenuCarte' || params._gastroType == 'catalog' 
    				|| params._gastroType == 'fixedPriceCarte' || params._gastroType == 'buffet'){

    					//console.log('Find in collection GastroOffer to obtain all gastroOffers Ids')
							GastroOffer.aggregate([
								{$match: {'location': {$in: filterLocation}}},
								{$match: {'type': params._gastroType}},
				    		{$unwind:
				    			{path: "$versions"}
				    		},
				    		{$match: {'versions.active': true}}
			    		], (err, doc) => {
							 	if(err) return cb(err)
							 		logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- Find in collection GastroOffer to obtain a type of gastroOffers Ids. Total length: %s',doc.length)
							 		gastroOffers = doc.filter((gastroOffer) => {
							 			return gastroOffer.versions.composition.length
							 		})
							 		cb(null,doc)
							 })

    				} else {
							//Search through all gastro offer types
							GastroOffer.aggregate([
								{$match: {'location': {$in: filterLocation}}},
				    		{$unwind:
				    			{path: "$versions"}
				    		},
				    		{$match: {'versions.active': true}}
			    		], (err, doc) => {
							 	  if(err) return cb(err)
							 		logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- Find in collection GastroOffer to obtain all gastroOffers Ids. Total length: %s',doc.length)
							 		gastroOffers = doc.filter((gastroOffer) => {
							 			return gastroOffer.versions.composition.length
							 		})
							 		cb(null,doc)
							 })
    				}
    			}    		

		  },(doc,cb)=>{

		  	if(gastroOffers && gastroOffers.length > 0){

		  		async.eachSeries(gastroOffers, (gastroOffer,cb_async)=>{
		  			report.getGastroIngredients(gastroOffer._id, userProfile,(err,doc)=>{
	          	if(err) return cb(err);
	          	if(doc.length)	ingredientList = ingredientList.concat(doc);
	            cb_async();
	          });

		  		},(err)=>{
		  			logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- Obtain of reportHelper.getGastroIngredients array of ingredients Ids in ALL gastroOffers before removed duplicate ingredients. Total length: %s',ingredientList.length)
	    			if(err) return cb(err)
	      		cb(null,doc)
		  		})
		  	} else {
		  		cb(null,doc)
		  	}

      
      },(doc,cb) => {	//Pasos para obtener informacion necesaria para agrupar informacion a exportar
					
					ingredientList = removeDuplicates(ingredientList);

      		async.eachOfSeries(ingredientList, (ingredient,index,cb_async) =>{

      				//logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- find articles in BBDD that category.item: %s  is in ingredientsList', ingredient._id)
      				
      				let ingObject = {
		    				ingName: ingredient.lang[0].name,
		    				referenceCost: ingredient.referencePrice? ingredient.referencePrice.toFixed(2) : '',
								articleDescription: '',
								provider: '',
								providerPrice: ''
		    			}
		    			resultList.push(ingObject);

							//Find articles that reference ingredient and are included in list of locations
      				Article.find({ 
      					"category.item": ingredient._id ,
      					"location" : { $in :filterLocation}
      				})
      				.populate("provider last_account document packFormat location")
      				.exec((err,docs) => {
      					if(err) return cb(err)
      						//console.log(docs,'docs')
      					if(docs.length) {
										docs.forEach((article) => {
											let articleObject = {
												ingName: ingredient.lang[0].name,
												referenceCost: ingredient.referencePrice? ingredient.referencePrice.toFixed(2) : '',
												articleDescription: article.lang[0].description,
												reference: article.reference,
												externalReference: article.externalReference,
												provider: article.provider.commercialName,
												providerPrice: article.netPrice? article.netPrice.toFixed(2) : ''
											}
											resultList.splice(index,1,articleObject);
										})										 
								} 
								else 
								{
									let ingObject = {
										ingName: ingredient.lang[0].name,
										referenceCost: ingredient.referencePrice? ingredient.referencePrice.toFixed(2) : '',
										articleDescription: ' -- No articles found --',
										reference: ' -- No articles found --',
										externalReference: ' -- No articles found --',
										provider: '-- No providers found --',
										providerPrice: '-- No provider price exist --'
									}
									resultList.splice(index,1,ingObject);																		}     					
      						cb_async();
     					});

      		},(err)=>{
      			//console.log(articlesList.length,'articlesList')
      			if(err) return cb(err)
      			cb(null,doc)
      		})

    	},(doc,cb)=>{

    		var fields = ['ingName','referenceCost', 'articleDescription', 'reference', 'externalReference', 'provider','providerPrice','location'];
    		var fieldNames = ['Ingrediente', 'Coste de referencia', 'Artículo(s)', 'Referencia proveedor', 'Código externo', 'Proveedor(es)','Precio neto','Localización'];

				json2csv({ data: resultList, fields: fields, fieldNames: fieldNames }, (err, csv) => {
				  if (err) return cb(err);
				  
				  fs.writeFile('/tmp/reportIngredientsAndArticlesByLocations.csv', csv, (err) => {
					  if (err) return cb(err);
					  logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- csv file created')
					  cb(null, doc)
					});			  
				});

		 }, (doc, cb) => { //Upload zipped file to S3

 		    var fs = require('fs-extra');
 		    var d = new Date();
				var n = d.toISOString();
 
		    fs.readFile('/tmp/reportIngredientsAndArticlesByLocations.csv', (err, buffer) => {
		    	if(err) return cb(err)
		      var s3obj = new AWS.S3({
		        params: {
		          Bucket: config.awsBucket.bucketName,
		          Key: 'report/reportIngredientsAndArticlesByLocations.csv',
		          ContentType: 'text/csv',
		          ACL: 'public-read',
		          Body: buffer
		        }
		      })

		      s3obj.upload().send((err,data) => {
		      	if(err) return cb(err)
		      	url = data.Location;
		      	cb(null, doc)
		      });
		    });		    

 		}], (err, doc) => {


        if (err) {
        	logger.error('Error exporting gastro offer ingredient data to csv.', err)
        	let message = {
        		status: 'error',
        		type: 'report',
        		params: params
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
	        	params: params,
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