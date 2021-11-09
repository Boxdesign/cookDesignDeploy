var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.removeImage;

const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

queue.process('removeImage', (job, done) => {  

	var S3 = require('aws-sdk/clients/s3');
	var Gallery = require('../models/gallery');
	var id = job.data.id;
	var gallery;

	// Set credentials and region
	var s3 = new S3({
    region: config.awsBucket.region, 
    credentials: {
    	accessKeyId: config.awsBucket.accessKey,
		  secretAccessKey: config.awsBucket.secret
    }
  });

	async.waterfall([

		(cb) => {

			Gallery.findOne({_id: id}, (err, doc) => {
				if(err) { 
					logger.error(err)
					return cb(err)
				}
				if(!doc) {
					logger.error('removeImage - Could not find gallery: %j', id)
					let err = new Error('Could not find gallery!')
					return cb(err)
				}
				logger.info('Obtained gallery doc to be deleted: %j', doc)
				gallery = doc;
				cb(null, doc)
			})

		}, (doc,cb) => {

			logger.info('Starting process to delete images from gallery doc on AWS S3')

			async.eachSeries(gallery.sizes, (image, cb_async) => {

				let split = image.url.split("/")
				split.splice(0,4)
				let key = '';

				split.forEach((x, i) => {
					if(i < split.length-1) key = key + x +'/';
					else key = key + x;					
				})

				logger.info('Image key %s', key)

				let params = {
				  Bucket: config.awsBucket.bucketName, 
				  Key: key
				 };
				 logger.info('About to delete %j', params)
				 
				 s3.deleteObject(params, function(err, data) {
				   if (err) {
 						logger.error(err)
				   	return cb_async(err)
				   }
				   logger.info('Successfully deleted image %j', data)
				   cb_async()    
				 });

			}, (err) => { //Finished images deletion loop
				if(err) return cb(err)
				cb(null, true)
			})

		}, (doc,cb) => {

				logger.info('Remove gallery doc from database')

				gallery.remove((err) => {
					if(err) { 
						logger.error(err)
						return cb(err)
					}
					logger.info('Successfully removed gallery doc')
					cb(null, true)
				})

    }], (err, docs) => {
      	if(err) return done(err)
      	done();
    })

})