var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.subproductsInLocation;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('subproductsInLocation', function(job, done){

	var async = require('async');
	var params = job.data.params;
  var model = job.data.model;
  var userLocIds = job.data.userLocIds;
  let userProfile = job.data.userProfile;
  let token = job.data.token;
  var menuType = params._menuType;
  var tax = params._tax;
  var type = params._type;
  var templateId = new ObjectId (params._templateId);
  var gastroOfferId = new ObjectId(params._gastroOfferId);
  var printBook = require('../helpers/printBooks');
 	var filterLocation;
  var showSubproducts = params._show;
  var Subproduct = require('../models/subproduct')
  var Model;
  var AWS = require('aws-sdk');
 	AWS.config.accessKeyId = config.awsBucket.accessKey;
 	AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;
  var url;
	var request = require('request');
	var moment = require('moment')
  let socket = userProfile.socket;
	
  logger.info('Entering subproducts in location queue...')

  switch(model){
  	case 'subproduct':
  		Model = Subproduct;
  		break;
  	default:
  		Model = Subproduct;
  		break;
  }

  async.waterfall([
      
    (cb) => {

        if (params.filterLocations) {
            filterLocation = JSON.parse(params.filterLocations).map(function(doc) { return new ObjectId(doc); });
        } else {
            filterLocation = [];
        }           

        printBook.subproductsInLocation(Model, userLocIds, userProfile, templateId, tax, filterLocation, (err, stream) => {
            if(err) return cb(err); 
            cb(null, stream)
        })

	 	}, (stream, cb) => { //Upload zipped file to S3

 		    var fs = require('fs-extra');
 		    var d = new Date();
				var n = d.toISOString();
 
	      var s3obj = new AWS.S3({
	        params: {
	          Bucket: config.awsBucket.bucketName,
	          Key: 'reports/subpsInLocation-'+moment().format('YYYYMMDDHHmm')+'.pdf',
	          ContentType: 'application/pdf',
	          ACL: 'public-read',
	          Body: stream
	        }
	      })

	      s3obj.upload().send((err,data) => {
	      	if(err) return cb(err)
	      	url = data.Location;
	      	cb(null, true)
	      });

 		}], (err, doc) => {

        if (err) {

        	logger.error('Error creating subproducts in location pdf.', err)
        	
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
	        	type: 'printBook',
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
				 			
					 			logger.info("Report of subproducts in location completed successfully. File saved in ", url)
							  //io.emit(token, {status: 'success', url: url, type: 'article', params: params})
							  done()
						})
				}

    })

})