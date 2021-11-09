var kue = require('kue');
var config = require('../config/config');
var {ObjectId} = require('mongodb');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.report;

const queue = kue.createQueue({redis: config.redisUrl});

function reportGastroIngredients(data, done) {  
  queue.create('reportGastroIngredients', data)
    .priority('normal')
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
  reportGastroIngredients: (data, done) => {
    reportGastroIngredients(data, done);
  }
};