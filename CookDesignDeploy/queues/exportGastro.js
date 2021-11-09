var kue = require('kue');
var config = require('../config/config');
var moment = require('moment')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.dataExport;

const queue = kue.createQueue({redis: config.redisUrl});

function exportGastro(data, done) {  
  queue.create('exportGastro', data)
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
  exportGastro: (data, done) => {
    exportGastro(data, done);
  }
};


