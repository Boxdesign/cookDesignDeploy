var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var gastroCostHelper = require('../helpers/gastroCost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueGastroCompCost;

const queue = kue.createQueue({redis: config.redisUrl});

function updateGastroCompCost(data, done) {  
  queue.create('updateGastroCompCost', data)
    .priority('normal')
    .attempts(1)
    .backoff({delay: 180*1000, type:'fixed'})
    .ttl(3600*1000)
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
  updateGastroCompCost: (data, done) => {
    updateGastroCompCost(data, done);
  }
};