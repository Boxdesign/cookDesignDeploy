var kue = require('kue');
var config = require('../config/config');
var moment = require('moment')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.dataExport;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('exportArticle', function(job, done){

	var async = require('async');
  var config = require('./../config/config');
  var articleExportHelper = require('../helpers/exportArticle') 
  var AWS = require('aws-sdk');
  let params = job.data.params;
  let userProfile = job.data.userProfile;
  let socket = userProfile.socket;
  var url;
 	var request = require('request');

 	AWS.config.accessKeyId = config.awsBucket.accessKey;
 	AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

 	logger.info('Entering article export job.')			
 	async.waterfall([

 		(cb) => {

 				articleExportHelper.export(params, userProfile, (err, docs) => {
 				if(err) return cb(err)
 				logger.info('Article export completed successfully.')
 				cb(null, docs)
 			}) 		

	 	}, (docs, cb) => { //Create zipped file

				var fs = require('fs');

				// The zip library needs to be instantiated:
				var zip = new require('node-zip')();

				// You can add multiple files by performing subsequent calls to zip.file();
				// the first argument is how you want the file to be named inside your zip,
				// the second is the actual data:
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
		          Key: 'exports/articleExport-'+moment().format('YYYYMMDDHHmm')+'.zip',
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

        	logger.error('Error exporting article offer data to csv.', err)
        	
        	let message = {
        		status: 'error', 
        		type: 'article', 
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