var kue = require('kue');
var config = require('../config/config');
var moment = require('moment')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.dataExport;
const queue = kue.createQueue({redis: config.redisUrl});

queue.watchStuckJobs(6000);

function exportRecipe(data, done) {  
  queue.create('exportRecipe', data)
    .priority('high')
    .attempts(1)
    .backoff({delay: 180*1000, type:'fixed'})
    .ttl(3*600*1000)
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
  exportRecipe: (data, done) => {
    exportRecipe(data, done);
  }
};
