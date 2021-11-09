var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.articleLocCostUpdate;

const queue = kue.createQueue({redis: config.redisUrl});

queue.on('ready', () => {  
  // If you need to 
  logger.info('ArticleLocCostUpdate queue - queue is ready.')
});

queue.on('error', (err) => {  
  // handle connection errors here
  logger.info('ArticleLocCostUpdate queue - There was an error in the queue.')
  logger.info(err)
});

function articleLocCostUpdate(data, done) {  
  queue.create('articleLocCostUpdate', data)
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
  articleLocCostUpdate: (data, done) => {
    articleLocCostUpdate(data, done);
  }
};