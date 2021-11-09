var Allergen = require('../models/allergen');
var { ObjectId } = require('mongodb');
var async = require('async');
var waterfall = require('async-waterfall');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.allergens;


/* ------------------------- UPDATE ALLERGENS ---------------------------- */

exports.updateAllergen = (_id, updatedAllergens, callback) => {
    var id = new ObjectId(_id); //id of ingredient or subproduct which allergens have changed
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var Product = require('../models/product');
    var Subproduct = require('../models/subproduct');
    var Models = [Dish, Drink, Product, Subproduct];

    waterfall([
        (cb) => { //Check whether there are recipes that include this ingredient or subproduct. If so, re-compute subproduct's allergens.

            async.eachSeries(Models, function(Model, cb_async) {

                Model.aggregate([
                    { "$unwind": "$versions" },
                    { "$match": { "versions.active": true } },
                    { "$match": { "versions.composition.element.item": id } },
                    {
                        "$group": {
                            "_id": "$_id",
                            "versions": { "$push": "$versions" }
                        }
                    }
                ], (err, docs) => {
                    if (err) return cb(err)

                    if (docs.length > 0) { //matches. Re-calculate
                        exports.computeAllergens(docs, id, updatedAllergens, Model, (err, doc) => {
                            if (err) return cb_async(err)
                            cb_async()
                        })
                    } else //no matches
                    {
                        cb_async();
                    }
                })
            }, function(err) { // end of async loop
                if (err) return cb(err)
                cb(null, true)
            })

        }
    ], (err, ok) => { // end of waterfall
        if (err) return callback(err)
        callback();
    })
}


/* ------------------------- COMPUTE ALLERGENS ---------------------------- */

exports.computeAllergens = (docs, id, newAllergens, Model, callback) => {

    logger.info('computeAllergens <<<<----- Entering method')

    //Go over recipes.
    docs.forEach((doc) => {

        let activeVersion = doc.versions.find((version) => { return version.active })

        let updatedAllergens = [];

        activeVersion.composition.forEach((compositionElement) => {

            //Update allergens of compositionElement in composition list
            let compositionElementId = new ObjectId(compositionElement.element.item);
            if (compositionElementId.equals(id)) {
                compositionElement.allergens = newAllergens;
            }

            if (compositionElement.allergens && compositionElement.allergens.length > 0) { //check whether there are allergens in the element

                compositionElement.allergens.forEach((elementAllergenObj) => { //go over allergens of each element
                    //element.allergens object =
                    //{
                    //	allergen: ObjectId,
                    //  level: number
                    //}
                    let elementAllergObjectId = new ObjectId(elementAllergenObj.allergen);

                    if (updatedAllergens.length > 0) { //If the updated allergen list is empty, just add the allergen otherwise check whether it exist and its level
                        let match = false;
                        updatedAllergens.forEach((allergenObj) => {
                            let allergObjectId = new ObjectId(allergenObj.allergen);
                            if (elementAllergObjectId.equals(allergObjectId)) {
                                //console.log('match is true')
                                match = true;
                                if (elementAllergenObj.level > allergenObj.level) {
                                    //Level is higher therefore update level
                                    allergenObj.level = elementAllergenObj.level;
                                }
                            }
                        })
                        if (!match) { //allergen is not in the list of allergens, add it.	
                            let allObj = {
                                allergen: elementAllergenObj.allergen,
                                level: elementAllergenObj.level
                            }
                            updatedAllergens.push(allObj);
                        }
                    } else { //updatedAllergens is empty, just add the allergen
                        let allObj = {
                            allergen: elementAllergenObj.allergen,
                            level: elementAllergenObj.level
                        }
                        updatedAllergens.push(allObj)
                    }
                })
            }

        })
        activeVersion.allergens = updatedAllergens;
    })

    logger.info('computeAllergens ----->>>> Finished method')
    callback(null, docs);
}

exports.hasChanged = (currentAllergens, originalAllergens, cb) => {
    if (currentAllergens.length != originalAllergens.length) { //if length has changed, allergens have unequivocally changed
        hasChanged = true;
        cb(hasChanged);
    } else { //if length has not changed, make further checks
        let changes = currentAllergens.every((currentAllergen) => {
            return originalAllergens.some((originalAllergen) => {
                let originalAllergenId = new ObjectId(originalAllergen.allergen);
                let currentAllergenId = new ObjectId(currentAllergen.allergen);
                return (originalAllergenId.equals(currentAllergenId) && (originalAllergen.level == currentAllergen.level));
            })
        })
        let hasChanged = !changes;
        cb(hasChanged);
    }
}

exports.computeAllergensLocationLoop = (currentAllergenLoc, originalAllergenLoc, cb) => { //Used in ingredient and packaging model and subproduct
    //Input parameters are arrays of objects. Each object has a location and value.

    let deletedLocs=[];
    let editedLocs=[];
    let addedLocs=[];

    logger.info('computeAllergensLocationLoop - Computing ingredient location loop');
    logger.info('computeAllergensLocationLoop currentLocAllergens %j ', currentAllergenLoc)
    logger.info('computeAllergensLocationLoop - originalLocAllergens %j', originalAllergenLoc)

    //Find deleted locations
    originalAllergenLoc.forEach((orgAllergenLoc, index) => {
        let originalLocId = new ObjectId(orgAllergenLoc.location)
        let match = currentAllergenLoc.some((locAllergen) => {
            let locId = new ObjectId(locAllergen.location)
            return locId.equals(originalLocId) //must check that location
        })

        if (!match) { 
            let delLocObj = {
                location: orgAllergenLoc.location,
                allergens: orgAllergenLoc.allergens,
                status: 'delete'
            }            
            deletedLocs.push(delLocObj)
        }
    })

    //Find edited locations
    currentAllergenLoc.forEach((locAllergen, index) => {
        let locId = new ObjectId(locAllergen.location)
        let match = originalAllergenLoc.find((orgAllergenLoc) => {
            let originalLocId = new ObjectId(orgAllergenLoc.location)
            return locId.equals(originalLocId)
        })

        if (match) {
            exports.hasChanged(locAllergen.allergens, match.allergens, (hasChanged) => {
                if (hasChanged) {              
			            let editLocObj = {
			                location: locAllergen.location,
			                allergens: locAllergen.allergens,
			                status: 'edit'
			            }             
			            editedLocs.push(editLocObj)
                }
            })

        }
        else
        {
          let addLocObj = {
              location: locAllergen.location,
              allergens: locAllergen.allergens,
              status: 'add'
          }
          addedLocs.push(addLocObj)        	
        }
    })

    let result = deletedLocs.concat(editedLocs);
    result = result.concat(addedLocs);

    logger.info('computeAllergensLocationLoop - locationLoop %j', result)

    cb(result);
}

/* ------------------------- COMPARE SELENTA AND COOKESIGN ALLERGENS ---------------------------- */

exports.compareSelentaAndCDAllergens = (cookDesignArticle, selentaArticle, selentaAllergens, cb) => {

    // selentaAllergens = [
    // 	{
    //     "type": "ZCEREALES_GLUT",
    //     "code": "A",
    //     "allergenId": "57ceb03dd4e4cf8812924d51"
    //   },
    //   {}
    // ]

    //response => (err, updatedAllergens, hasChanged)

    logger.info('selentaArticle: %j', selentaArticle)

    let selentaArticleAllergens = selentaArticle.ALERGENOS || [];
    let cookDesignArticleAllergens = cookDesignArticle.allergens || [];

    logger.info('cookDesignArticleAllergens: %j', cookDesignArticleAllergens)
    logger.info('selentaArticleAllergens: %j', selentaArticleAllergens)

    //1. Transform selentaAllergens into cookdesign allergens

    var transformedSelentaAllergens = []
    var selentaAllergenKeys = [
        'ZCEREALES_GLUT',
        'ZCRUSTACEOS',
        'ZHUEVOS',
        'ZPESCADOS',
        'ZCACAHUETES',
        'ZSOJA',
        'ZLACTEOS',
        'ZFRUTOS_SEC',
        'ZAPIO',
        'ZMOSTAZA',
        'ZSESAMO',
        'ZSULFITOS',
        'ZALTRAMUCES',
        'ZMOLUSCOS',
        'Z0MG'
    ]

    if (selentaArticleAllergens.length) { //Transform Selenta allergen format to CookDesign format

        selentaArticleAllergens = selentaArticleAllergens[0];

        selentaAllergenKeys.forEach((allergenKey) => {

            let selentaLevel = selentaArticleAllergens[allergenKey];

            if (selentaLevel == "SI" || selentaLevel == "PUEDE") {
                let allergenMatch = selentaAllergens.find((selentaAllergen) => { return selentaAllergen.type == allergenKey })
                let level;
                if (selentaLevel == "SI") level = 2;
                else if (selentaLevel == "PUEDE") level = 1;
                let allergenObj = {
                    allergen: allergenMatch.allergenId,
                    level: level
                }
                transformedSelentaAllergens.push(allergenObj)
            }
        })
    }

    if (transformedSelentaAllergens.length) logger.info("Transformed allergens: %j", transformedSelentaAllergens)

    //2. Compare selenta and cookdesign article allergens
    exports.hasChanged(transformedSelentaAllergens, cookDesignArticleAllergens, (hasChanged) => {

        if (hasChanged) {
            logger.info('---->>> Allergens have changed!!')
            cb(null, transformedSelentaAllergens, true)
        } else {
            logger.info('Allergens have not changed')
            cb(null, transformedSelentaAllergens, false)
        }
    })

}

/* ------------------------- GET ALLERGENS ---------------------------- */

exports.getAllergens = (userProfile, cb) => {

    Allergen.find({}, {
            last_account: 1,
            updatedAt: 1,
            parentUnits: 1,
            base: 1,
            gallery: 1,
            lang: { $elemMatch: { langCode: userProfile.user.language } },
        })
        .populate('assigned_location last_account parentUnits.unit gallery')
        .exec((err, doc) => {
            if (err) return cb(err)
            cb(null, doc)
            //console.log(doc,'allergen')
        })
}


/* ------------------------- COMPARE LOCATION ALLERGENS ---------------------------- */

exports.compareLocationAllergens = (currentLocAllergens, originalLocAllergens, callback) => {

		// var logger = winston.loggers.get('compareLocationAllergens');
    var Allergen = require('../models/allergen')
    var Location = require('../models/location')
    var cookDesignLocations;

    waterfall([
        (cb) => {

            Location.find({})
                .exec((err, docs) => {
                    if (err) return cb(err)

                    if (!docs || !docs.length) {
                        let err = new Error('Could not find locations!')
                        return cb(err)
                    }
                    cookDesignLocations = docs.map((x) => { return x._id })
                    logger.info('compareLocationAllergens - Retrieved %s locations!', cookDesignLocations.length);
                    cb(null)
                })

        }, (cb) => {

        	if(currentLocAllergens.length == originalLocAllergens.length){
        		
        		if(currentLocAllergens.length) {
        				logger.info(' compareLocationAllergens - length of current and original allergens array is equal and not zero. Go to next step.')
        				cb(null)
        		}
        		else
        		{
        			logger.info('compareLocationAllergens - length of current and original allergens array is equal but zero. Jump to final step.')
        			return cb('equal')
        		}
        	}
        	else
        	{
        		logger.info('compareLocationAllergens - length or current and original allergens array is different. Jump to final step.')
        		return cb('notEqual')
        	}

        }, (cb) => {

            async.eachSeries(cookDesignLocations, (location, cb_async_loc) => {

                logger.info('compareLocationAllergens - Evaluating location %s', location);

                let locId = new ObjectId(location);

                //Find allergens for location
                let currentAllergenLoc = currentLocAllergens.find((allergenLoc) => {
                    let id = allergenLoc.location;
                    return id.equals(locId)
                })

                let originalAllergenLoc = originalLocAllergens.find((allergenLoc) => {
                    let id = allergenLoc.location;
                    return id.equals(locId)
                })

                logger.info('compareLocationAllergens - currentAllergenLoc %j', currentAllergenLoc);
                logger.info('compareLocationAllergens - originalAllergenLoc %j', originalAllergenLoc);

                //Check for equality
                if (currentAllergenLoc && originalAllergenLoc) {
                    //Check allergen and level are equal
                    logger.info('compareLocationAllergens - Both currentAllergenLoc and originalAllergenLoc found, compare them.');

                    exports.hasChanged(currentAllergenLoc.allergens, originalAllergenLoc.allergens, (hasChanged) => {
                        if (hasChanged) {
                            logger.info('compareLocationAllergens - Allergens have changed, break the loop.');
                            //Break location loop with error equal to true
                            return process.nextTick(() => cb_async_loc('notEqual'))
                        } else {
                            logger.info('compareLocationAllergens - Allergens have not changed, move on to next location.');
                            return process.nextTick(() => cb_async_loc())
                        }
                    })

                }

                if (!currentAllergenLoc && !originalAllergenLoc) { //None have allergens for this location, move on to the next location
                    logger.info('compareLocationAllergens - There are no allergens defined for this location for both current and original allergens, move on to next location.');
                    return process.nextTick(() => cb_async_loc())
                }

                if (currentAllergenLoc && !originalAllergenLoc || !currentAllergenLoc && originalAllergenLoc) { //Locations are different, therefore allergens are different
                    logger.info('compareLocationAllergens - Locations are different, therefore allergens are different. Break the loop.');

                    //Break location loop with error equal to true
                    return process.nextTick(() => cb_async_loc('notEqual'))
                }

            }, (err) => {
                //If err, it means either that there's been an actual error or that allergens are not equal (in case err == true)
                if (err) {
                	  if(err != 'equal' && err != 'notEqual') {
                    	logger.info('compareLocationAllergens - Error detected during location loop.');
                    	logger.info('compareLocationAllergens - Error: %j', err);
                    }
                    return cb(err)
                }
                //If no error, it means that allergens are equal
                cb(null)

            })

        }
    ], (err) => {
        if (err) {
            if (err == 'equal') {
                //Allergens are not equal
                callback(null, true)
            } else if (err == 'notEqual'){
            		callback(null, false)
            } else {
                callback(err)
            }
        } else {
            logger.info('compareLocationAllergens - No errors detected, therefore allergens are equal. Callback (null, true)');
            //Allergens are equal
            callback(null, true)

        }
    })

}


/* ------------------------- COMPUTE RECIPE ALLERGENS RECURSIVELY ---------------------------- */

exports.computeRecipeAllergensRecursively = (id, Model, parent, callback) => {

    var Subproduct = require('../models/subproduct');
    var Product = require('../models/product');
    var Drink = require('../models/drinks');
    var Dish = require('../models/dish');
    var Ingredient = require('../models/ingredient');
    var compElementsChanged = [];
    var erroneousAllergens = false;
    var activeVersion;
    var recipeLocation;

    if (Model == Subproduct) logger.info('computeRecipeAllergensRecursively - Processing subproduct with id: %s', id)
    if (Model == Product) logger.info('computeRecipeAllergensRecursively - Processing product with id: %s', id)
    if (Model == Dish) logger.info('computeRecipeAllergensRecursively - Processing dish with id: %s', id)
    if (Model == Drink) logger.info('computeRecipeAllergensRecursively - Processing drink with id: %s', id)

    waterfall([
        (cb) => { //Get active version of recipe

            Model.findOne({
                    _id: id
                }, {
                    versions: { $elemMatch: { active: true } },
                    location: true
                })
                .exec((err, doc) => {

                    if (err) return cb(err)

                    if (!doc.versions || !doc.versions.length) {
                        logger.error('Subproduct %s does not have an active version!', doc._id)
                        let err = new Error('Subproduct does not have an active version!')
                        return cb(err)
                    }

                    activeVersion = doc.versions[0];
                    recipeLocation = doc.location;

                    cb(null, doc);
                })

        }, (doc, cb) => { //Populate ingredients and subproducts, and its allergens

            async.each(activeVersion.composition, (compElement, cb_async) => {

                if (compElement.element.kind == 'subproduct') { //composition element is a subproduct

                    Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
                        if (err) return cb_async(err)

                        if (compElement.element.item != null) {

                            //Filter active version
                            let active = compElement.element.item.versions.filter((version) => {
                                return version.active;
                            })

                            compElement.element.item.versions = JSON.parse(JSON.stringify(active));
                            compElement.allergens = compElement.element.item.versions.allergens || [];
                            compElement.locationAllergens = compElement.element.item.versions.locationAllergens || [];

                            cb_async()
                        } else {
                            logger.error('compElement.element.item is null, %s, skipping', compElement)
                            cb_async();
                        }

                    });

                } else { //composition element is an ingredient

                    Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
                        if (err) return cb_async(err)

                        if (compElement.element.item != null) {

                        	  compElement.allergens = compElement.element.item.allergens || [];
                            compElement.locationAllergens = compElement.element.item.locationAllergens || [];
                            cb_async()

                        } else {
                            logger.error('compElement.element.item is null, %s, skipping', compElement)
                            cb_async();
                        }
                    });
                }

            }, (err) => { //finished async loop
                if (err) return cb(err)
                logger.info('computeRecipeAllergensRecursively - Finished updating recipe\'s composition elements')
                cb(null, doc);
            });


        }, (doc, cb) => { //Update allergens of composition elements

            compElementsChanged = [];
            erroneousAllergens = false;

            async.eachSeries(activeVersion.composition, (compElement, cb_async) => {

                if (compElement.element.item) {

                    if (compElement.element.kind == 'subproduct') {

                        logger.info('computeRecipeAllergensRecursively - Composition element is a subproduct')

                        let subproductId = new ObjectId(compElement.element.item._id)

                        //console.log(parent, 'parent')

                        let match = parent.some((_id) => {
                            let id = new ObjectId(_id);
                            return id.equals(subproductId)
                        })

                        if (match) {
                            logger.error('computeRecipeAllergensRecursively - Circular loop detected when calculating subproduct\'s allergens in recipe.')
                            process.nextTick(() => cb_async());

                        } else {

                            if (compElement.element.item) {

                                parent.push(compElement.element.item._id);

                                //Compute allergens of subproduct
                                exports.computeRecipeAllergensRecursively(compElement.element.item._id, Subproduct, parent, (err, res) => {
                                    parent.pop()
                                    if (err) {
                                        logger.error('computeRecipeAllergensRecursively - Error calculating allergens of subproduct %s', compElement.element.item._id)
                                        cb_async()
                                    } else {

                                        logger.info('computeRecipeAllergensRecursively - Calculated allergens for subproduct %s : %j', compElement.element.item._id, res)

                                        // exports.hasChanged(allergens, compElement.allergens, (hasChanged) => {

                                        //     if (hasChanged) {
                                        //         erroneousAllergens = true;
                                        //         let obj = {
                                        //             compElementId: compElement._id,
                                        //             allergens: allergens
                                        //         }
                                        //         compElementsChanged.push(obj);
                                        //         compElement.allergens = JSON.parse(JSON.stringify(allergens));
                                        //     }
                                        //     cb_async()
                                        // })
                                        compElement.allergens = res.referenceAllergens;
                                        compElement.locationAllergens = res.locationAllergens;
                                				process.nextTick(() => cb_async());
                                    }

                                })

                            } else {
                                logger.warn('computeRecipeAllergensRecursively - The value of a composition item is null. Skipping.')
                                process.nextTick(() => cb_async());
                            }

                        }

                    } else if (compElement.element.kind == 'ingredient') {

                        // exports.hasChanged(compElement.allergens, compElement.element.item.allergens, (hasChanged) => {

                        //     if (hasChanged) {
                        //         erroneousAllergens = true;
                        //         let obj = {
                        //             compElementId: compElement._id,
                        //             allergens: compElement.element.item.allergens
                        //         }
                        //         compElementsChanged.push(obj)
                        //         compElement.allergens = compElement.element.item.allergens;
                        //     }
                        //     cb_async()
                        // })
                        process.nextTick(() => cb_async());
                    }

                } else {
                    logger.error('computeRecipeAllergensRecursively - Composition element item %s is null. skipping.', compElement)
                    cb_async();
                }

            }, (err, results) => {
                logger.info('computeRecipeAllergensRecursively - Finished update allergens of composition elements.')
                cb(null, doc);
            })

        // }, (doc, cb) => {

        //     if (erroneousAllergens) { //Update active version of recipe because the allergens in at least one of the composition elements has changed.

        //         logger.info('Allergens in at least one of the composition elements are erroneous and have changed. Update recipe.')

        //         Model.findOne({
        //                 _id: id
        //             })
        //             .exec((err, recipe) => {

        //                 if (err) return cb(err)

        //                 if (!recipe || !recipe.versions || !recipe.versions.length) {
        //                     logger.error('Subproduct %s does not have an active version!', recipe._id)
        //                     let err = new Error('Subproduct does not have an active version!')
        //                     return cb(err)
        //                 }

        //                 recipe.versions.forEach((version) => {

        //                     if (version.active) {

        //                         version.composition.forEach((comp) => {

        //                             let compId = new ObjectId(comp._id);

        //                             let matchingCompElement = compElementsChanged.filter((compEl) => {
        //                                 let id = new ObjectId(compEl.compElementId);
        //                                 return compId.equals(id)
        //                             })

        //                             if (matchingCompElement.length) {
        //                                 comp.allergens = JSON.parse(JSON.stringify(matchingCompElement[0].allergens))
        //                             }
        //                         })
        //                     }
        //                 })

        //                 recipe.save((err, doc) => {
        //                     if (err) return cb(err)
        //                     cb(null, doc)
        //                 })
        //             })

        //     } else {
        //         cb(null, doc)
        //     }

      }, (doc, cb) => { //Calculate allergens of recipe

      		exports.calculateRecipeLocationAllergens(activeVersion, recipeLocation, (err, res) => {
      			if(err) return cb(err)
            cb(null, res)        			
      		})

      }
    ], (err, doc) => {
        if (err) return callback(err)
        callback(null, doc)
    })
}



/* ------------------------- COMPUTE INGREDIENT LOCATION ALLERGENS ---------------------------- */

exports.singleIngLocAllergens = (cookDesignAllergens, cookDesignLocations, ingId, callback) => {

    var config = require('../config/config');
    var waterfall = require('async-waterfall');
    var async = require('async');
    var { ObjectId } = require('mongodb');
    var allergenHelper = require('../helpers/allergen');
    var Ingredient = require('../models/ingredient');
    var ProviderArticle = require('../models/article');
    let locationAllergens = [];
    var ingredient;

    logger.info('singleIngLocAllergens - Entering job to calculate single ingredient location allergens.')

    async.waterfall([

        (cb) => {
            if (!ingId) {
                let err = new Error('singleIngLocAllergens - Ingredient id param not provided. Skipping!')
                return cb(err)
            }
            cb(null)

        }, (cb) => {

            Ingredient.findOne({ _id: ingId })
                .exec((err, doc) => {

                    if (err) return cb(err)

                    if (!doc) {
                        let err = new Error('singleIngLocAllergens - Could not find article!')
                        return cb(err)
                    }

                    ingredient = doc;

                    async.eachSeries(cookDesignLocations, (location, cb_async_loc) => {

                        let allergenObj = {
                            location: location,
                            allergens: []
                        }

                        logger.info('singleIngLocAllergens - Evaluating location %s', location)

                        ProviderArticle.find( //Find articles for this ingredient that include the location evaluated. There will be at least one result.
                            {
                                'category.item': ingredient._id,
                                'location': { $in: [location] }
                            }, (err, articles) => {

                                if (err) return cb_async_loc(err)

                                if (articles.length > 0) { //There are articles for this ingredient and location, calculate allergens

                                    logger.info('singleIngLocAllergens - There are %s articles for this ingredient and location, calculate allergens.', articles.length)

                                    let aggregatedAllergens = [];

                                    //Create aggregate array of all article allergens for one location
                                    articles.forEach((article) => {
                                        if (article.allergens.length) aggregatedAllergens = aggregatedAllergens.concat(article.allergens)
                                    })

                                    logger.info('singleIngLocAllergens - Calculated aggregatedAllergens %j', aggregatedAllergens)


                                    if (aggregatedAllergens.length) {

                                        logger.info('singleIngLocAllergens - Articles contain at least one or more allergens. Evaluate allergens one by one.')


                                        //For each cookDesign allergen, get the worse case scenario, that is, the higher allergen level.
                                        cookDesignAllergens.forEach((allergen) => {

                                            logger.info('singleIngLocAllergens - Evaluating cookDesign allergen %s', allergen._id)

                                            let id = new ObjectId(allergen._id);

                                            let matchAllergens = aggregatedAllergens.filter((aggAllergen) => {
                                                let aggId = new ObjectId(aggAllergen.allergen)
                                                return id.equals(aggId)
                                            })

                                            if (matchAllergens.length) { //One or more articles in this location contain this allergen. Compute the level and save it.

                                                logger.info('singleIngLocAllergens - Allergen included. Calculating worse case scenario level.')

                                                let level = 0;
                                                matchAllergens.forEach((match) => {
                                                    if (match.level > level) level = match.level;
                                                })

                                                logger.info('singleIngLocAllergens - Computed level is %s', level)

                                                let obj = {
                                                    allergen: allergen._id,
                                                    level: level
                                                }

                                                allergenObj.allergens.push(obj)
                                            } else {
                                                //None of the articles in this location contains this allergen. Move on to the next allergen...
                                                logger.info('singleIngLocAllergens - None of the articles in this location contains this allergen. Move on to the next allergen...')
                                            }
                                        })

                                        if (allergenObj.allergens.length) {
                                            locationAllergens.push(allergenObj)
                                            logger.info('singleIngLocAllergens - Calculated location allergens %j', allergenObj)
                                        } else {
                                            //Should never get here really, because aggregatedAllergens has length
                                            logger.warn('singleIngLocAllergens - There are no allergens for this location. Should never get here really, because aggregatedAllergens has length!')
                                        }
                                    } else {
                                        //None of the articles contains allergens, move on...
                                        logger.info('singleIngLocAllergens - None of the articles contains allergens, move on...')
                                    }

                                } else {
                                    //There are no articles for this location, there is nothing to do really...
                                    logger.info('singleIngLocAllergens - There are no articles for this location, move on...')
                                }

                                //Jump to next location
                                process.nextTick(() => cb_async_loc())
                            })

                    }, (err) => { //finished location async loop

                        if (err) return cb(err)
                        logger.info('singleIngLocAllergens ----->>> Computed locationAllergens for ingredient %s: %j', ingredient._id, locationAllergens)
                        cb(null)
                    })
                })

        }, (cb) => {

            logger.info('singleIngLocAllergens - Compare calculated location allergens with existing.')

            //Compare calculated location allergens with ingredient location allergens. If changed, update ingredient.
            allergenHelper.compareLocationAllergens(locationAllergens, ingredient.locationAllergens, (err, equals) => {
                if (err) return cb(err)

                if (equals) {
                    logger.info('singleIngLocAllergens - Location allergens have not changed.')
                    cb(null, false) //not updated
                } else {
                    logger.info('singleIngLocAllergens - Location allergens have changed, update ingredient.')
                    ingredient.locationAllergens = locationAllergens;

                    ingredient.save((err) => {
                        if (err) {
                            logger.error('singleIngLocAllergens - Error saving ingredient')
                            logger.error(err)
                            return cb(err)
                        }
                        logger.info('singleIngLocAllergens - Saved ingredient with updated allergens')
                        cb(null, true) //updated
                    });
                }

            })

        }
    ], (err, updated) => {
        if (err) {
            logger.error('singleIngLocAllergens - There was an error executing singleIngLocAllergens queue %s', err.message)
            return callback(err)
        }
        logger.info('singleIngLocAllergens - Successfully completed singleIngLocAllergens method.')
        callback(null, updated)
    })
}


/* ------------------------- COMPUTE RECIPE LOCATION ALLERGENS ---------------------------- */

exports.calculateRecipeLocationAllergens = (activeVersion, recipeLocation, callback) => {

	var locationLoop;
	var locationAllergens = [];
    let Subproduct = require('../models/subproduct');
    let Ingredient = require('../models/ingredient');

  
  	logger.info('calculateRecipeLocationAllergens - Entering method...')				
  	logger.info('calculateRecipeLocationAllergens - activeVersion is %j', activeVersion)		
  	logger.info('calculateRecipeLocationAllergens - recipeLocation is %j', recipeLocation)	


		async.waterfall([

			(cb) => { //Calculate location loop

				logger.info('calculateRecipeLocationAllergens - Computing location loop...')				

				locationLoop = recipeLocation.map((loc) => {
					let locObj = {
						location: loc
					}
					return locObj;
				})

				//Add reference cost to first place in location loop
				let refAllergenObj = {
						location: null
					}
				locationLoop.unshift(refAllergenObj)

				logger.info('calculateRecipeLocationAllergens - Location loop is recipe location array: %j', locationLoop)

				cb(null)			

			}, (cb) => { //Update location allergens of composition elements (?)

                async.each(activeVersion.composition, (compElement, cb_async) => {

                    if (compElement.element.kind == 'subproduct') { //composition element is a subproduct

                        Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
                            if (err) return cb_async(err)

                            if (compElement.element.item != null) {

                                //Filter active version
                                let active = compElement.element.item.versions.filter((version) => {
                                    return version.active;
                                })

                                compElement.element.item.versions = JSON.parse(JSON.stringify(active));
                                compElement.allergens = compElement.element.item.versions[0].allergens || [];
                                compElement.locationAllergens = compElement.element.item.versions[0].locationAllergens || [];

                                cb_async()
                            } else {
                                logger.error('compElement.element.item is null, %s, skipping', compElement)
                                cb_async();
                            }

                        });

                    } else { //composition element is an ingredient

                        Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
                            if (err) return cb_async(err)

                            if (compElement.element.item != null) {

                                compElement.allergens = compElement.element.item.allergens || [];
                                compElement.locationAllergens = compElement.element.item.locationAllergens || [];
                                cb_async()

                            } else {
                                logger.error('compElement.element.item is null, %s, skipping', compElement)
                                cb_async();
                            }
                        });
                    }

                }, (err) => { //finished async loop
                    if (err) return cb(err)
                    logger.info('computeRecipeAllergensRecursively - Finished updating recipe\'s composition elements')
                    cb(null);
                });

            }, (cb) => {

                locationLoop.forEach((loc)=> {

                        logger.info('calculateRecipeLocationAllergens - Starting calculation of location allergens for location %s', loc.location)

            let computedAllergens = [];

                activeVersion.composition.forEach((compElement) => {
                        let allergens; 

                                logger.info('calculateRecipeLocationAllergens - Evaluating composition element %j', compElement)

                                if(compElement.locationAllergens) {

                                    logger.info('calculateRecipeLocationAllergens - Composition element %s has locationAllergens array %j', compElement.name, compElement.locationAllergens)

									if(loc.location != null) {

										  let locId = new ObjectId(loc.location)

										  let matchAllergens = compElement.locationAllergens.find((locAllergen) => { 
										  	let locAllergenId = new ObjectId(locAllergen.location)
										  	return locId.equals(locAllergenId)
										  })

										  if(!matchAllergens) {
										  	allergens = compElement.allergens || [];
												logger.info('calculateRecipeLocationAllergens - Could not find location in location Array. Using reference allergens: %j. Recipe Version: %s ', allergens, activeVersion._id)
										  }
										  else
										  {
										  	allergens = matchAllergens.allergens;
												logger.info('calculateRecipeLocationAllergens - Found location in location Array. Using location allergens: %j. Recipe Version: %s ', allergens, activeVersion._id)
										  }
									}
									else
									{
										allergens = compElement.allergens || [];
										logger.info('calculateRecipeLocationAllergens - Reference allergens. Using reference allergens: %j. Recipe Version: %s ', allergens, activeVersion._id)
									}

								} else { //Recipe element does not have a locationArray. Set unitCost to referenceCost.
									allergens = compElement.allergens || [];
									logger.info('calculateRecipeLocationAllergens - Recipe element does not have location allergens. Set allergens to reference allergens: %s Recipe Version: %s ', allergens, activeVersion._id)
								}

		            if (allergens && allergens.length > 0) { //check whether there are allergens in the element

		                allergens.forEach((elementAllergenObj) => { //go over allergens of each element
		                    //element.allergens object =
		                    //{
		                    //	allergen: ObjectId,
		                    //  level: number
		                    //}
		                    let elementAllergObjectId = new ObjectId(elementAllergenObj.allergen);

		                    if (computedAllergens.length > 0) { //If the updated allergen list is empty, just add the allergen otherwise check whether it exist and its level
		                        let match = false;
		                        computedAllergens.forEach((allergenObj) => {
		                            let allergObjectId = new ObjectId(allergenObj.allergen);
		                            if (elementAllergObjectId.equals(allergObjectId)) {
		                                //console.log('match is true')
		                                match = true;
		                                if (elementAllergenObj.level > allergenObj.level) {
		                                    //Level is higher therefore update level
		                                    allergenObj.level = elementAllergenObj.level;
		                                }
		                            }
		                        })
		                        if (!match) { //allergen is not in the list of allergens, add it.	
		                            let allObj = {
		                                allergen: elementAllergenObj.allergen,
		                                level: elementAllergenObj.level
		                            }
		                            computedAllergens.push(allObj);
		                        }
		                    } else { //computedAllergens is empty, just add the allergen
		                        let allObj = {
		                            allergen: elementAllergenObj.allergen,
		                            level: elementAllergenObj.level
		                        }
		                        computedAllergens.push(allObj)
		                    }
		                })
		            }

		        })

		        logger.info('calculateRecipeLocationAllergens - Finished computing allergens for location %s. Computed allergens: %j', loc.location, computedAllergens)

		        if(loc.location != null) {

		        		if(computedAllergens.length) {

						        let obj = {
						        	location: loc.location,
						        	allergens: computedAllergens
						        }

						        locationAllergens.push(obj)
						    }
				    }
				    else
				    {
				    	referenceAllergens = computedAllergens;
				    }
				})
				cb(null)

			}], (err) => {
				if(err) return callback(err)

				let results = {
					locationAllergens : locationAllergens,
					referenceAllergens: referenceAllergens
				}
				logger.info('calculateRecipeLocationAllergens - Finished computing allergens for all locations: %j', results)
				callback(null, results)
		})

}