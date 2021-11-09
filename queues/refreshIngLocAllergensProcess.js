var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var { ObjectId } = require('mongodb');
var costHelper = require('../helpers/cost');
var allergenHelper = require('../helpers/allergen')

const queue = kue.createQueue({ redis: config.redisUrl });

queue.watchStuckJobs(6000);

queue.process('refreshIngLocAllergens', function(job, done) {

    var totalNumIngs;
    var ingCount = 0;
    var updatedIngs = 0;
    var async = require('async');
    var Ingredient = require('../models/ingredient')
    var Allergen = require('../models/allergen')
    var Location = require('../models/location')
    var cookDesignAllergens;
    var cookDesignLocations;
    var loggerHelper = require('../helpers/logger');
    const logger = loggerHelper.refreshIngLocAllergens;


    logger.info('refreshIngLocAllergens - Entering method...')

    async.waterfall([

        (cb) => {

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

            Ingredient.count({}, (err, count) => {
                if (err) return cb(err)
                totalNumIngs = count;
                logger.info('refreshIngLocAllergens - There are %s of ingredients to refresh', count)
                cb(null, true)
            })

        }, (doc, cb) => {

            logger.info('refreshIngLocAllergens - Starting location update...')

            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, ingCount < totalNumIngs);
                },
                (callback) => {

                    Ingredient
                        .findOne({})
                        .skip(ingCount)
                        .limit(1)
                        .exec((err, ingredient) => {

                            if (err) callback(err)

                            ingCount++;

                            logger.info('refreshIngLocAllergens - //////////======>>>>>> Checking ingredient # %s', ingCount - 1)

                            allergenHelper.singleIngLocAllergens(cookDesignAllergens, cookDesignLocations, ingredient._id, (err, updated) => {
                                if (err) {
                                    logger.error(err)
                                }

                                if (updated) updatedIngs++;

                                process.nextTick(() => callback());
                            })
                        })

                }, (err) => { // Finished looping through all ingredients
                    if (err) return cb(err)
                    console.log('refreshIngLocAllergens - Finished looping through all ingredients')
                    logger.info('refreshIngLocAllergens - Finished looping through all ingredients')
                    if (updatedIngs) logger.error('refreshIngLocAllergens - There were %s ingredients with incorrect allergens', updatedIngs)
                    else logger.info('refreshIngLocAllergens - All ingredient location allergens are correct!!!')
                    cb(null, true)
                })

        }
    ], (err, docs) => {
        if (err) return done(err)
        done();
    })
})


