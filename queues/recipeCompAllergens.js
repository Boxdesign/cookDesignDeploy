var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var { ObjectId } = require('mongodb');
var costHelper = require('../helpers/cost');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.queueRecipeCompAllergens;

const queue = kue.createQueue({ redis: config.redisUrl });

function updateRecipeCompAllergens(data, done) {
    queue.create('updateRecipeCompAllergens', data)
        .priority('normal')
        .attempts(1)
        .backoff({ delay: 180 * 1000, type: 'fixed' })
        .ttl(1200 * 1000)
        .removeOnComplete(false)
        .save((err) => {
            if (err) {
                if (done) return done(err);
            }
            if (!err) {
                if (done) done();
            }
        });
}

module.exports = {
    updateRecipeCompAllergens: (data, done) => {
        updateRecipeCompAllergens(data, done);
    }
};