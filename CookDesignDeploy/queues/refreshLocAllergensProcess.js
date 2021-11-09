var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var { ObjectId } = require('mongodb');
var allergenHelper = require('../helpers/allergen')
var Location = require('../models/location')
var Allergen = require('../models/allergen')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.refreshLocAllergens;

const queue = kue.createQueue({ redis: config.redisUrl });

queue.watchStuckJobs(6000);

//Used in article post-save hook to recalculate ingredient's location allergens

queue.process('refreshLocAllergens', function(data, done) {

    var ingId = data.data.ingId;
    logger.info('refreshLocAllergens - Entering method...')

    async.waterfall([

        (cb) => {

            Location.find({})
                .exec((err, docs) => {
                    if (err) return cb(err)

                    if (!docs || !docs.length) {
                        let err = new Error('Could not find locations!')
                        return cb(err)
                    }
                    cookDesignLocations = docs.map((x) => { return x._id })
                    logger.info('refreshIngLocAllergens - Retrieved %s locations!', cookDesignLocations.length);
                    cb(null)
                })

        }, (cb) => {


            Allergen.find({})
                .exec((err, docs) => {
                    if (err) {
                        logger.error(err)
                        return cb(err)
                    }
                    cookDesignAllergens = docs;
                    logger.info('refreshIngLocAllergens - Retrieved %s cookDesign allergens', cookDesignAllergens.length)
                    cb(null)
                })

        }, (cb) => {
            allergenHelper.singleIngLocAllergens(cookDesignAllergens, cookDesignLocations, ingId, (err, updated) => {
                if (err) {
                    logger.error(err)
                }
                process.nextTick(() => cb());
            })

        }
    ], (err, docs) => {
        if (err) return done(err)
        done();
    })
})