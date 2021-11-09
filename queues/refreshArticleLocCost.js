var kue = require('kue');
var config = require('../config/config');

const queue = kue.createQueue({redis: config.redisUrl});

function refreshArticleLocCost(data, done) {  
  queue.create('refreshArticleLocCost', data)
    .priority('normal')
    .attempts(1)
    .backoff({delay: 180*1000, type:'fixed'})
    .ttl(1200*1000)
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
  refreshArticleLocCost: (data, done) => {
    refreshArticleLocCost(data, done);
  }
};