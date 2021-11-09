var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueUpdateMeasUnit;

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

function updateMeasUnit(data, done) {  
  queue.create('measUnit', data)
    .priority('normal')
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
  create: (data, done) => {
    updateMeasUnit(data, done);
  }
};