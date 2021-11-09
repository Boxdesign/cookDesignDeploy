var kue = require('kue');
var config = require('../config/config');
var moment = require('moment')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.dataExport;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('exportRecipe', function(job, done){

	var async = require('async');
	var recipeExportHelper = require('../helpers/exportRecipe')
  var articleExportHelper = require('../helpers/exportArticle')
  var config = require('./../config/config');
  var AWS = require('aws-sdk');
  let params = job.data.params;
  let userProfile = job.data.userProfile;
  let socket = userProfile.socket;
  var url;
 	var request = require('request');

 	var recipesList;
 	var subproductsList;
 	var ingredientsList;
 	var packagingsList;
 	var articlesList = {
 		ingredientsList: [],
 		packagingsList: []
 	};
   	

 	AWS.config.accessKeyId = config.awsBucket.accessKey;
 	AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

 	logger.info('Entering recipe export job.')			
 	async.waterfall([

 		(cb) => {

 			recipeExportHelper.export(params, userProfile, (err, docs) => {
 				if(err) return cb(err)
				recipesList=docs;
 				cb(null, recipesList)
 			}) 			

 		}, (recipesList, cb) => { //Compile list of subproducts within recipes

	 			recipeExportHelper.extractSubproducts(recipesList, (err, docs) => {
	 				if(err) return cb(err)	
	 				subproductsList = docs; 					
		 			cb(null, subproductsList)
	 			})

 		}, (subproductsList, cb) => { //Generate csv file from subproducts list

	 			recipeExportHelper.exportSubproductsFromList(subproductsList, userProfile, params, (err, ok) => {
	 				if(err) return cb(err)
		 			cb(null, ok)
	 			})

 		}, (doc, cb) => { //Extract list of ingredients within recipes

 				articleExportHelper.extractIngredients(recipesList, (err, docs) => {
	 				if(err) return cb(err)
	 				ingredientsList = docs; 
	 				articlesList.ingredientsList=articlesList.ingredientsList.concat(ingredientsList);
		 			cb(null, ingredientsList)
 				})

 		}, (doc, cb) => { //Extract list of packagings within recipes of type product (the other do not have packagings)

 				articleExportHelper.extractPackagings(recipesList, (err, docs) => {
	 				if(err) return cb(err)
	 				packagingsList = docs; 
	 				articlesList.packagingsList = packagingsList;
		 			cb(null, articlesList)
 				})

 		}, (docs, cb) => { //Generate csv file from articles list

	 			articleExportHelper.exportArticlesFromList(articlesList, userProfile, params, (err, ok) => {
	 				if(err) return cb(err)
  				logger.info('Recipe export completed successfully.')
		 			cb(null, ok)
	 			})

	 	}, (docs, cb) => { //Create zipped file

				var fs = require('fs');

				// The zip library needs to be instantiated:
				var zip = new require('node-zip')();

				// You can add multiple files by performing subsequent calls to zip.file();
				// the first argument is how you want the file to be named inside your zip,
				// the second is the actual data:
				zip.file('recipe_export.csv', fs.readFileSync('/tmp/recipe_export.csv'));
				zip.file('subproduct_export.csv', fs.readFileSync('/tmp/subproduct_export.csv'));
				zip.file('article_export.csv', fs.readFileSync('/tmp/article_export.csv'));

				var data = zip.generate({ base64:false, compression: 'DEFLATE' });

				// it's important to use *binary* encode
				fs.writeFileSync('/tmp/export.zip', data, 'binary');

				cb(null, docs)

	 	}, (docs, cb) => { //Upload zipped file to S3

 		    var fs = require('fs-extra');
 		    var d = new Date();
				var n = d.toISOString();
 
		    fs.readFile('/tmp/export.zip', (err, buffer) => {
		    	if(err) return cb(err)
		      var s3obj = new AWS.S3({
		        params: {
		          Bucket: config.awsBucket.bucketName,
		          Key: 'exports/recipeExport-'+moment().format('YYYYMMDDHHmm')+'.zip',
		          ContentType: 'application/zip',
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

 		}], (err, doc) => {


        if (err) {

        	logger.error('Error exporting recipe data to csv.', err)
        	
        	let message = {
        		status: 'error', 
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
	        	url: url,  
	        	type: 'export',
	        	params: params
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