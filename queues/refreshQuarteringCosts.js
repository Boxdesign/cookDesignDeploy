var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var {ObjectId} = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var winston = require('winston')

const queue = kue.createQueue({redis: config.redisUrl});

function refreshQuarteringCosts(data, done) {  
  queue.create('refreshQuarteringCosts', data)
    .priority('normal')
    .attempts(1)
    .backoff({delay: 180*1000, type:'fixed'})
    .ttl(7200*1000)
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
  refreshQuarteringCosts: (data, done) => {
    refreshQuarteringCosts(data, done);
  }
};