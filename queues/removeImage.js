var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var winston =  require('winston');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.removeImage;
const queue = kue.createQueue({redis: config.redisUrl});

queue.on('ready', () => {  
  // If you need to 
  console.log('Queue is ready!');
});

queue.on('error', (err) => {  
  // handle connection errors here
  logger.info('Provider queue - There was an error in the queue.')
  logger.info(err);
});

function removeImage(data, done) {  
  queue.create('removeImage', data)
    .priority('low')
    .attempts(1)
    .backoff({delay: 180*1000, type:'fixed'})
    .ttl(600*1000)
    .removeOnComplete(false)
    .save((err) => {
      if (err) {
        if(done) return done(err);
      }
      if (!err) {
        if(done) done();
      }
    });
}

module.exports = {  
  removeImage: (data, done) => {
    removeImage(data, done);
  }
};