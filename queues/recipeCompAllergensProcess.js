var kue = require('kue');
var config = require('../config/config');
var waterfall = require('async-waterfall');
var async = require('async');
var { ObjectId } = require('mongodb');
var allergenHelper = require('../helpers/allergen');
var locHelper = require('../helpers/locations')

const queue = kue.createQueue({ redis: config.redisUrl });

queue.process('updateRecipeCompAllergens', function(job, done) {

    //Method inputs
    var locationLoop = job.data.locationLoop;
    var id = new ObjectId(job.data.id); //id of ingredient or subproduct which cost has changed

    var Subproduct = require('../models/subproduct');
    var Dish = require('../models/dish');
    var Product = require('../models/product');
    var Drink = require('../models/drinks');

    var conversionTable = [];
    var Models = [Subproduct, Dish, Drink, Product];
    var waterfall = require('async-waterfall');
    var async = require('async');
    var filterPipeline;
    var loggerHelper = require('../helpers/logger');
    const logger = loggerHelper.queueRecipeCompAllergens;

    logger.info('UpdateRecipeCompAllergens - Entering queue...');
    logger.info('UpdateRecipeCompAllergens - id of ingredient or subproduct which allergen has changed is %s', id);
    logger.info('UpdateRecipeCompAllergens - Location loop is %j', locationLoop);
  
    //if locationLoop contains a change in reference price (location is null), then all recipes containing this ingredient or subproduct must be updated
    //if locationLoop does not contain a change in reference price, then must find those recipes that contain the ingredient and subproduct and include at least one of the locations which cost has been updated.

    let referenceAllergensUpdate = locationLoop.find((loc) => { return loc.location == null })

    if (referenceAllergensUpdate) {
        logger.info('UpdateRecipeCompAllergens - reference allergens have changed. Find all recipes that include ingredient or subproduct regardless of location.')
        filterPipeline = {
            "versions.composition.element.item": id
        }
    } else {
        logger.info('UpdateRecipeCompAllergens - reference allergens have not changed. Find all recipes that include ingredient or subproduct and include at least one of the updated locations.')
        let locs = locationLoop.map((x) => { return x.location; }) //Map location loop back to array of location ids
        filterPipeline = {
            "versions.composition.element.item": id,
            "location": { $in: locs }
        }
    }

    async.eachSeries(Models, (Model, cb_async_model) => {

        if (Model == Dish) logger.info('UpdateRecipeCompAllergens - Updating dishes composition allergens')
        if (Model == Drink) logger.info('UpdateRecipeCompAllergens - Updating drinks composition allergens')
        if (Model == Product) logger.info('UpdateRecipeCompAllergens - Updating products composition allergens')
        if (Model == Subproduct) logger.info('UpdateRecipeCompAllergens - Updating subproducts composition allergens')

        //Find recipes which include subproduct or ingredient. We are only interested in those recipes which have at least one of the 
        //locations updated (add, edit or delete)
        Model.find(
            filterPipeline
        ).exec((err, recipes) => {

            if (err) return cb_async_model(err)

            if (Model == Dish) logger.info('UpdateRecipeCompAllergens - Found %s dishes with comp element', recipes.length)
            if (Model == Drink) logger.info('UpdateRecipeCompAllergens - Found %s drinks with comp element', recipes.length)
            if (Model == Product) logger.info('UpdateRecipeCompAllergens - Found %s products with comp element', recipes.length)
            if (Model == Subproduct) logger.info('UpdateRecipeCompAllergens - Found %s subproducts with comp element', recipes.length)

            //Go over recipes. If docs is empty it won't go in.
            async.eachSeries(recipes, (recipe, cb_async_recipe) => {

                logger.info('UpdateRecipeCompAllergens - Evaluating recipe with id %s: ', recipe._id)
                logger.info('UpdateRecipeCompAllergens - Recipe location is %j', recipe.location)

                //Get active version of recipe
                let activeVersion = recipe.versions.find((x) => { return x.active })

                if (activeVersion) {

                    logger.info('UpdateRecipeCompAllergens - retrieved active version of recipe with version id %s', activeVersion._id)

                    async.waterfall([

                        (cb) => {

                            //If the cost update was for a reference cost, recalculate the price of the recipe version for all the composition locations
                            allergenHelper.calculateRecipeLocationAllergens(activeVersion, recipe.location, (err, res) => {
                                if (err) return cb(err)

                                activeVersion.locationAllergens = res.locationAllergens;
                                activeVersion.allergens = res.referenceAllergens;
                                logger.info('UpdateRecipeCompAllergens - Recalculated allergens: %j', res);
                                logger.info('UpdateRecipeCompAllergens - Updated activeVersion: %j', activeVersion);

                                cb(null)
                            })

                        }, (cb) => { //Save recipe

                            recipe.save((err) => {
                                if (err) {
                                    logger.error('Error saving recipe %j', recipe)
                                    logger.error(err)
                                    return cb(err)
                                }
                                logger.info('UpdateRecipeCompAllergens - Recipe updated successfully');
                                cb(null)
                            })

                        }
                    ], (err, docs) => { //Finished cb waterfall
                        if (err) {
                            logger.error(err)
                            return cb_async_recipe(err)
                        }
                        cb_async_recipe()
                    })
                } else {
                    logger.error("Could not find active version for recipe %s", recipe._id)
                    cb_async_recipe()
                }

            }, (err) => { //End of recipes loop
                if (err) return cb_async_model(err)
                cb_async_model()
            })

        }) //Model find

    }, (err) => { //End of model loop
        if (err) return done(err) //IMPORTANT: putting done(err) instead of return done(err) leaves the job inactive in case of error
        logger.info('UpdateRecipeCompAllergens - Finished queue job successfully')
        done();
    })

})