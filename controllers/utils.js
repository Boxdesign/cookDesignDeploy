var async = require('async');
var waterfall = require('async-waterfall');
var config = require('../config/config');
var { ObjectId } = require('mongodb')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.utils;
var mongoose = require('../node_modules/mongoose');
var Ingredient = require('../models/ingredient');
var Allergen = require('../models/allergen')
/* -----------------------------------DELETE RECIPES NON ACTIVE VERSIONS-----------------------------------------------------------*/

exports.deleteRecipesNonActiveVersions = (req, res) => {

    var Subproduct = require('../models/subproduct');
    var Product = require('../models/product');
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var Models = [Subproduct, Product, Dish, Drink]

    logger.info('Entering method to delete non active version form recipies...')

    async.eachSeries(Models, (Model, cb_async1) => {

        if (Model == Dish) logger.info('Starting process to remove versions from dishes')
        if (Model == Drink) logger.info('Starting process to remove versions from drinks')
        if (Model == Product) logger.info('Starting process to remove versions from products')
        if (Model == Subproduct) logger.info('Starting process to remove versions from subproducts')

        waterfall([
            (cb) => {

                Model.find({}, { _id: 1 }, (err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs);
                });


            }, (docs, cb) => {

                async.eachSeries(docs, (doc, cb_async2) => {

                    Model.findOne({ _id: doc._id }, (err, doc) => {
                        if (err) return cb(err)

                        let activeVersion = doc.versions.filter((version) => { return version.active == true });

                        doc.versions = JSON.parse(JSON.stringify(activeVersion))

                        doc.save((err, doc) => {
                            if (err) logger.error('Error saving document: %s', doc._id);
                            cb_async2()
                        })

                    });

                }, (err) => { //Finished cb_async2 loop
                    if (err) return cb(err)
                    cb(null, docs);
                })


            }
        ], (err, docs) => {

            if (err) return cb_async1(err)

            if (Model == Dish) logger.info('Finished removing versions from dishes')
            if (Model == Drink) logger.info('Finished removing versions from drinks')
            if (Model == Product) logger.info('Finished removing versions from products')
            if (Model == Subproduct) logger.info('Finished removing versions from subproducts')

            cb_async1()

        })

    }, (err) => { //Finished Model async loop

        if (err) return res.status(500).json(err.message || 'Error').end();
        logger.info('Finished method to remove versions.')
        res.status(200).json().end();
    })
}

/* -----------------------------------DELETE GASTRO OFFER NON ACTIVE VERSIONS-----------------------------------------------------------*/

exports.deleteGastroOfferNonActiveVersions = (req, res) => {

    var gastroOffer = require('../models/gastroOffer');
    var sortField = 'updatedAt';
    var sortOrder = -1;
    var count = 1;

    logger.info('Entering method to delete non active versions from gastro offers. Max num of versions allowed is %s.', config.maxNumVersionsGastroOffer)

    waterfall([
        (cb) => {

            gastroOffer.find({}, { _id: 1 }, (err, docs) => {
                if (err) return cb(err)
                logger.info('Found %s gastro offers.', docs.length)
                cb(null, docs);
            });

        }, (docs, cb) => {

            async.eachSeries(docs, (doc, cb_async) => {

                gastroOffer.findOne({ _id: doc._id }, (err, doc) => {

                    if (err) return cb(err)

                    let referenceNumber = doc.referenceNumber;

                    logger.info('Evaluating gastro offer #%s with reference number %s', count, referenceNumber)
                    logger.info('Gastro offer has %s versions.', doc.versions.length)

                    if (doc.versions.length <= config.maxNumVersionsGastroOffer) {
                        logger.info("Number of versions in gastro is smaller than max allowed, skipping.")
                        count++;
                        process.nextTick(() => { cb_async() });
                    } else {

                        logger.info("Number of versions in gastro is larger than max allowed, remove.")

                        let activeVersion = doc.versions.filter((version) => { return version.active == true });

                        let nonActiveVersion = doc.versions.filter((version) => { return version.active == false });

                        nonActiveVersion.sort(function(a, b) { return (a[sortField] > b[sortField]) ? sortOrder : ((b[sortField] > a[sortField]) ? -sortOrder : 0); });

                        nonActiveVersion = nonActiveVersion.slice(0, config.maxNumVersionsGastroOffer - 1);

                        let versions = activeVersion.concat(nonActiveVersion)

                        versions = versions.reverse()

                        doc.versions = JSON.parse(JSON.stringify(versions))

                        doc.save((err, doc) => {
                            if (err) logger.error('Error saving document with referenceNumber %s!', referenceNumber);
                            else logger.info('Saved gastro offer with referenceNumber %s.', referenceNumber)
                            count++;
                            cb_async()
                        })
                    }
                });

            }, (err) => {
                if (err) return cb(err)
                cb(null, docs);
            })

        }
    ], (err, docs) => {

        logger.info('Finished method to remove oldest versions from gastro offers.')

        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json().end();
    })
}

/* -----------------------------------EXTRACT PROVIDER ARTICLES IN LOCATION -----------------------------------------------------------*/

exports.extractProviderArticlesInLocation = (req, res) => {

    var params = req.query;
    var location = new ObjectId(params.location);
    var model = params.model;
    var Model
    var ingredientList = [];
    var reportHelper = require('../helpers/report')
    var Subproduct = require('../models/subproduct')
    var Ingredient = require('../models/ingredient')
    var Article = require('../models/article')
    var json2csv = require('json2csv');
    let userProfile = req.userData;
    var resultList = [];
    var fs = require('fs');
    var utilsHelper = require('../helpers/utils')

    async.waterfall([

        (cb) => {

            switch (model) {
                case 'subproduct':
                    Model = Subproduct
                    cb(null, true)
                    break;

                default:
                    let err = new Error('Only subproducts supported at this time.')
                    return cb(err)
                    break;
            }

        }, (docs, cb) => {

            Model.find({
                    active: true,
                    location: { $in: [location] },
                    versions: { $elemMatch: { active: true } }
                })
                .exec((err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs)
                })

        }, (docs, cb) => {

            async.eachSeries(docs, (doc, cb_async) => {

                let parent = [doc._id]

                reportHelper.getIngredientsInSubproduct(doc._id, parent, (err, res) => {
                    if (err) return cb_async(err)
                    if (res.length > 0) ingredientList = ingredientList.concat(res);
                    cb_async();
                });

            }, (err) => {
                if (err) return cb(err)
                ingredientList = utilsHelper.removeDuplicates(ingredientList);
                cb(null, docs)
            })

        }, (docs, cb) => {

            Ingredient.find({
                    _id: { $in: ingredientList },
                    lang: { $elemMatch: { langCode: userProfile.user.language } }
                })
                .exec((err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs);
                })

        }, (docs, cb) => {
            //Pasos para obtener informacion necesaria para agrupar informacion a exportar

            async.eachOfSeries(docs, (ingredient, index, cb_async) => {

                //logger.debug('Report Controller --- getIngredientsAndArticlesByLocations --- find articles in BBDD that category.item: %s  is in ingredientsList', ingredient._id)

                let ingObject = {
                    ingName: ingredient.lang[0].name,
                    referenceCost: ingredient.referencePrice ? ingredient.referencePrice.toFixed(2) : '',
                    articleDescription: '',
                    provider: '',
                    providerPrice: ''
                }
                resultList.push(ingObject);

                Article.find({
                        "category.item": ingredient._id
                    })
                    .populate("provider last_account document packFormat location")
                    .exec((err, docs) => {
                        if (err) return cb(err)
                        //console.log(docs,'docs')
                        if (docs.length) {

                            docs.forEach((article) => {

                                let articleObject = {
                                    ingName: ingredient.lang[0].name,
                                    referenceCost: ingredient.referencePrice ? ingredient.referencePrice.toFixed(2) : '',
                                    articleDescription: article.lang[0].description,
                                    reference: article.reference,
                                    externalReference: article.externalReference,
                                    provider: article.provider.commercialName,
                                    providerPrice: article.netPrice ? article.netPrice.toFixed(2) : ''
                                }
                                resultList.splice(index, 1, articleObject);

                            })

                        } else {

                            let ingObject = {
                                ingName: ingredient.lang[0].name,
                                referenceCost: ingredient.referencePrice ? ingredient.referencePrice.toFixed(2) : '',
                                articleDescription: ' -- No articles found --',
                                reference: ' -- No articles found --',
                                externalReference: ' -- No articles found --',
                                provider: '-- No providers found --',
                                providerPrice: '-- No provider price exist --'
                            }
                            resultList.splice(index, 1, ingObject);

                        }
                        cb_async();
                    });

            }, (err) => {
                //console.log(articlesList.length,'articlesList')
                if (err) return cb(err)
                cb(null, docs)
            })

        }, (doc, cb) => {

            var fields = ['ingName', 'referenceCost', 'articleDescription', 'reference', 'externalReference', 'provider', 'providerPrice'];
            var fieldNames = ['Ingrediente', 'Coste de referencia', 'Artículo(s)', 'Referencia proveedor', 'Código externo', 'Proveedor(es)', 'Precio neto'];

            json2csv({ data: resultList, fields: fields, fieldNames: fieldNames }, (err, csv) => {
                if (err) return cb(err);

                fs.writeFile('/tmp/reportextractProviderArticlesInLocation.csv', csv, (err) => {
                    if (err) return cb(err);
                    cb(null, doc)
                });
            });

        }
    ], (err, docs) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json().end();
    })

}

/* -------------------------------FLAG RECURSIVE LOOPS IN SUBPRODUCTS ---------------------------------------------------------------*/

exports.flagRecursiveLoopsInSubproducts = (req, res) => {

    var totalNumSubps;
    var subpCount = 0;
    var subproductsWithRecursiveLoop = []

    var Subproduct = require('../models/subproduct')
    var utilsHelper = require('../helpers/utils')

    async.waterfall([

        (cb) => {

            Subproduct.count({}, (err, count) => {
                if (err) return cb(err)
                totalNumSubps = count;
                logger.info('flagRecursiveLoopsInSubproducts - Found %s subproducts', count)
                cb(null, true)
            })

        }, (doc, cb) => {

            logger.info('flagRecursiveLoopsInSubproducts - Starting subproduct recursive loop check...')

            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, subpCount < totalNumSubps);
                },
                (callback) => {

                    Subproduct
                        .findOne({})
                        .skip(subpCount)
                        .limit(1)
                        .exec((err, doc) => {

                            if (err) callback(err)

                            //logger.info('Evaluating subproduct #%s with id %s', subpCount, doc._id)

                            utilsHelper.checkRecursiveLoopInSubproduct(doc._id, [doc._id], (err, res) => {
                                if (err) {
                                    logger.error('flagRecursiveLoopsInSubproducts - Error found with subproduct %s', doc._id)
                                    logger.error(err)
                                    subproductsWithRecursiveLoop.push(doc)
                                }
                                subpCount++;
                                callback()
                            })
                        })

                }, (err) => { // Finished looping through all subproducts
                    if (err) return cb(err)
                    logger.info('flagRecursiveLoopsInSubproducts - Finished looping through all subproducts')
                    logger.info('flagRecursiveLoopsInSubproducts - Found %s subproducts with recursive loop', subproductsWithRecursiveLoop.length)
                    cb(null, subproductsWithRecursiveLoop)
                })

        }
    ], (err, docs) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(docs).end();
    })
}

/* ----------------------------- DELETE RECIPES WITHOUT ACTIVE VERSION -----------------------------------------------------------------*/

exports.deleteRecipesWithoutActiveVersion = (req, res) => {

    var totalNumRecipes;
    var deletedRecipes = [];
    var Subproduct = require('../models/subproduct');
    var Product = require('../models/product');
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var GastroOffer = require('../models/gastroOffer');
    var Models = [Subproduct, Product, Dish, Drink, GastroOffer]

    async.waterfall([

        (cb) => {

            async.eachSeries(Models, (Model, cb_async) => {

                if (Model == Subproduct) logger.info('deleteRecipesWithoutActiveVersion - Starting process to remove subproducts without active version')
                if (Model == Product) logger.info('deleteRecipesWithoutActiveVersion - Starting process to remove products without active version')
                if (Model == Dish) logger.info('deleteRecipesWithoutActiveVersion - Starting process to remove dishes without active version')
                if (Model == Drink) logger.info('deleteRecipesWithoutActiveVersion - Starting process to remove drinks without active version')
                if (Model == GastroOffer) logger.info('deleteRecipesWithoutActiveVersion - Starting process to remove gastro offers without active version')

                let recipeCount = 0;

                async.waterfall([

                    (cb) => {

                        Model.count({}, (err, count) => {
                            if (err) return cb(err)
                            totalNumRecipes = count;
                            // logger.info('deleteRecipesWithoutActiveVersion - Found %s recipes', count)
                            cb(null, true)
                        })

                    }, (doc, cb) => {

                        // if(Model == Subproduct) logger.info('deleteRecipesWithoutActiveVersion - Starting subproduct check...')		    	
                        // if(Model == Product) logger.info('deleteRecipesWithoutActiveVersion - Starting product check...')
                        //  		if(Model == Dish) logger.info('deleteRecipesWithoutActiveVersion- Starting dish check...')
                        // if(Model == Drink) logger.info('deleteRecipesWithoutActiveVersion - Starting drink check...')			

                        async.during(
                            (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                                return callback(null, recipeCount < totalNumRecipes);
                            },
                            (callback) => {

                                Model
                                    .findOne({}, {
                                        versions: { $elemMatch: { active: true } },
                                        _id: true
                                    })
                                    .skip(recipeCount)
                                    .limit(1)
                                    .exec((err, doc) => {

                                        if (err) callback(err)

                                        if (!doc.versions[0]) {
                                            if (Model == Dish) logger.warn('deleteRecipesWithoutActiveVersion- Found dish without active version')
                                            if (Model == Drink) logger.info('deleteRecipesWithoutActiveVersion - Found dish without active version')
                                            if (Model == Product) logger.info('deleteRecipesWithoutActiveVersion - Found dish without active version')
                                            if (Model == Subproduct) logger.info('deleteRecipesWithoutActiveVersion - Found subproduct without active version')
                                            if (Model == GastroOffer) logger.info('deleteRecipesWithoutActiveVersion - Found gastro offer without active version')

                                            deletedRecipes.push(doc)

                                            recipeCount++;
                                            callback();
                                        } else {
                                            recipeCount++;
                                            callback();
                                        }

                                    })

                            }, (err) => { // Finished looping through all recipes
                                if (err) return cb(err)
                                if (Model == Dish) logger.warn('deleteRecipesWithoutActiveVersion- Finished looping through all dishes')
                                if (Model == Drink) logger.info('deleteRecipesWithoutActiveVersion - Finished looping through all drinks')
                                if (Model == Product) logger.info('deleteRecipesWithoutActiveVersion - Finished looping through all products')
                                if (Model == Subproduct) logger.info('deleteRecipesWithoutActiveVersion - Finished looping through all subproducts')
                                if (Model == GastroOffer) logger.info('deleteRecipesWithoutActiveVersion - Finished looping through all gastro offers')

                                cb(null, true)
                            })

                    }
                ], (err, docs) => { //Finished recipe check, move on to next Model
                    if (err) return cb_async(err)
                    cb_async();
                })

            }, (err) => {
                if (err) return cb(err)
                cb(null, true)
            })

        }, (doc, cb) => { //Remove recipes

            if (deletedRecipes.length) {

                logger.info('deleteRecipesWithoutActiveVersion - Starting process to delete recipes without active version...')
                //Remove recipes
                async.eachSeries(deletedRecipes, (doc, cb_async) => {
                    doc.remove((err, doc) => {
                        if (err) return cb_async(err)
                        logger.info('Deleted recipe...')
                        cb_async()
                    })
                }, (err) => {
                    if (err) return cb(err)
                    cb(null, true)
                })

            } else {
                cb(null, true)
            }

        }
    ], (err, docs) => {

        if (err) return res.status(500).json(err.message || 'Error').end();
        logger.info('deleteRecipesWithoutActiveVersion - Finished method successfully')
        res.status(200).json(deletedRecipes).end();

    })
}

/* ------------------------------------------- MIGRATE GITHUB ISSUES -----------------------------------------------------------------*/

exports.migrateGithubIssues = (req, res) => {

    var config = require('../config/config');
    var async = require('async')
    var request = require('request');
    var access_token = config.github.accessToken;
    var appVersionList;
    var oilmotion_access_token = '7a1fd0c0d0949ae8644260ac7c1eadaa09e96454'
    var oilmotion_reporUrl = 'https://github.com/Oilmotion/OldCookDesignWeb---WebpackAngularRC4'
    var oilmotion_user = 'Oilmotion'
    var oilmotionCookDesignIssues = [];
    var oilmotionCookSystemIssues = [];
    var oilmotionIssues = [];
    var numberOfCookDesignPages = 10;
    var numberOfCookSystemPages = 5;

    logger.info('Starting github issues migration method...')

    async.waterfall([

        (cb) => { //Get list of github issues in Oilmotion CookDesign  /repos/:owner/:repo/issues

            let pageCount = 1;
            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, pageCount <= numberOfCookDesignPages);
                },
                (callback) => {

                    request.get({
                        url: 'https://api.github.com/repos/Oilmotion/OldCookDesignWeb---WebpackAngularRC4/issues',
                        json: true,
                        headers: {
                            'User-Agent': 'Oilmotion'
                        },
                        qs: {
                            access_token: access_token,
                            type: 'private',
                            state: 'all',
                            page: pageCount.toString()
                        }
                    }, (err, res, body) => {

                        if (body.errors) {
                            logger.error('Error retrieving list of CookDesign issues')
                            logger.error(body.errors)
                            return callback(body.errors)
                        }
                        // logger.info('res: %j', res)

                        oilmotionCookDesignIssues = oilmotionCookDesignIssues.concat(body)
                        pageCount++;
                        callback()
                    })

                }, (err) => { //Finished obtaining all issue pages (30 issues per page)
                    if (err) return cb(err)
                    //console.log(oilmotionCookDesignIssues,'oilmotionISSUES')
                    oilmotionCookDesignIssues = oilmotionCookDesignIssues.map((issue) => {
                        issue.repo = 'CookDesign'
                        return issue
                    })
                    logger.info('Found %s issues in Oilmotion CookDesign repo', oilmotionCookDesignIssues.length)
                    // logger.info('CookDesign Issues: %j', oilmotionCookDesignIssues)
                    cb(null)
                })

        }, (cb) => { //Get list of github issues in Oilmotion CookSystem  /repos/:owner/:repo/issues

            let pageCount = 1;
            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, pageCount <= numberOfCookSystemPages);
                },
                (callback) => {

                    request.get({
                        url: 'https://api.github.com/repos/Oilmotion/CookSystemWeb/issues',
                        json: true,
                        headers: {
                            'User-Agent': 'Oilmotion'
                        },
                        qs: {
                            access_token: access_token,
                            type: 'private',
                            state: 'all',
                            page: pageCount.toString()
                        }
                    }, (err, res, body) => {

                        if (body.errors) {
                            logger.error('Error retrieving list of CookSystem issues')
                            logger.error(body.errors)
                            return callback(body.errors)
                        }
                        // logger.info('res: %j', res)

                        oilmotionCookSystemIssues = oilmotionCookSystemIssues.concat(body)
                        pageCount++;
                        callback()
                    })

                }, (err) => { //Finished obtaining all issue pages (30 issues per page)
                    if (err) return cb(err)
                    oilmotionCookSystemIssues = oilmotionCookSystemIssues.map((issue) => {
                        issue.repo = 'CookSystem'
                        return issue
                    })
                    logger.info('Found %s issues in Oilmotion CookSystem repo', oilmotionCookSystemIssues.length)
                    oilmotionIssues = oilmotionIssues.concat(oilmotionCookDesignIssues)
                    oilmotionIssues = oilmotionIssues.concat(oilmotionCookSystemIssues)
                    logger.info('There are %s issues in Oilmotion CookDesign and CookSystem repo', oilmotionIssues.length)
                    cb(null)
                })

        }, (cb) => { //Loop through issues and add them to the new repo

            async.eachSeries(oilmotionIssues, (issue, cb_async_issues) => {

                let comments;
                let commentsUrl;
                let newIssue;
                let originalState = issue.state;

                async.waterfall([

                    (cb_2) => { //Get issue comments  /repos/:owner/:repo/issues/:number/comments

                        commentsUrl = issue.comments_url;
                        request.get({
                            url: commentsUrl,
                            json: true,
                            headers: {
                                'User-Agent': 'Oilmotion'
                            },
                            qs: {
                                access_token: access_token,
                                type: 'private'
                            }
                        }, (err, res, body) => {

                            if (body.errors) {
                                logger.error('Error getting issue comments')
                                logger.error(body.errors)
                                return cb_2(body.errors)
                            }

                            comments = body;
                            logger.info('Issue has %s comments', comments.length)
                            cb_2(null)
                        })

                    }, (cb_2) => { //Create issue

                        delete issue.assignee;
                        delete issue.assignees;

                        issue.labels = [{
                            name: issue.repo
                        }]

                        request.post({
                            url: 'https://api.github.com/repos/albirasolutions/Oilmotion/issues',
                            json: true,
                            headers: {
                                'User-Agent': 'Oilmotion'
                            },
                            qs: {
                                access_token: access_token,
                                type: 'private'
                            },
                            body: issue
                        }, (err, res, body) => {

                            if (body.errors) {
                                logger.error('Error creating %s issue', issue.repo)
                                logger.error(body.errors)
                                return cb_2(body.errors)
                            }

                            newIssue = body;
                            //console.log(latestGithubRelease, 'latestGithubRelease')
                            logger.info('Created %s issue in repo', issue.repo)
                            cb_2(null)
                        })

                    }, (cb_2) => { //If issue state was 'closed', close new issue.  PATCH /repos/:owner/:repo/issues/:number

                        if (originalState == 'closed') {

                            request.patch({
                                url: 'https://api.github.com/repos/albirasolutions/Oilmotion/issues/' + newIssue.number,
                                json: true,
                                headers: {
                                    'User-Agent': 'Oilmotion'
                                },
                                qs: {
                                    access_token: access_token,
                                    type: 'private'
                                },
                                body: { state: 'closed' }
                            }, (err, res, body) => {

                                if (body.errors) {
                                    logger.error('Error changing issue state to closed')
                                    logger.error(body.errors)
                                    return cb_2(body.errors)
                                }

                                //console.log(latestGithubRelease, 'latestGithubRelease')
                                logger.info('Changed issue state to closed')
                                cb_2(null)
                            })
                        } else {
                            cb_2(null)
                        }

                    }, (cb_2) => { //Add comments to issue /repos/:owner/:repo/issues/:number/comments

                        async.eachSeries(comments, (comment, cb_async) => {

                            request.post({
                                url: 'https://api.github.com/repos/albirasolutions/Oilmotion/issues/' + newIssue.number + '/comments',
                                json: true,
                                headers: {
                                    'User-Agent': 'Oilmotion'
                                },
                                qs: {
                                    access_token: access_token,
                                    type: 'private'
                                },
                                body: comment
                            }, (err, res, body) => {

                                if (body.errors) {
                                    logger.error('Error adding comments to issue')
                                    logger.error(body.errors)
                                    return cb_async(body.errors)
                                }

                                //console.log(latestGithubRelease, 'latestGithubRelease')
                                logger.info('Added comments to repo', body)
                                cb_async()
                            })

                        }, (err) => { //Finished adding comments
                            if (err) return cb_2(err)
                            cb_2(null)
                        })

                    }
                ], (err) => {
                    if (err) {
                        if (err == true) cb_async_issues()
                        else cb_async_issues(err)
                    } else {
                        cb_async_issues()
                    }
                })

            }, (err) => { //End of oilmotionIssues loop
                if (err) return cb(err)
                cb(null)
            })

        }
    ], (err) => {

        if (err) {
            if (err == true) res.status(200).end();
            else return res.status(500).json(err || 'Error').end();
        } else {
            res.status(200).end();
            logger.info('Finished issue migration method.')
        }
    })

}


/* ------------------------------------------- MIGRATE GITHUB ISSUES -----------------------------------------------------------------*/

exports.migrateGithubIssuesToXls = (req, res) => {

    var config = require('../config/config');
    var async = require('async')
    var request = require('request');
    var json2csv = require('json2csv');
    var fs = require('fs');
    var access_token = config.github.accessToken;
    var appVersionList;
    var oilmotion_access_token = '7a1fd0c0d0949ae8644260ac7c1eadaa09e96454'
    var oilmotion_reporUrl = 'https://github.com/albirasolutions/Oilmotion'
    var oilmotion_user = 'albirasolutions'
    var oilmotionIssues = [];
    var oilmotionIssues = [];
    var numberOfPages = 10;
    let fileName

    logger.info('Starting github issues migration method...')

    async.waterfall([

        (cb) => { //Get list of github issues in Oilmotion CookDesign  /repos/:owner/:repo/issues

            let pageCount = 1;
            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, pageCount <= numberOfPages);
                },
                (callback) => {

                    request.get({
                        url: 'https://api.github.com/repos/albirasolutions/Oilmotion/issues',
                        json: true,
                        headers: {
                            'User-Agent': 'albirasolutions'
                        },
                        qs: {
                            access_token: access_token,
                            type: 'private',
                            state: 'open',
                            page: pageCount.toString()
                        }
                    }, (err, res, body) => {

                        if (body.errors) {
                            logger.error('Error retrieving list of CookDesign issues')
                            logger.error(body.errors)
                            return callback(body.errors)
                        }
                        // logger.info('res: %j', res)

                        oilmotionIssues = oilmotionIssues.concat(body)
                        pageCount++;
                        callback()
                    })

                }, (err) => { //Finished obtaining all issue pages (30 issues per page)
                    if (err) return cb(err)
                    //console.log(oilmotionIssues,'oilmotionISSUES')
                    oilmotionIssues = oilmotionIssues.map((issue) => {
                      let label
                      if(issue.labels && issue.labels.length > 0) label = issue.labels[0].name
                      else label = '---'
                      //console.log('issue: ',issue)
                      return issue = {
                        Label: label,
                        Number: issue.number,
                        ID : issue.id,
                        Title : issue.title,
                        Url : issue.html_url,
                        CreatedAt : issue.created_at,
                        UpdatedAt : issue.updated_at
                      }
                    })
                    //console.log(oilmotionIssues,' NEW oilmotionISSUES')
                    logger.info('Found %s issues in Oilmotion CookDesign repo', oilmotionIssues.length)
                    // logger.info('CookDesign Issues: %j', oilmotionCookDesignIssues)
                    cb(null)
                })


        }, (cb) => { //Loop through issues and add them to the new repo

          var fields = ['Label','Number','ID','Title','Url','CreatedAt','UpdatedAt'];

          var fieldNames = ['Etiqueta','Numero','ID','Título','Contenido','Creado','Actualizado'];

          fileName = '/tmp/oilmotion_issues.csv';

          json2csv({ data: oilmotionIssues, fields: fields, fieldNames: fields}, function(err, csv) {
            if (err) cb(err);
            fs.writeFile(fileName, csv, function(err) {
                if (err) return cb(err);
                //console.log(csv,': CSV')
                logger.info('Create csv file: %s', fileName)
                cb(null, csv)
              });           
          });

        }

    ], (err) => {

        if (err) {
            if (err == true) res.status(200).end();
            else return res.status(500).json(err || 'Error').end();
        } else {
            res.download(fileName, 'oilmotion_issues.csv'); 
            //res.send().status(200);
            logger.info('Finished issue export method.')
        }
    })

}



/* ------------------------------------------- REMOVE DUPLICATE LOCATIONS -----------------------------------------------------------------*/

exports.removeDuplicatedLocs = (req, res) => {

    var totalNumRecipes;
    var deletedRecipes = [];
    var Subproduct = require('../models/subproduct');
    var Product = require('../models/product');
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var GastroOffer = require('../models/gastroOffer');
    var Models = [Subproduct, Product, Dish, Drink, GastroOffer]
    var activeVersion;
    var locHelper = require('../helpers/locations')

    async.waterfall([

        (cb) => {

            async.eachSeries(Models, (Model, cb_async) => {

                if (Model == Subproduct) logger.info('removeDuplicatedLocs - Starting process to remove duplicated locations in subproducts')
                if (Model == Product) logger.info('removeDuplicatedLocs - Starting process to remove duplicated locations in products')
                if (Model == Dish) logger.info('removeDuplicatedLocs - Starting process to remove duplicated locations in dishes')
                if (Model == Drink) logger.info('removeDuplicatedLocs - Starting process to remove duplicated locations in drinks')
                if (Model == GastroOffer) logger.info('removeDuplicatedLocs - Starting process to remove duplicated locations in gastro offers')

                let erroneousLocations = 0;
                let recipeCount = 0;

                async.waterfall([

                    (cb) => {

                        Model.count({}, (err, count) => {
                            if (err) return cb(err)
                            totalNumRecipes = count;
                            cb(null, true)
                        })

                    }, (doc, cb) => {

                        async.during(
                            (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                                return callback(null, recipeCount < totalNumRecipes);
                            },
                            (callback) => {

                                Model
                                    .findOne({})
                                    .skip(recipeCount)
                                    .limit(1)
                                    .exec((err, doc) => {

                                        if (err) callback(err)

                                        let arrayWithoutDups = locHelper.removeDuplicates(JSON.parse(JSON.stringify(doc.location)))

                                        if (doc.location.length != arrayWithoutDups.length) {
                                            erroneousLocations++;
                                            recipeCount++;
                                            doc.location = locHelper.removeDuplicates(JSON.parse(JSON.stringify(doc.location)));
                                            doc.save((err) => {
                                                if (err) {
                                                    logger.error(err)
                                                    callback();
                                                } else {
                                                    callback();
                                                }
                                            })
                                        } else {
                                            recipeCount++;
                                            callback();
                                        }
                                    })

                            }, (err) => { // Finished looping through all recipes
                                if (err) return cb(err)
                                if (Model == Dish) logger.warn('removeDuplicatedLocs- Finished looping through all dishes. Found %s erroneous locations', erroneousLocations)
                                if (Model == Drink) logger.info('removeDuplicatedLocs - Finished looping through all drinks. Found %s erroneous locations', erroneousLocations)
                                if (Model == Product) logger.info('removeDuplicatedLocs - Finished looping through all products. Found %s erroneous locations', erroneousLocations)
                                if (Model == Subproduct) logger.info('removeDuplicatedLocs - Finished looping through all subproducts. Found %s erroneous locations', erroneousLocations)
                                if (Model == GastroOffer) logger.info('removeDuplicatedLocs - Finished looping through all gastro offers. Found %s erroneous locations', erroneousLocations)

                                cb(null, true)
                            })

                    }
                ], (err, docs) => { //Finished recipe check, move on to next Model
                    if (err) return cb_async(err)
                    cb_async();
                })

            }, (err) => {
                if (err) return cb(err)
                cb(null, true)
            })

        }
    ], (err, docs) => {

        if (err) return res.status(500).json(err.message || 'Error').end();
        logger.info('deleteRecipesWithoutActiveVersion - Finished method successfully')
        res.status(200).json(deletedRecipes).end();

    })
}


/* ------------------------------------------- SELENTA WEB MP SERVICE   -----------------------------------------------------------------*/
exports.selentaMPWebService = (req, res) => {

    var params = req.query;
    var readLocalFile = params.readLocalFile;
    var selentaHelper = require('../helpers/selentaWebService')

    selentaHelper.updateSelentaArticles(readLocalFile, (err) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        logger.info('Finished Selenta Web MP service update successfully')
        res.status(200).json('Finished Selenta Web MP service update successfully').end();
    })

}


/* ------------------------------------------- SELENTA WEB MP SERVICE CHEK -----------------------------------------------------------------*/

exports.selentaWebMPServiceCheck = (req, res) => {

    //1. Extract list of generic ingredients that compose gastro offers in Philophia location
    //2. Extract list of provider articles associated with generic ingredients
    //3. Verify whether there are any issues with these articles and the selenta web Mp service.

    //Bar location id: "5841c01245205249fa1cb6d7"
    //Philosofia id: "5841c00445205249fa1cb6d6"

    var params = req.query;
    var locationId;
    var reportHelper = require('../helpers/report')
    var utilsHelper = require('../helpers/utils')
    var GastroOffer = require('../models/gastroOffer');
    var Selenta = require('../models/selenta');
    var Location = require('../models/location');
    var ProviderArticle = require('../models/article');
    var gastros;
    var ingredientList = []
    var userProfile = req.userData;
    var ingredientsWithProviderArticles = [];
    var ingredientsWithoutProviderArticles = [];
    var providerArticles = [];
    var json2csv = require('json2csv');
    var erroneousArticleIds;
    var articleLines = [];
    var ingredientLines = [];
    var fs = require('fs');
    var erroneousCodes;
    var erroneousArticles;
    var fields;
    var fieldNames;
    var locName;

    async.waterfall([

        (cb) => { //Get list of gastros in philosofia location

            if (params.locationId) locationId = new ObjectId(params.locationId);

            if (!locationId) {
                let err = new Error('Error: please provide location id.')
                logger.error('selentaWebMPServiceCheck - Error: please provide location id')
                return cb(err)
            } else cb(null)

        }, (cb) => { //Extract ingredients in gastro offers

            Location.findById(locationId)
                .exec((err, doc) => {
                    if (err) {
                        logger.error('selentaWebMPServiceCheck - Error: %j', err)
                        return cb(err)
                    }

                    if (!doc) {
                        logger.error('selentaWebMPServiceCheck - Error: Invalid location id!')
                        let err = new Error('Error: Invalid location id!')
                        return cb(err)
                    }

                    locName = doc.name;
                    logger.info('selentaWebMPServiceCheck - Successfully obtained location information for %s', locName);
                    cb(null)
                })

        }, (cb) => { //Extract ingredients in gastro offers

            GastroOffer.find({ location: { $in: [locationId] } })
                .exec((err, docs) => {
                    if (err) {
                        logger.error('selentaWebMPServiceCheck - Error: %j', err)
                        return cb(err)
                    }
                    if (!docs.length) {
                        let err = new Error('selentaWebMPServiceCheck - There are no gastro offers in specified location')
                        return cb(err)
                    }
                    gastros = docs;
                    logger.info('Found %s gastro offers', gastros.length)
                    console.log(gastros)
                    cb(null);
                })

        }, (cb) => { //Extract ingredients in gastro offers

            async.eachSeries(gastros, (gastro, cb_async) => {

                reportHelper.getGastroIngredients(gastro._id, userProfile, (err, doc) => {
                    if (err) {
                        logger.error('Error getting gastro ingredients for gastro %s', gastro._id)
                    }
                    if (doc && doc.length) ingredientList = ingredientList.concat(doc);
                    cb_async()
                })
            }, (err) => {
                if (err) return cb(err)
                ingredientList = utilsHelper.removeDuplicates(ingredientList);
                logger.info('Found %s ingredients', ingredientList.length)
                // ingredientList = ingredientList.map((ingredient)=>{ return ingredient._id})
                cb(null)
            })

        }, (cb) => { //Get list of provider articles associated with these ingredients that also include philosofia location

            async.eachSeries(ingredientList, (ingredient, cb_async) => {

                ProviderArticle.find({
                        location: { $in: [locationId] },
                        'category.kind': 'ingredient',
                        'category.item': ingredient._id
                    })
                    .exec((err, docs) => {
                        if (err) return cb_async(err)
                        if (docs.length) {
                            providerArticles = providerArticles.concat(docs)
                            ingredientsWithProviderArticles.push(ingredient)
                            ingredient.hasProviderArticles = true;
                        } else {
                            ingredientsWithoutProviderArticles.push(ingredient)
                            ingredient.hasProviderArticles = false;
                        }
                        cb_async()
                    })

            }, (err) => {
                if (err) return cb(err)
                logger.info('Found %s provider articles', providerArticles.length)
                logger.info('There were %s generic ingredients with provider articles', ingredientsWithProviderArticles.length)
                logger.info('There were %s generic ingredients without provider articles and using referencePrice', ingredientsWithoutProviderArticles.length)
                cb(null)
            })

        }, (cb) => {

            let providerArticlesId = providerArticles.map((article) => { return article._id })

            Selenta.find({
                    "article.cookDesignId": { $in: providerArticlesId },
                    "issue.type": { $nin: ["updatedArticle", "updatedAllergens"] }
                })
                .exec((err, docs) => {
                    if (err) return cb(err)
                    selentaLogs = docs;
                    erroneousArticleIds = docs.map((erroneousArticle) => { return erroneousArticle.article[0].cookDesignId })
                    erroneousCodes = docs.map((erroneousArticle) => { return erroneousArticle.article[0].MATNR })
                    cb(null)
                })

        }, (cb) => {

            ProviderArticle.find({
                    $or: [
                        { _id: { $in: erroneousArticleIds } },
                        { externalReference: { $in: erroneousCodes } }
                    ]
                })
                .exec((err, docs) => {
                    if (err) return cb(err)
                    logger.info('Found %s erroneous provider articles', docs.length)
                    erroneousArticles = docs;
                    cb(null)
                })

        }, (cb) => {

            erroneousArticles.forEach((erroneousArticle) => {

                let logMatch = selentaLogs.find((log) => {
                    return log.article[0].MATNR == erroneousArticle.externalReference
                })
                if (logMatch) erroneousArticle.issue = logMatch.issue.description
            })

            cb(null)


        }, (cb) => {

            erroneousArticles.forEach((erroneousArticle) => { //add firt recipe line with general information

                let articleLine = {
                    description: erroneousArticle.lang[0].description,
                    externalReference: erroneousArticle.externalReference,
                    issue: erroneousArticle.issue
                }
                articleLines.push(articleLine)
            })

            cb(null)

        }, (cb) => {

            ingredientList.forEach((ingredient) => { //add firt recipe line with general information

                let ingredientLine = {
                    name: ingredient.lang[0].name,
                    hasProviderArticles: ingredient.hasProviderArticles
                }
                ingredientLines.push(ingredientLine)
            })

            cb(null)


        }, (cb) => { //convert to CSV

            fields = ['description', 'externalReference', 'issue'];

            fieldNames = ['Descripción', 'Código SAP', 'Problema'];

            json2csv({ data: articleLines, fields: fields, fieldNames: fieldNames }, function(err, csv) {
                if (err) cb(err);
                fs.writeFile('/tmp/' + locName + '_erroneuous_articles_export.csv', csv, function(err) {
                    if (err) return cb(err);
                    cb(null)
                });
            });

        }, (cb) => { //convert to CSV

            fields = ['name', 'hasProviderArticles'];

            fieldNames = ['Nombre', 'Artículos de proveedor asociados'];

            json2csv({ data: ingredientLines, fields: fields, fieldNames: fieldNames }, function(err, csv) {
                if (err) cb(err);
                fs.writeFile('/tmp/' + locName + '_ingredient_export.csv', csv, function(err) {
                    if (err) return cb(err);
                    cb(null)
                });
            });


        }
    ], (err) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json('Saved files \'erroneuous_articles_export.cs\' and \'ingredient_export.csv\' for location ' + locName + ' in tmp folder').end();
    })

}


/* ------------------------------------------- ASSIGN CODE TO ALLERGENS -----------------------------------------------------------------*/

exports.assignAllergenCode = (req, res) => {

    var Allergen = require('../models/allergen')
    var allergens;

    var config = require('../config/config');
    var allergenCodes = config.allergenCodes;

    //Reference codes from CookDesign database.
    var allergenRefNumbers = [
        { type: 'glutenContainingGrains', code: '150201707191733470530' },
        { type: 'crustaceans', code: '150201707191733470548' },
        { type: 'egg', code: '150201707191733470544' },
        { type: 'fish', code: '150201707191733470523' },
        { type: 'peanut', code: '150201707191733470527' },
        { type: 'soy', code: '150201707191733470537' },
        { type: 'milkOrLactose', code: '150201707191733470557' },
        { type: 'edibleNuts', code: '150201707191733470566' },
        { type: 'celery', code: '150201707191733470563' },
        { type: 'mustard', code: '150201707191733470540' },
        { type: 'sesame', code: '150201707191733470534' },
        { type: 'sulphites', code: '150201707191733470554' },
        { type: 'lupines', code: '150201707191733470517' },
        { type: 'molluscs', code: '150201707191733470551' },
        { type: 'geneticallyModifiedFoods', code: '150201707191733470570' }
    ]

    async.waterfall([

        (cb) => {

            Allergen.find()
                .exec((err, docs) => {
                    if (err) return cb(err)
                    allergens = docs;
                    cb(null)
                })

        }, (cb) => {

            async.eachSeries(allergens, (allergen, cb_async) => {

                let allergenRef = allergenRefNumbers.find((allergenRef) => {
                    return allergenRef.code == allergen.referenceNumber
                })

                let allergenCode = allergenCodes.find((allergenCode) => {
                    return allergenCode.type == allergenRef.type
                })

                allergen.code = allergenCode.code;

                allergen.save((err) => {
                    if (err) return cb_async(err)
                    cb_async()
                })

            }, (err) => {
                if (err) return cb(err)
                cb(null)
            })


        }, (cb) => {

            Allergen.find()
                .exec((err, docs) => {
                    if (err) return cb(err)
                    allergens = docs;
                    cb(null)
                })

        }
    ], (err) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(allergens).end();
    })

}


/* ------------------------------------- REPLACE S3 BUCKET IN GALLERY DOCS ---------------------------------------------------------*/

exports.replaceS3BucketInGalleryDocs = async (req, res) => {
    let mongoose = require('../node_modules/mongoose');
    var params = req.query;
    var originalBucket = params.originalBucket;
    var newBucket = params.newBucket;
    let totalNumIngredient;
    let ingredientCount = 0;
    let Gallery = require('../models/gallery');
    let errorGalleries = [];

    try {

        if(!originalBucket || !newBucket) {
            let err = new Error('Missing params!');
            throw(err);
        }

        const totalNumGalleries = await Gallery.count({});
        logger.info('replaceS3BucketInGalleryDocs:: found %s galleries', totalNumGalleries);
    
        for(var galleryCount=0; galleryCount<totalNumGalleries; galleryCount++){
            
            const gallery = await Gallery.findOne().skip(galleryCount).limit(1);
    
            if (!gallery || !gallery.sizes) {
                logger.error('Could not find gallery or gallery does not have sizes array: %s', JSON.stringify(gallery));
                continue;
            }            

            logger.info('replaceS3BucketInGalleryDocs:: successfully retrieved gallery with id %s', gallery._id);
            logger.info('replaceS3BucketInGalleryDocs:: gallery includes %s sizes', gallery.sizes.length);
    
            for(var size of gallery.sizes){

                let bucketToUpdate = originalBucket;
                
                let indexof = size.url.indexOf(originalBucket);
        
                if (indexof < 0) {
                    let indexof2 = size.url.indexOf('cookdesign');
                    
                    if (indexof2 < 0) {
                        logger.error('replaceS3BucketInGalleryDocs:: could not find originalBucket in url: %s', size.url);
                        errorGalleries.push(gallery);
                        continue;
                    } else {
                        bucketToUpdate='cookdesign';
                    }
                }
        
                let newUrl = size.url.replace(bucketToUpdate, newBucket);
                logger.info('replaceS3BucketInGalleryDocs:: replaced %s for %s', size.url, newUrl);
                size.url = newUrl;     
                
            }
            await gallery.save();
            logger.info('replaceS3BucketInGalleryDocs:: successfully saved gallery');
        }

        logger.info('Found %s error galleries', errorGalleries.length);
        logger.info('%s', JSON.stringify(errorGalleries));
    
        res.status(200).json('replaceS3BucketInGalleryDocs:: finished successfully').end();

    } catch (err){
        res.status(500).json(err.message || 'Error').end();
    }
};


/* -------------------------------------DUPLICATE IN NEW DATABASE---------------------------------------------------------*/
/*   IMPORTANT!!!!!!!!!!!!:  This method is to be run locally on a database that is a copy of production.                 */
/*                            NEVER RUN ON THE PRODUCTION SERVER!!                                                        */

exports.duplicateInNewDatabaseIngredient = (req, res) => {
    let async = require('async');
    let Ingredient = require('../models/ingredient');
    let mongoose = require('../node_modules/mongoose');
    let totalNumIngredient;
    let ingredientCount = 0;
    let Gallery = require('../models/gallery');

    let AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;

    let destinationBucket = 'anson-bonet-prod'
    let originalBucket = 'cookdesign-prod/';
    let newIngredientsToSave = [];
    waterfall([
        (cb) => {

            if(process.env.NODE_ENV == 'production') {
                let err = new Error('Can not be executed in production');
                return cb(err);
            }

            logger.info('Removing quarterings')
            Ingredient.remove({ quartering: { $ne: null } }, (err, doc) => {
                if (err) logger.error('Error deleting quarterings');
                cb(null, true)
            })
        }, (docs, cb) => {
            logger.info('Starting duplicate gallery in new database')
            Ingredient.count({}, (err, count) => {
                if (err) return cb()
                totalNumIngredient = count;
                cb(null, true)
            })

        }, (docs, cb) => {
            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, ingredientCount < totalNumIngredient);
                },
                (callback) => {
                    Ingredient
                        .findOne({})
                        .skip(ingredientCount)
                        .limit(1)
                        .exec((err, doc) => {
                            if (err) return callback()
                            ingredientCount++
                            async.waterfall([
                                (cb_ingredient) => {
                                    console.log(ingredientCount, 'ingredientCount')
                                    let newIngredient = new Ingredient({
                                        gallery: doc.gallery,
                                        equivalenceQty: doc.equivalenceQty,
                                        active: doc.active,
                                        family: doc.family,
                                        subfamily: doc.subfamily,
                                        referencePrice: doc.referencePrice,
                                        averagePrice: doc.averagePrice,
                                        measurementUnit: doc.measurementUnit,
                                        referenceNumber: doc.referenceNumber,
                                        allergens: doc.allergens,
                                        temporality: doc.temporality,
                                        lang: doc.lang
                                    });

                                    newIngredientsToSave.push(newIngredient)

                                    cb_ingredient(null, newIngredient)

                                }, (ingredient, cb_ingredient) => {

                                    if (!ingredient.gallery) return callback()
                                    Gallery.findById(ingredient.gallery, (err, gallery) => {
                                        if (err) {
                                            logger.error('Error at find gallery: %s', ingredient.gallery);
                                            return callback(err)
                                        }
                                        if (!gallery && !gallery.sizes.length) {
                                            logger.error('Gallery not found: %s', ingredient.gallery);
                                            return callback()
                                        }
                                        let sizes = [];

                                        async.eachSeries(gallery.sizes, (size, cb_async) => {

                                            let indexof = size.url.indexOf(originalBucket)

                                            if (indexof < 0) {
                                                logger.error('originalBucket is not found: %s', size.url)
                                                return callback()
                                            }

                                            let key = size.url.slice(indexof + originalBucket.length)
                                            let newUrl = size.url.replace(originalBucket, destinationBucket + '/')

                                            var params = {
                                                Bucket: destinationBucket,
                                                CopySource: size.url,
                                                Key: key,
                                                ACL: 'public-read'
                                            };

                                            var s3 = new AWS.S3;

                                            s3.copyObject(params, function(err, data) {
                                                if (err) {
                                                    logger.error('Error at copy object to S3: %s', ingredient._id);
                                                    return cb_async();
                                                }
                                                sizes.push({
                                                    sizeCode: size.sizeCode,
                                                    url: newUrl
                                                });
                                                cb_async();

                                            });
                                        }, (err) => { // end cb_async
                                            gallery.sizes = sizes;
                                            gallery.save((err, ing) => {
                                                if (err) {
                                                    logger.error('Error saving gallery: %s', gallery._id);
                                                    return callback()
                                                };
                                                cb_ingredient(null);
                                            });
                                        })

                                    })
                                }
                            ], (ok) => { // end cb_ingredient                            	
                                callback()
                            })
                        })
                }, (err) => { // end callback
                    if (err) return cb(err)
                    cb(null, true)
                })
        }, (docs, cb) => {

            Ingredient.remove({}, (err, doc) => {
                if (err) logger.error('Error deleting ingredients');
                cb(null, true)
            })

            if (newIngredientsToSave.length) {
                ingredientsBulkWrite = newIngredientsToSave.map((ingredient) => {
                    return obj = {
                        insertOne: {
                            "document": ingredient
                        }
                    }
                })

                Ingredient.bulkWrite(ingredientsBulkWrite, (err, res) => {
                    if (err) return cb(err)
                    cb(null, true)
                })
            }
        }

    ], (err, ok) => { // end cb
        logger.info('Finish duplicate gallery in new database')
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/* -------------------------------------DUPLICATE IN NEW DATABASE ALLERGEN --------------------------------------------------------*/


exports.duplicateInNewDatabaseAllergen = (req, res) => {
    let async = require('async');
    let Allergen = require('../models/allergen');
    let mongoose = require('../node_modules/mongoose');
    let totalNumAllergen;
    let allergenCount = 0;
    let Gallery = require('../models/gallery');

    let AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;

    let destinationBucket = 'anson-bonet-prod'
    let originalBucket = 'cookdesign/';

    waterfall([
        (cb) => {
            logger.info('Starting duplicate gallery in new database')
            Allergen.count({}, (err, count) => {
                if (err) return cb()
                totalNumAllergen = count;
                cb(null, true)
            })
        }, (docs, cb) => {
            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, allergenCount < totalNumAllergen);
                },
                (callback) => {
                    Allergen
                        .findOne({})
                        .skip(allergenCount)
                        .limit(1)
                        .exec((err, allergen) => {
                            if (err) {
                                logger.error('Error at findOne: %s');
                                return callback()
                            }
                            allergenCount++
                            async.waterfall([
                                (cb_allergen) => {

                                    Gallery.findById(allergen.gallery, (err, gallery) => {
                                        if (err) {
                                            logger.error('Error at find gallery: %s', allergen.gallery);
                                            return callback(err)
                                        }
                                        if (!gallery || !gallery.sizes.length) {
                                            logger.error('Gallery not found: %s, skip', allergen.gallery);
                                            return callback()
                                        }

                                        let sizes = [];

                                        async.eachSeries(gallery.sizes, (size, cb_async) => {

                                            let indexof = size.url.indexOf(originalBucket)
                                            if (indexof < 0) {
                                                logger.error('originalBucket is not found: %s', size.url)
                                                return callback()
                                            }
                                            let key = size.url.slice(indexof + originalBucket.length)
                                            let newUrl = size.url.replace(originalBucket, destinationBucket + '/')

                                            var params = {
                                                Bucket: destinationBucket,
                                                CopySource: size.url,
                                                Key: key,
                                                ACL: 'public-read'
                                            };

                                            var s3 = new AWS.S3;

                                            s3.copyObject(params, function(err, data) {
                                                if (err) {
                                                    logger.error('Error at copy object to S3: %s', allergen._id);
                                                    return cb_async();
                                                }
                                                sizes.push({
                                                    sizeCode: size.sizeCode,
                                                    url: newUrl
                                                });
                                                cb_async();

                                            });
                                        }, (err) => { // end cb_async
                                            gallery.sizes = sizes;
                                            gallery.save((err, ing) => {
                                                if (err) {
                                                    logger.error('Error saving gallery: %s', gallery._id);
                                                    return callback()
                                                };
                                                cb_allergen(null);
                                            });
                                        })
                                    })
                                }
                            ], (ok) => { // end cb_allergen                             
                                callback()
                            })
                        })
                }, (err) => { // end callback
                    if (err) return cb(err)
                    cb(null, true)
                })
        }
    ], (err, ok) => { // end cb
        logger.info('Finish duplicate gallery in new database')
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/* -------------------------------------DUPLICATE IN NEW DATABASE UTENSIL ---------------------------------------------------------*/

exports.duplicateInNewDatabaseUtensil = (req, res) => {
    let async = require('async');
    let Utensil = require('../models/utensil');
    let mongoose = require('../node_modules/mongoose');
    let totalNumUtensil;
    let utensilCount = 0;
    let Gallery = require('../models/gallery');

    let AWS = require('aws-sdk');

    AWS.config.accessKeyId = config.awsBucket.accessKey;
    AWS.config.secretAccessKey = config.awsBucket.secret;
    AWS.config.region = config.awsBucket.region;

    let destinationBucket = 'anson-bonet-prod'
    let originalBucket = 'cookdesign/';

    waterfall([
        (cb) => {
            logger.info('Starting duplicate gallery in new database')
            Utensil.count({}, (err, count) => {
                if (err) return cb()
                totalNumUtensil = count;
                cb(null, true)
            })
        }, (docs, cb) => {
            async.during(
                (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                    return callback(null, utensilCount < totalNumUtensil);
                },
                (callback) => {
                    Utensil
                        .findOne({})
                        .skip(utensilCount)
                        .limit(1)
                        .exec((err, utensil) => {
                            if (err) {
                                logger.error('Error at findOne: %s');
                                return callback()
                            }
                            utensilCount++
                            async.waterfall([
                                (cb_utensil) => {
                                    console.log(utensilCount)
                                    Gallery.findById(utensil.gallery, (err, gallery) => {
                                        if (err) {
                                            logger.error('Error at find gallery: %s', utensil.gallery);
                                            return callback(err)
                                        }
                                        if (!gallery || !gallery.sizes.length) {
                                            logger.error('Gallery not found: %s, skip', utensil.gallery);
                                            return callback()
                                        }

                                        let sizes = [];

                                        async.eachSeries(gallery.sizes, (size, cb_async) => {

                                            let indexof = size.url.indexOf(originalBucket)
                                            if (indexof < 0) {
                                                logger.error('originalBucket is not found: %s', size.url)
                                                return callback()
                                            }
                                            let key = size.url.slice(indexof + originalBucket.length)
                                            let newUrl = size.url.replace(originalBucket, destinationBucket + '/')

                                            var params = {
                                                Bucket: destinationBucket,
                                                CopySource: size.url,
                                                Key: key,
                                                ACL: 'public-read'
                                            };

                                            var s3 = new AWS.S3;

                                            s3.copyObject(params, function(err, data) {
                                                if (err) {
                                                    logger.error('Error at copy object to S3: %s', utensil._id);
                                                    return cb_async();
                                                }
                                                sizes.push({
                                                    sizeCode: size.sizeCode,
                                                    url: newUrl
                                                });
                                                cb_async();

                                            });
                                        }, (err) => { // end cb_async
                                            gallery.sizes = sizes;
                                            gallery.save((err, ing) => {
                                                if (err) {
                                                    logger.error('Error saving gallery: %s', gallery._id);
                                                    return callback()
                                                };
                                                cb_utensil(null);
                                            });
                                        })
                                    })
                                }
                            ], (ok) => { // end cb_utensil                            	
                                callback()
                            })
                        })
                }, (err) => { // end callback
                    if (err) return cb(err)
                    cb(null, true)
                })
        }
    ], (err, ok) => { // end cb
        logger.info('Finish duplicate gallery in new database')
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/* -------------------------------REMOVE ERRONEOUS COMPOSITION ITEMS IN RECIPE COMPOSITION ---------------------------------------------------------------*/

exports.removeErroneousCompItemsInRecipe = (req,res)=> {

	    var params = req.query;
    	var recipeId = params.recipeId;
	    var Subproduct = require('../models/subproduct');
	    var Product = require('../models/product');
	    var Dish = require('../models/dish');
	    var Drink = require('../models/drinks');
	    var Models = [Subproduct, Product, Dish, Drink]
	    let erroneousRecipe = false;
	    let recipe;

    	if(!recipeId || !mongoose.Types.ObjectId.isValid(recipeId)) {
    		return res.status(500).json('Must provide a valid recipeId').end(); 
    	}

	    logger.info('Entering method to remove erroneous composition item from recipe...')

	    async.eachSeries(Models, (Model, cb_async) => {

   		    let recipeType;

					if (Model == Dish) recipeType='dish'
		      if (Model == Drink) recipeType='drink'
		      if (Model == Product) recipeType='product'
		      if (Model == Subproduct) recipeType='subproduct'	    	

	        waterfall([
	            (cb) => {

	            	Model.findById(recipeId, (err, doc) => {
	            		if(err) return cb(err)
	            		if(!doc) {
	            			logger.info('Could not find %s, move on...', recipeType);
	            			return cb(true)
	            		}
					        logger.info('Found %s', recipeType)
					        recipe=doc;
	            		cb(null, doc)
	            	})

	            }, (doc, cb) => {

	            		doc.versions.forEach((version) => {

	  									logger.info('Evaluating version %s', version._id)
	  									let erroneousCompElementIds = [];
	            				version.composition.forEach((compElement, index) => {
	            					if(!compElement.element.item) {
	            						logger.info('Found composition item null in %s', recipeType)
	            						erroneousCompElementIds.push(compElement)
	            						erroneousRecipe=true;
	            					}
	            				})

	            				if(erroneousCompElementIds.length){

	            					erroneousCompElementIds.forEach((compElement) =>{
	            							let index = version.composition.indexOf(compElement)
	            							logger.info('Found error in compElementId: %s in position %s', compElement._id, index)
	            							if (index > -1) { version.composition.splice(index, 1); }
	            					})

	            					logger.info('Successfully removed errouneous composition elements!')
	            				}

	            		})
			            cb(null, doc)

	            }], (err, doc) => { //Finish waterfall
	            		if(err) {
	            			if(err==true) cb_async()
	            			else return cb_async(err)
	            		}
	            		else
	            		{
	            			cb_async()
	            		}
	            })

	     }, (err) => { //Finish async loop
	        if (err) return res.status(500).json(err.message || 'Error').end();

	        if(erroneousRecipe){
	        	recipe.save((err, doc) => {
	        		if(err){
	        			logger.error('Error saving updated recipe')
	        			let err = new Error('Error saving updated recipe')
	        			return res.status(500).json(err).end();
	        		}
	        		else
	        		{
				        logger.info('Finished method to remove erroneous composition item from recipe. Found errors and updated recipe')
	        			res.status(200).json('Finished method to remove erroneous composition item from recipe. Found errors and updated recipe').end();
	        		}
	        	})
	        }
	        else
	        {
		        logger.info('Finished method to remove erroneous composition item from recipe. No errors found in recipe')
	        	res.status(200).json('Finished method to remove erroneous composition item from recipe. No errors found in recipe').end();
	        }

	     })
}


/* ------------------------------- REPLACE COMPOSITION ELEMENT IN ALL RECIPES THAT INCLUDE IT ---------------------------------------------------------------*/

// Replaces a composition element in all recipes that include it for a new element. 
// It is assumed that the old and new compotion elements have the same measurement unit, as well as all the other elements (grossWeight, etc) except unit cost.
// Does not take into consideration location allergens!!
// Eg. replace sal marina (5835b74695d85e68ef9684ce) for sal fina (58416c0e6245877068a324b1) in all recipes that contain sal marina.

exports.replaceCompElementInRecipes = (req,res)=> {

  var params = req.query;
	var oldCompElementId = params.oldCompElementId;
	var oldId = new ObjectId(oldCompElementId)
	var newCompElementId = params.newCompElementId;
  var Subproduct = require('../models/subproduct');
  var Product = require('../models/product');
  var Dish = require('../models/dish');
  var Drink = require('../models/drinks');
  var Ingredient = require('../models/ingredient');
  var costHelper = require('../helpers/cost');
  var Models = [Subproduct, Product, Dish, Drink]
  var subproducts = [];
  var drinks = [];
  var dishes = [];
  var products = [];
  var oldCompElement;
  var newCompElement;

  //2. Find all recipes which active version include the old composition element.
  //3- Replace the old composition element with the new composition element and update unit cost and location cost.
  //4- Recalculate the recipe location cost.
  //5. Save recipes in bulk.
	
	logger.info('Entering method to replace composition element in recipes...')
	logger.info('oldCompElementId: %s', oldCompElementId)
	logger.info('newCompElementId: %s', newCompElementId)

  waterfall([
      (cb) => { //1. Verify that the old recipe Id and new recipe Id are correct and exist.

	    	if(!oldCompElementId || !mongoose.Types.ObjectId.isValid(oldCompElementId)) {
	    		let err = new Error('Must provide a valid oldCompElementId')
	    		return cb(err)
	    	}

	    	if(!newCompElementId || !mongoose.Types.ObjectId.isValid(newCompElementId)) {
	    		let err = new Error('Must provide a valid newCompElementId')
	    		return cb(err)
	    	}

      	cb(null)

      }, (cb) => { //Get new composition element. Only Ingredient case is implemented!!!

      	Ingredient.findById(oldCompElementId, (err, doc) => {
      		if(err) {
      			logger.error('Error retrieving old composition element from database!')
      			logger.error(err)
      			return cb(err)
      		}
      		else
      		{
      			if(!doc) {
      				logger.error('Could not find oldCompElementId in database!')
      				let err = new Error('Could not find oldCompElementId in database!')
      				return cb(err);
      			}
      			else
      			{
      				logger.info('Successfully retrieved old composition element from database')
      				logger.info('lang: %j', doc.lang)
      				logger.info('referencePrice: %j', doc.referencePrice)
      				logger.info('locationCost: %j', doc.locationCost)
      				oldCompElement = doc;
      				cb(null)
      			}
      		}
      	})

      }, (cb) => { //Get new composition element. Only Ingredient case is implemented!!!

      	Ingredient.findById(newCompElementId, (err, doc) => {
      		if(err) {
      			logger.error('Error retrieving new composition element from database!')
      			logger.error(err)
      			return cb(err)
      		}
      		else
      		{
      			if(!doc) {
      				logger.error('Could not find newCompElementId in database!')
      				let err = new Error('Could not find newCompElementId in database!')
      				return cb(err);
      			}
      			else
      			{
      				logger.info('Successfully retrieved new composition element from database')
      				logger.info('lang: %j', doc.lang)
      				logger.info('referencePrice: %j', doc.referencePrice)
      				logger.info('locationCost: %j', doc.locationCost)
      				newCompElement = doc;
      				cb(null)
      			}
      		}
      	})

      }, (cb) => {

				    async.eachSeries(Models, (Model, cb_async) => {

			   		    let recipeType;

					      if (Model == Subproduct) {recipeType='subproduct'; logger.info('Evaluating subproducts...')}
					      if (Model == Product) {recipeType='product'; logger.info('Evaluating products...')}
								if (Model == Dish) {recipeType='dish'; logger.info('Evaluating dishes...')}
					      if (Model == Drink) {recipeType='drink'; logger.info('Evaluating drinks...')}

	      	      Model.find(
						      { "versions.composition.element.item": oldCompElementId }
					    	).exec((err, recipes) => {

					    		 	if(err) {
					    		 		logger.error(err);
					    		 		return cb_async(err);
					    		 	}
					    		 	else
					    		 	{
						    			if(recipes && recipes.length) {

												if (recipeType=='dish') {
													logger.info('Found %s dishes that include old composition element', recipes.length)
													dishes = dishes.concat(recipes);
												}

									      if (recipeType=='drink') {
									      	logger.info('Found %s drinks that include old composition element', recipes.length)
													drinks = drinks.concat(recipes);
												}

									      if (recipeType=='product') {
									      	logger.info('Found %s products that include old composition element', recipes.length)
													products = products.concat(recipes);
									      }

									      if (recipeType=='subproduct') {
									      	logger.info('Found %s subproducts that include old composition element', recipes.length)
													subproduct = subproducts.concat(recipes);
									      }

									      //Replace composition element in active version

									      async.eachSeries(recipes, (recipe, cb_async_2) => {

									      		logger.info('*******>>>> Evaluating recipe >>>>>*************')

									      	  let activeVersion = recipe.versions.find((x) => {return x.active})

									      	  if(activeVersion) {

									      	  		let compElement = activeVersion.composition.find((x) => {
									      	  			let id = new ObjectId(x.element.item);
									      	  			return id.equals(oldId)
									      	  		})

									      	  		if(compElement) {

										      	  			logger.info('Found old composition element in active version of recipe with id %s.', compElement._id);
										      	  			logger.info('Current activeVersion lang: %j', activeVersion.lang)
										      	  			//Update composition element
										      	  			logger.info('Current composition element location cost: %j', compElement.locationCost)
										      	  			logger.info('Current composition element unit cost: %j', compElement.unitCost)
										      	  			logger.info('Current active version location cost: %j', activeVersion.locationCost)

										      	  			logger.info('Replacing data....');

										      	  			compElement.element.item = new ObjectId(newCompElement._id);
										      	  			compElement.locationCost = newCompElement.locationCost;
										      	  			compElement.unitCost = newCompElement.referencePrice;

										      	  			// logger.info('Updated activeVersion: %j', activeVersion);

										      	  			logger.info('Recalculating active version location costs...');
												            //Calculate dish composition reference and location cost for aggregate locations in composition list
												            costHelper.calculateRecipeCompLocationCosts(activeVersion, recipe.location, Model, (err, res) => {
												                if (err) return cb_async_2(err);

												                logger.info('Finished calculating new location costs.')
												                logger.info('locationCost: %j', res.locationCost)
												                
												                activeVersion.locationCost = res.locationCost;
												                
												                if(recipeType=='dish' || recipeType=='drink') {
												                	activeVersion.costPerServing = res.costPerServing;
												                	logger.info('costPerServing: %s', res.costPerServing)
												                }
												                
												                if(recipeType=='subproduct' || recipeType=='product'){
												                	activeVersion.unitCost = res.unitCost;
												                	logger.info('unitCost: %s', res.unitCost)
												                }

												                logger.info('Finished updating costs...');

												                // logger.info('Saved recipe...')
												                // cb_async_2();

												                //Save recipe...
												                recipe.save((err, doc) =>{
												                	if(err) {
												                		logger.error('Error saving recipe...')
												                		logger.error(err)
												                		return cb_async_2(err);
												                	}
												                	logger.info('Saved recipe successfully...')
												                	cb_async_2();
												                })
												                
												            })

									      	  		}
									      	  		else 
									      	  		{
									      	  			logger.info('Active version of recipe does not contain old composition element, move on!')
									      	  			cb_async_2();
									      	  		}
									      	  }
									      	  else
									      	  {
									      	  	logger.error('Could not find active version in recipe!')
									      	  	cb_async_2();
									      	  }
									      }, (err) => {
									      	if(err) return cb_async(err)
									      	cb_async();
									      })

						    			}
						    			else
						    			{

												if (recipeType=='dish') logger.info('Found no dishes that include old composition element')
									      if (recipeType=='drink') logger.info('Found no drinks that include old composition element')
									      if (recipeType=='product') logger.info('Found no products that include old composition element')
									      if (recipeType=='subproduct') logger.info('Found no subproducts that include old composition element')
									      cb_async();
						    			}
					    		 	}
					    	})

	     			}, (err) => { //Finish async loop
	     					if(err) {
	     						logger.error(err)
	     						return cb(err)
	     					}
	     					else
	     					{
	      					cb(null)
      					}
	     			})

      }, (cb) => { //Save recipes

      	async.eachSeries(Models, (Model, cb_async) => {

		  		cb_async();


	      }, (err) => { 
	      	if(err) {
	      		logger.error(err)
	      		return cb(err)
	      	}
      		cb(null)
	      })


      }], (err) => { //Finish waterfall
      		
      	if (err) {
      		logger.error('Error executing replaceCompElementInRecipe method: %s', err.message)
      		return res.status(500).json(err.message || 'Error').end();
      	}
      	else
      	{
	        res.status(200).json('Finished method to replace composition element in recipes successfully!').end();
      	}
      })
}


/* ----------------------------------------------------------------------------------------------------------------------------------*/


exports.exportFamiliesWithLocsAndGastroOffers = (req,res)=>{

    var async = require('async');
    var Family = require('../models/family');
    var utilsHelper = require('../helpers/utils')
    var GastroOffer = require('../models/gastroOffer');
    var Location = require('../models/location');
    var json2csv = require('json2csv');
    var fs = require('fs');
    var userProfile = req.userData;
    var families = []
    var familiesIds = [];
    var gastroOffers = [];
    var arrayOfEachFamilyInGastroOffer = [];
    var arrayOfFamilies = []

    async.waterfall([

        (cb)=>{

            Family.find({
              $and:[
                {"location":{$nin:[]}},
                {$or:[
                  {"category":'season'},
                  {"category":'type'},
                  {"category":'gastroOffering'},
                  {"category":'menu'}
                ]}
            ]},(err,docs)=>{
              if(err) return cb(err)
              if(docs){
                families = docs;
                familiesIds = docs.map((doc)=>{ return doc._id });
                cb(null,docs)
              } else {
                return cb(true)
              }

            })

            
        },(docs,cb)=>{
          //console.log('FAMILIES_IDS: ',familiesIds)
          GastroOffer.find({'active':true})
                     .populate('location versions.type versions.season')
                     .exec((err,docs)=>{
                       if(err) return cb(err)
                       if(docs){
                         docs.forEach((doc)=>{
                           doc.versions.map((version)=>{
                             if(version.active == true){
                               return doc.versions = version;
                             }
                           })
                         })
                         gastroOffers = docs.filter((doc)=>{
                          if(doc.location.length > 0) return doc;
                         });
                         console.log('gastroOffers with families with location: ',gastroOffers.length);
                         cb(null,gastroOffers)
                       }
                     })

        },(docs,cb)=>{

          async.eachOfSeries(gastroOffers,function(gastro,index,cb_async){

            console.log('index: ',index);
            console.log('gastroOffer: ',gastro.versions[0].lang[0].name)

            let object = {
                family: {},
                from:'',
                type: '',
                gastroOffer: '',
                locs: []
            }

            if(gastro.versions[0].type){
                console.log('type: ',gastro.versions[0].type.lang[0].name);
                let isTypeInFamiliesIDs = families.filter((fam)=>{ 
                  let famId = new ObjectId(fam._id);
                  let gastroTypeId = new ObjectId(gastro.versions[0].type._id);
                  //console.log('  fam_ID: ',famId);
                  //console.log('type._id: ',gastroTypeId);
                  if(famId.equals(gastroTypeId)){
                    //console.log('familyType: ',gastro.versions[0].type)
                    return fam;
                  }
                });
                
                if(isTypeInFamiliesIDs && isTypeInFamiliesIDs.length > 0){
                  //console.log('there are isTypeInFamiliesIDs value: ',isTypeInFamiliesIDs[0].lang[0].name);
                  object.family = isTypeInFamiliesIDs[0];
                  object.from = 'type';
                  object.type = gastro.type;
                  object.gastroOffer = gastro.versions[0];
                  if(gastro.location.length > 0){
                    gastro.location.forEach((loc)=>{
                      object.locs.push(loc.name);
                    })
                  }
                  //object.locs = object.locs.concat(gastro.location);
                  arrayOfEachFamilyInGastroOffer.push(object);

                  object = {
                      family: {},
                      from:'',
                      type:'',
                      gastroOffer: '',
                      locs: []
                  }

                } else {
                  //console.log('NO MATCH TYPE!');
                }

            }

            if(gastro.versions[0].season){
                console.log('season: ',gastro.versions[0].season.lang[0].name);
                let isSeasonInFamiliesIDs = families.filter((fam)=>{ 
                  let famId = new ObjectId(fam._id);
                  let gastroSeasonId = new ObjectId(gastro.versions[0].season._id);
                  //console.log('  fam_ID: ',famId);
                  //console.log('type._id: ',gastroTypeId);
                  if(famId.equals(gastroSeasonId)){
                    //console.log('familyType: ',gastro.versions[0].type)
                    return fam;
                  }
                });

                if(isSeasonInFamiliesIDs && isSeasonInFamiliesIDs.length > 0){
                  //console.log('there are isSeasonInFamiliesIDs value: ',isSeasonInFamiliesIDs[0].lang[0].name);
                  object.family = isSeasonInFamiliesIDs[0];
                  object.from = 'season';
                  object.type = gastro.type;
                  object.gastroOffer = gastro.versions[0];
                  if(gastro.location.length > 0){
                    gastro.location.forEach((loc)=>{
                      object.locs.push(loc.name);
                    })
                  }
                  arrayOfEachFamilyInGastroOffer.push(object);

                  object = {
                      family: {},
                      from:'',
                      type:'',
                      gastroOffer: '',
                      locs: []
                  }

                } else {
                  //console.log('NO MATCH SEASON!');
                }

            }

            //console.log('compositionLength: ',doc.versions.composition);
            if(gastro.versions[0].composition && gastro.versions[0].composition.length > 1){
                 console.log('compositionFamily: ',gastro.versions[0].composition.length);
                gastro.versions[0].composition.forEach((composition)=>{

                    if(composition.family){

                      let isCompoistionFamilyInFamiliesIDs = families.filter((fam)=>{ 
                        let famId = new ObjectId(fam._id);
                        let gastroCompFamilyId = new ObjectId(composition.family);
                        //console.log('  fam_ID: ',famId);
                        //console.log('type._id: ',gastroTypeId);
                        if(famId.equals(gastroCompFamilyId)){
                          //console.log('familyType: ',gastro.versions[0].type)
                          return fam;
                        }
                      });

                      if(isCompoistionFamilyInFamiliesIDs && isCompoistionFamilyInFamiliesIDs.length > 0){
                        //console.log('there are isCompoistionFamilyInFamiliesIDs value when have compositionArray: ',isCompoistionFamilyInFamiliesIDs[0].lang[0].name);
                        object.family = isCompoistionFamilyInFamiliesIDs[0];
                        object.from = 'structure';
                        object.type = gastro.type;
                        object.gastroOffer = gastro.versions[0];
                        if(gastro.location.length > 0){
                          gastro.location.forEach((loc)=>{

                            object.locs.push(loc.name);
                          })
                        }
                        arrayOfEachFamilyInGastroOffer.push(object);

                        object = {
                            family: {},
                            from:'',
                            type:'',
                            gastroOffer: '',
                            locs: []
                        }

                      } else {
                        //console.log('NO MATCH COMPOSITION FAMILY');
                      }

                    } 

                })

            } else if(gastro.versions[0].composition && gastro.versions[0].composition.length > 0){
                //console.log('compositionFamily: ',gastro.versions[0].composition.length);
                let isCompoistionFamilyInFamiliesIDs = families.filter((fam)=>{ 
                  let famId = new ObjectId(fam._id);
                  let gastroCompFamilyId = new ObjectId(gastro.versions[0].composition[0].family);
                  //console.log('  fam_ID: ',famId);
                  //console.log('type._id: ',gastroTypeId);
                  if(famId.equals(gastroCompFamilyId)){
                    //console.log('familyType: ',gastro.versions[0].type)
                    return fam;
                  }
                });

                if(isCompoistionFamilyInFamiliesIDs && isCompoistionFamilyInFamiliesIDs.length > 0){
                  //console.log('there are isCompoistionFamilyInFamiliesIDs value when have one composition element: ',isCompoistionFamilyInFamiliesIDs[0].lang[0].name);
                  object.family = isCompoistionFamilyInFamiliesIDs[0];
                  object.from = 'structure';
                  object.type = gastro.type;
                  object.gastroOffer = gastro.versions[0];
                  if(gastro.location.length > 0){
                    gastro.location.forEach((loc)=>{
                      object.locs.push(loc.name);
                    })
                  }
                  arrayOfEachFamilyInGastroOffer.push(object);

                  object = {
                      family: {},
                      from:'',
                      type:'',
                      gastroOffer: '',
                      locs: []
                  }

                } else {
                  //console.log('NO MATCH COMPOSITION FAMILY');
                }
                
            }

            cb_async();

          },(err,docs)=>{
            if(err) return cb(err)
            console.log('gastroOffers with families with location: ',arrayOfEachFamilyInGastroOffer);
            cb(null,arrayOfEachFamilyInGastroOffer)            
          })

        },(docs,cb)=>{
          console.log('arrayOfAllFamiliesInGastroOffers.LENGTH : ',arrayOfEachFamilyInGastroOffer.length);
          arrayOfEachFamilyInGastroOffer = removeDuplicates(arrayOfEachFamilyInGastroOffer);
          //console.log('arrayOfAllFamiliesInGastroOffers.LENGTH AFTER: ',arrayOfEachFamilyInGastroOffer.length);
          families.forEach((family)=>{
            sameFamily = arrayOfEachFamilyInGastroOffer.filter((fam)=>{ 
              let famId = new ObjectId(fam.family._id);
              let familyId = new ObjectId(family._id);
              return famId.equals(familyId)
            })

            if(sameFamily && sameFamily.length > 0){
              //console.log('sameFamily: ',sameFamily);
              let familyObject = {
                family: '',
                from:'',
                type:'',
                gastroOffers: [],
                locations:[]
              }

              familyObject.family = sameFamily[0].family.lang[0].name;
              familyObject.from = sameFamily[0].from;
              familyObject.type = sameFamily[0].type[0];

              sameFamily.forEach((family)=>{
                familyObject.gastroOffers.push(family.gastroOffer.lang[0].name);
                familyObject.locations = familyObject.locations.concat(family.locs);
              })

              familyObject.locations = removeDuplicatesLocs(familyObject.locations);
              arrayOfFamilies.push(familyObject);
            }
          })
            
          console.log('arrayOfFamilies: ',arrayOfFamilies);
          cb(null,arrayOfFamilies);

        },(docs,cb)=>{

          var fields = ['family', 'type','from','gastroOffers', 'locations'];

          var fieldNames = ['Familia', 'Tipo' , 'Proviene de ','Ofertas Gastronómicas', 'Localizaciones'];

          json2csv({ data: arrayOfFamilies, fields: fields, fieldNames: fieldNames}, function(err, csv) {
            if (err) cb(err);
            fs.writeFile('/tmp/family_by_locs_and_gastro_offers.csv', csv, function(err) {
              if (err) return cb(err);
              logger.info('Create csv file: /tmp/family_by_locs_and_gastro_offers.csv')
              cb(null, docs)
            });       
          });

    }],(err,ok)=>{
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json('Export \'family_by_locs_and_gastro_offers.csv\' in tmp folder').end();
    })
}

var removeDuplicates = (arr) => {
  //console.log(arr,'arr')
  // console.log(arr.length,'arr2')
  var i,j,cur,cur1,cur2,cur3,found;
  for(i=arr.length-1;i>=0;i--){
    cur = new ObjectId(arr[i].family._id);
    cur1 = new ObjectId(arr[i].gastroOffer._id);
    cur2 = arr[i].type;
    cur3 = arr[i].from;
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= new ObjectId(arr[j].family._id);
      let id1 = new ObjectId(arr[j].gastroOffer._id)
      let id2 = arr[j].type;
      let id3 = arr[j].from;
      if(cur.equals(id) && cur1.equals(id1) && cur2 == id2 && cur3 == id3){
        if(i!=j){
          arr.splice(i,1);
        }
        found=true;
      }
    }
  }
  return arr;
}

var removeDuplicatesLocs = (arr) => {
  //console.log(arr,'arr')
  // console.log(arr.length,'arr2')
  var i,j,cur,found;
  for(i=arr.length-1;i>=0;i--){
    cur = arr[i];
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= arr[j];
      if(cur == id){
        if(i!=j){
          arr.splice(i,1);
        }
        found=true;
      }
    }
  }
  return arr;
}

/*
// exports.exportFamilyRecipeWithLocsAndDishesAndDrinks = (req,res)=>{

//     var async = require('async');
//     var Family = require('../models/family');
//     var utilsHelper = require('../helpers/utils')
//     var Dish = require('../models/dish');
//     var Drink = require('../models/drinks');
//     var Subproduct = require('../models/subproduct');
//     var Product = require('../models/product');
//     var Location = require('../models/location');
//     var json2csv = require('json2csv');
//     var fs = require('fs');
//     var userProfile = req.userData;
//     var families = []
//     var familiesIds = [];
//     var dishesAndDrinksAndSubpAndProd = [];
//     var arrayOfFamilyInRecipes = [];
//     var arrayOfFamilies = []
//     let arrayCount = 0;

//     async.waterfall([

//         (cb)=>{

//             Family.find({
//               $and:[
//                 {"location":{$nin:[]}},
//                 {"category":'recipe'}
//             ]},(err,docs)=>{
//               if(err) return cb(err)
//               if(docs){
//                 families = docs;
//                 familiesIds = docs.map((doc)=>{ return doc._id });
//                 cb(null,docs)
//               } else {
//                 return cb(true)
//               }

//             })

            
//         },(docs,cb)=>{

//           async.eachSeries(families,function(family,cb_async){

//             async.waterfall([

//               (cbFam)=>{

//                 Dish.find({$and:[
//                             {'family': family._id},
//                             {'active':true}
//                           ]})
//                     .populate('location family')
//                     .exec((err,docs)=>{
//                       if(err) return cbFam(err)
//                       if(docs){
                       
//                         docs.forEach((doc)=>{
//                           doc.type = 'dish';
//                           doc.versions.map((version)=>{
//                             if(version.active == true){
//                               return doc.versions = version;
//                             }
//                           })
//                         })
//                         dishesAndDrinksAndSubpAndProd = docs.filter((doc)=>{
//                          if(doc.location.length > 0) return doc;
//                         });
//                         console.log('dishes with families with location: ',docs.length);
//                         //console.log('dishes with families with location: ',dishesAndDrinksAndSubpAndProd.length);
//                         cbFam(null,dishesAndDrinksAndSubpAndProd)
//                       }
//                     })

//               },(doc,cbFam)=>{

//                 Drink.find({$and:[
//                             {'family': family._id},
//                             {'active':true}
//                           ]})
//                      .populate('location family')
//                      .exec((err,docs)=>{
//                        if(err) return cbFam(err)
//                        if(docs){
//                          docs.forEach((doc)=>{
//                            doc.type = 'drink';
//                            doc.versions.map((version)=>{
//                              if(version.active == true){
//                                return doc.versions = version;
//                              }
//                            })
//                          })
//                          let drinks = docs.filter((doc)=>{
//                           if(doc.location.length > 0) return doc;
//                          });
//                          //console.log('drinks: ',docs);
//                          dishesAndDrinksAndSubpAndProd = dishesAndDrinksAndSubpAndProd.concat(drinks)
//                          console.log('drinks with families with location: ',drinks.length);
//                          //console.log('drinks with families with location: ',dishesAndDrinksAndSubpAndProd.length);
//                          cbFam(null,dishesAndDrinksAndSubpAndProd)
//                        }
//                     })

//               },(doc,cbFam)=>{

//                 Product.find({$and:[
//                             {'family': family._id},
//                             {'active':true}
//                           ]})
//                      .populate('location family')
//                      .exec((err,docs)=>{
//                        if(err) return cbFam(err)
//                        if(docs){
//                          docs.forEach((doc)=>{
//                            doc.type = 'product';
//                            doc.versions.map((version)=>{
//                              if(version.active == true){
//                                return doc.versions = version;
//                              }
//                            })
//                          })
//                          let products = docs.filter((doc)=>{
//                           if(doc.location.length > 0) return doc;
//                          });
//                          //console.log('products: ',docs.length);
//                          dishesAndDrinksAndSubpAndProd = dishesAndDrinksAndSubpAndProd.concat(docs)
//                          console.log('products with families with location: ',products.length);
//                          //console.log('dihes with families with location: ',dishesAndDrinks.length);
//                          cbFam(null,dishesAndDrinksAndSubpAndProd)
//                        }
//                     })

//               },(doc,cbFam)=>{

//                 Subproduct.find({$and:[
//                             {'family': family._id},
//                             {'active':true}
//                           ]})
//                      .populate('location family')
//                      .exec((err,docs)=>{
//                        if(err) return cbFam(err)
//                        if(docs){
//                          docs.forEach((doc)=>{
//                            doc.type = 'subproduct';
//                            doc.versions.map((version)=>{
//                              if(version.active == true){
//                                return doc.versions = version;
//                              }
//                            })
//                          })
//                          let subproducts = docs.filter((doc)=>{
//                           if(doc.location.length > 0) return doc;
//                          });
//                          //console.log(': ',docs);
//                          dishesAndDrinksAndSubpAndProd = dishesAndDrinksAndSubpAndProd.concat(subproducts)
//                          console.log('subproducts with families with location: ',subproducts.length);
//                          //console.log('subproducts with families with location: ',dishesAndDrinks.length);
//                          cbFam(null,dishesAndDrinksAndSubpAndProd)
//                        }
//                     })

//               },(doc,cbFam)=>{

//                 let object = {
//                     family: '',
//                     dishes: [],
//                     drinks: [],
//                     subproducts:[],
//                     products:[],
//                     locs: []
//                 }

//                 async.eachOfSeries(dishesAndDrinksAndSubpAndProd,function(dishOrDrinkOrSubOrProd,index,cb_async2){

//                   console.log('index: ',index);
//                   console.log('dish or drink: ',dishOrDrinkOrSubOrProd.versions[0].lang[0].name)

//                   if(dishOrDrinkOrSubOrProd.family && dishOrDrinkOrSubOrProd.family._id){
//                       //console.log('family: ',dishOrDrinkOrSubOrProd.family);
//                       object.family = family.lang[0].name;
//                       if(dishOrDrinkOrSubOrProd.type == 'dish') object.dishes.push(dishOrDrinkOrSubOrProd.versions[0].lang[0].name);
//                       if(dishOrDrinkOrSubOrProd.type == 'drink') object.drinks.push(dishOrDrinkOrSubOrProd.versions[0].lang[0].name);
//                       if(dishOrDrinkOrSubOrProd.type == 'subproduct') object.subproducts.push(dishOrDrinkOrSubOrProd.versions[0].lang[0].name);
//                       if(dishOrDrinkOrSubOrProd.type == 'product') object.products.push(dishOrDrinkOrSubOrProd.versions[0].lang[0].name);
//                       if(dishOrDrinkOrSubOrProd.location.length > 0){
//                         dishOrDrinkOrSubOrProd.location.forEach((loc)=>{
//                           object.locs.push(loc.name);
//                         })
//                       }
//                       //object.locs = object.locs.concat(gastro.location);
//                       //console.log('pushing familyObject in array: ',object)
//                       object.dishes = removeDuplicatesRecipes(object.dishes)
//                       object.drinks = removeDuplicatesRecipes(object.drinks)
//                       object.subproducts = removeDuplicatesRecipes(object.subproducts)
//                       object.products = removeDuplicatesRecipes(object.products)
//                       object.locs = removeDuplicatesRecipes(object.locs)
//                       arrayOfFamilyInRecipes.push(object);

//                   }

//                   cb_async2();

//                 },(err,docs)=>{
//                   if(err) return cb(err)
//                   console.log('dishesAndDrinks with families with location: ',arrayOfFamilyInRecipes);
//                   cbFam(null,arrayOfFamilyInRecipes)            
//                 })

//             }],(err,doc)=>{
//               if(err) return cb_async();
//               cb_async();
//             })

//           },(err,res)=>{
//             if(err) return cb(err)

//             cb(null,arrayOfFamilyInRecipes)
//           })

//         },(docs,cb)=>{
//           console.log('arrayOfFamilyInRecipes: ',arrayOfFamilyInRecipes.length);
//           arrayOfFamilies = removeDuplicateFamilies(arrayOfFamilyInRecipes)
//           console.log('arrayOfFamilies: ',arrayOfFamilies.length);
//           console.log('arrayOfFamilies: ',arrayOfFamilies);
//           cb(null,arrayOfFamilies);

//         },(docs,cb)=>{

//           var fields = ['family','dishes','drinks','subproducts','products','locs'];

//           var fieldNames = ['Familia','Platos' , 'Bebidas','Subproductos','Productos','Localizaciones'];

//           json2csv({ data: arrayOfFamilies, fields: fields, fieldNames: fieldNames}, function(err, csv) {
//             if (err) cb(err);
//             fs.writeFile('/tmp/family_by_locs_and_recipes.csv', csv, function(err) {
//               if (err) return cb(err);
//               logger.info('Create csv file: /tmp/family_by_locs_and_recipes.csv')
//               cb(null, docs)
//             });       
//           });

//     }],(err,ok)=>{
//         if(err) return res.status(500).json(err.message || 'Error').end();
//         res.status(200).json('Export \'family_by_locs_and_recipes.csv\' in tmp folder').end();
//     })
// }*/


exports.exportFamilyRecipeWithLocsAndDishesAndDrinks = (req, res) => {

    var async = require('async');
    var Family = require('../models/family');
    var Dish = require('../models/dish');
    var Drink = require('../models/drinks');
    var Subproduct = require('../models/subproduct');
    var Product = require('../models/product');
    var families = []

    async.waterfall([

        (cb) => {

            Family.find({ $and: [{ "location": { $nin: [] } }, { "category": 'recipe' }] }, (err, docs) => {
                if (err) return cb(err)
                if (docs) {
                    families = docs;
                    cb(null, docs)
                } else {
                    logger.error('Error at find families');
                    return cb(true)
                }

            })

        }, (docs, cb) => {

            async.eachSeries(families, function(family, cb_async) {

                let locations = [];

                async.waterfall([

                    (cbFam) => {

                        Dish.find({ $and: [{ 'family': family._id }, { 'active': true }] })
                            .exec((err, docs) => {
                                if (err) return cbFam(err)
                                if (docs) {
                                    docs.forEach((doc) => {
                                        locations = locations.concat(doc.location)
                                    })
                                    cbFam(null)
                                }
                            })

                    }, (cbFam) => {

                        Drink.find({ $and: [{ 'family': family._id }, { 'active': true }] })
                            .exec((err, docs) => {
                                if (err) return cbFam(err)
                                if (docs) {
                                    docs.forEach((doc) => {
                                        locations = locations.concat(doc.location)
                                    })
                                    cbFam(null)
                                }
                            })

                    }, (cbFam) => {

                        Product.find({ $and: [{ 'family': family._id }, { 'active': true }] })
                            .exec((err, docs) => {
                                if (err) return cbFam(err)
                                if (docs) {
                                    docs.forEach((doc) => {
                                        locations = locations.concat(doc.location)
                                    })
                                    cbFam(null)
                                }
                            })

                    }, (cbFam) => {

                        Subproduct.find({ $and: [{ 'family': family._id }, { 'active': true }] })
                            .exec((err, docs) => {
                                if (err) return cbFam(err)
                                if (docs) {
                                    docs.forEach((doc) => {
                                        locations = locations.concat(doc.location)
                                    })
                                    cbFam(null)
                                }
                            })

                    }, (cbFam) => {

                        if (locations.length) {
                            locations = locations.map((loc) => {
                                return loc.toString();
                            })

                            let unique_array = locations.filter((elem, index) => {
                                let elemString = elem.toString();
                                return index == locations.indexOf(elemString);
                            });

                            locations = unique_array.map((loc) => {
                                return new ObjectId(loc);
                            })
                        }
                        cbFam(null)

                    }], (err, doc) => {

                    if (err) {
                        logger.error('Error: %s', err);

                        return cb_async();
                    }

                    Family.findById(family._id, (err, doc) => {
                        if (err) return cb(err)
                        doc.location = locations;

                        doc.save((err, doc) => {
                            if (err) {
                                logger.error('Error saving document: %s', doc._id);
                                return cb(err)
                            }
                            cb_async(null, doc)
                        })
                    })
                })

            }, (err, res) => {
                if (err) return cb(err)

                cb(null, res)
            })

        }
    ], (err, ok) => {
        if (err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json('Finish the update of the locations of families.').end();
    })
}


/**
 * @api {get} /translate Translate collection text content from one source language to another. 
 *                       Supported collections are:
 *                          - ingredient
 *                          - allergen
 *                          - checkpoint
 *                          - family + subfamily
 *                          - kitchen
 *                          - process
 *                          - utensil
 *                          - workroom
 *                          - packaging 
 *                          - measurementunits
 * @apiGroup {utils}
 * @apiName translate
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * *
 * @apiParamExample {json} Request-Example:
 *{
 *  "collection":"ingredient",
 *  "sourceLang":"es",
 *  "targetLang":"en",
 *  "skip":"2000",
 *  "limit":"500"
 *}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.translate = async (req, res)=>{

    try {
        var collection = require('../models/'+req.query["collection"]);
        var elementstoTranslate =[];
        var sourceLang = req.query["sourceLang"];
        var targetLang = req.query["targetLang"];
        const CollectionElements = await collection.find({}).skip(parseInt(req.query["skip"])).limit(parseInt(req.query["limit"]));
        var ids = [];
        var readytoUpdate = [];
        var elementsTranslated = [];
        var subfamiliestoTransalate=[];
        var idSubfamilies=[];
        var workroomstoTranslate=[];
        var idWorkrooms=[];
        //Auxiliarx
        var aux=  [];
        var texto = " ";
        var aux1= []
        if(!CollectionElements || CollectionElements.length == 0){
            throw new Error('Could not find documents to translate');
        }
        logger.info('Retrieved %s', CollectionElements);
        var fields = config.traduible[req.query['collection']];
        logger.info('Fields to translate are %s', JSON.stringify(fields));

        for (i = 0; i < CollectionElements.length; i++) {
           logger.info('Evaluating document number %s', i);
           if(CollectionElements[i]['lang'].length>0){
                for (j = 0; j < CollectionElements[i]['lang'].length; j++) {
                    if(CollectionElements[i]['lang'][j]!= null) {
                        aux1.push(CollectionElements[i]['lang'][j]['langCode']);
                    }
                }
                logger.info('Element langCodes are: %s', JSON.stringify(aux1));
                if (aux1.includes(targetLang) == false) {
                    logger.info('Target lang %s is not included', targetLang);
                    if(CollectionElements[i]!=null){
                        index = aux1.indexOf("es");
                        readytoUpdate.push(CollectionElements[i]['lang'][index]);
                          ids.push(CollectionElements[i]['_id']);
                        if(fields.length==3){
                            elementstoTranslate.push([CollectionElements[i].lang[index][fields[0]], CollectionElements[i].lang[index][fields[1]], CollectionElements[i].lang[index][fields[2]]]);
                        }
                        if(fields.length==2){
                            elementstoTranslate.push([CollectionElements[i].lang[index][fields[0]], CollectionElements[i].lang[index][fields[1]]]);
                        }
                        if(fields.length==1){
                            elementstoTranslate.push([CollectionElements[i].lang[index][fields[0]]]);
                        }
                        if(req.query["collection"]=="family"){
                            for(m=0;m<CollectionElements[i].subfamilies.length;m++){
                                subfamiliestoTransalate.push(CollectionElements[i].subfamilies[m].lang)
                                idSubfamilies.push(CollectionElements[i].subfamilies[m]._id)
                            }
                        }
                        if(req.query["collection"]=="kitchen"){
                            for(m=0;m<CollectionElements[i].workRooms.length;m++){
                                if(CollectionElements[i].workRooms!=null && CollectionElements.length>0){
                                    workroomstoTranslate.push(CollectionElements[i].workRooms[m].lang)
                                    idWorkrooms.push(CollectionElements[i].workRooms[m]._id)
                                }  
                            }
                        }
                    }
                } else {
                    logger.info('Target lang %s is already included!', targetLang);
                }
                aux1 = [];
           }
        }
        logger.info('readyToUpdate: %s', JSON.stringify(readytoUpdate));
        logger.info('ids: %s', JSON.stringify(ids));
        logger.info('elementstoTranslate: %s', JSON.stringify(elementstoTranslate));
        var opfamilies=[];
        var op={};
        if(req.query["collection"]=="family" ){
            for (i = 0; i < subfamiliestoTransalate.length; i++) {
                if (subfamiliestoTransalate[i][0].name != null) {
                    if (subfamiliestoTransalate[i][0].name.length > 0) {
                        texto = subfamiliestoTransalate[i][0].name;
                    }
                    else {
                        texto = " ";
                    }
                } 
                else {
                    texto = " ";
                }
                var params = {
                    Text: texto,
                    SourceLanguageCode: sourceLang,
                    TargetLanguageCode: targetLang
                }
                logger.info('sending subfamily text to translate: %s', JSON.stringify(params));                
                const data = await awsTranslate(params);
                logger.info('Translated subfamily: %s', JSON.stringify(data));
                subfamiliestoTransalate[i][0].name=data;
                subfamiliestoTransalate[i][0].langCode=targetLang;
                var obj = JSON.parse(JSON.stringify(subfamiliestoTransalate[i][0]));
                delete obj['_id'];  
                op={ updateOne:{
                    "filter": {"subfamilies._id": idSubfamilies[i]},
                    "update": {"$push": {"subfamilies.$.lang": obj}}
                    }
                }
                opfamilies.push(op)
            }
            if(opfamilies.length>0) {const aux3 = await collection.bulkWrite(opfamilies);}
        } else {
            logger.info('Collection is not family.');
        }
        
        var opkitchens=[];
        var op={};
        if(req.query["collection"]=="kitchen" ){
            for (i = 0; i < workroomstoTranslate.length; i++) {
                if (workroomstoTranslate[i][0].name != null) {
                    if (workroomstoTranslate[i][0].name.length > 0) {
                        texto = workroomstoTranslate[i][0].name;
                    }
                    else {
                        texto = " ";
                    }
                } 
                else {
                    texto = " ";
                }
                var params = {
                    Text: texto,
                    SourceLanguageCode: sourceLang,
                    TargetLanguageCode: targetLang
                }
                logger.info('sending workrooms text to translate: %s', JSON.stringify(params));
                const data = await awsTranslate(params);
                logger.info('Translated workroom: %s', JSON.stringify(data));
                workroomstoTranslate[i][0].name=data;
                workroomstoTranslate[i][0].langCode=targetLang;
                var obj = JSON.parse(JSON.stringify(workroomstoTranslate[i][0]));
                delete obj['_id'];  
                op={ updateOne:{
                    "filter": {"workRooms._id": idWorkrooms[i]},
                    "update": {"$push": {"workRooms.$.lang": obj}}
                    }
                }
                opkitchens.push(op)
            }
            if(opkitchens.length>0) {
                logger.info('Workrooms to translate: %s', JSON.stringify(opkitchens));
                const aux3 = await collection.bulkWrite(opkitchens);
                logger.info('Added kitchen workrooms translation to database');
            }
        }
        //Build params and translate elements
        for (i = 0; i < elementstoTranslate.length; i++) {
            for (j = 0; j < elementstoTranslate[i].length; j++) {
                if (elementstoTranslate[i][j] != null) {
                    if (elementstoTranslate[i][j].length > 0) {
                        texto = elementstoTranslate[i][j];
                    }
                    else {
                        texto = " ";
                    }
                }
                else {
                    texto = " ";
                }
                var params = {
                    Text: texto,
                    SourceLanguageCode: sourceLang,
                    TargetLanguageCode: targetLang
                }
                logger.info('sending text to translate: %s', JSON.stringify(params));
                const data = await awsTranslate(params);
                logger.info('Translated data: %s', JSON.stringify(data));
                aux.push(data);
            }
            elementsTranslated.push(aux);
            aux = [];
        }

        logger.info('elementsTranslated: %s', JSON.stringify(elementsTranslated));
        
        //Build values to update element in mongoDB
        for (i = 0; i < elementsTranslated.length; i++) {
            readytoUpdate[i]['langCode'] = "en";
            if(fields.length==3){
                readytoUpdate[i][fields[0]] = elementsTranslated[i][0];
                readytoUpdate[i][fields[1]] = elementsTranslated[i][1];
                readytoUpdate[i][fields[2]] = elementsTranslated[i][2];
            }
            if(fields.length==2){
                readytoUpdate[i][fields[0]] = elementsTranslated[i][0];
                readytoUpdate[i][fields[1]] = elementsTranslated[i][1];
            }
            if(fields.length==1){
                readytoUpdate[i][fields[0]] = elementsTranslated[i][0];
            }
        }
        
        var  bulkOps = []
        for(i=0; i<elementsTranslated.length;i++){
            //delete readytoUpdate[i]['_id'];
            var obj = JSON.parse(JSON.stringify(readytoUpdate[i]));
            delete obj['_id'];
            var op={ updateOne:{
                "filter": {"_id": ids[i]},
                "update": {"$push": {"lang": obj}}
                }
            }
            bulkOps.push(op)
        }

        logger.info('bulkOps: %s', JSON.stringify(bulkOps));

        if(bulkOps.length>0) {
            const aux4 = await collection.bulkWrite(bulkOps);
            var result={
                "Result":aux4,
                "bulkOps": bulkOps
            };
            res.status(200).json(result).end();
        } else {
            res.status(200).json('Nothing to translate!').end();
        }
    
    } catch (err){
        return res.status(500).json(err.stack || 'Error').end();
    }
};

//INGREDIENT
exports.translateV2 = async (req, res)=>{
    try {
        if(req.query.collection==='ingredient'){
            logger.info('Utils controller:: translatev2 => Starting...');
            logger.info('Utils controller:: translatev2 => Collection: %s',req.query["collection"]);
            logger.info('Utils controller:: translatev2 => Skip: %s',req.query["skip"]);
            logger.info('Utils controller:: translatev2 => Limit: %s',req.query["limit"]);

            var collection = require('../models/'+req.query["collection"]);
            var sourceLang = req.query["sourceLang"];
            var targetLang = req.query["targetLang"];
            
            const CollectionElements = await collection.find({}).skip(parseInt(req.query["skip"])).limit(parseInt(req.query["limit"]));
            

            logger.info('Utils controller:: translatev2 => Retrieved %s collection elements', CollectionElements.length);
            const langs = CollectionElements.map(Lang=>{
                return{
                    id: Lang._id,
                    lang: Lang.lang    
                    }});
            const OverWrite = langs.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===targetLang;
                });
            });
            logger.info('Utils controller:: translatev2 => Found %s overwrite elements', OverWrite.length);
            const newTranslates = langs.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===sourceLang;
                }) && obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
            }).map((obj)=>{
                return {
                    id: obj.id,
                    lang: obj.lang.map((ob)=>{
                        return{
                            langCode: ob.langCode,
                            name: ob.name,
                            description: ob.description,
                            equivalenceUnitName: ob.equivalenceUnitName,
                            alcoholPercentatge: ob.alcoholPercentatge,
                            region: ob.region,
                            tastingNote: ob.tastingNote
                        }
                    })
                }
            });
            logger.info('Utils controller:: translatev2 => Found %s new translates elements', newTranslates.length);
            var params = {
                Text: '',
                SourceLanguageCode: sourceLang,
                TargetLanguageCode: targetLang
            }
            for (var i=0; i<OverWrite.length; i++){
                sourceLangObject= OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev2 => Translating OverWrite %s',sourceLangObject.name);
                targetLangObject= OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(targetLang)];
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    targetLangObject.name=data;
                }else{
                    targetLangObject.name=sourceLangObject.name;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    targetLangObject.description=data;
                }else{
                    targetLangObject.description=sourceLangObject.description;
                }
                if(sourceLangObject.tastingNote!='' && sourceLangObject.tastingNote!=null){
                    params.Text=sourceLangObject.tastingNote;
                    const data= await awsTranslate(params);
                    targetLangObject.tastingNote=data;
                }else{
                    targetLangObject.tastingNote=sourceLangObject.tastingNote;
                }
                OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(targetLang)]=targetLangObject;
            }
            var bulkOps = OverWrite.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$set":{"lang":obj.lang}}
                    }
                }
            });
            var result={}
            if(bulkOps.length>0) {
                const aux4 = await collection.bulkWrite(bulkOps);
                result.OverWrite= aux4;
                logger.info('Utils controller:: translatev2 => Saved overwrite translations...');
            }
            else{
                const aux4 = 'Nothing to translate!';
                result.OverWrite= aux4;
            }
            for(var i=0; i<newTranslates.length;i++){
                sourceLangObject= newTranslates[i].lang[newTranslates[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev2 => Translating newTranslates %s',sourceLangObject.name);
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    sourceLangObject.name=data;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    sourceLangObject.description=data;
                }
                if(sourceLangObject.tastingNote!='' && sourceLangObject.tastingNote!=null){
                    params.Text=sourceLangObject.tastingNote;
                    const data= await awsTranslate(params);
                    sourceLangObject.tastingNote=data;
                }
                sourceLangObject.langCode='en';
                newTranslates[i].lang[newTranslates[i].lang.map((el)=>el.langCode).indexOf(sourceLang)]=sourceLangObject;
            }
            var bulkOps1 = newTranslates.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$push":{"lang":obj.lang[0]}}
                    }
                }
            });
            if(bulkOps1.length>0) {
                const resNew = await collection.bulkWrite(bulkOps1);
                result.newTranslates= resNew;
                logger.info('Utils controller:: translatev3 => Saved new translate translations...');
            }
            else{
                const resNew= 'Nothing to translate';
                result.newTranslates= resNew;
            }
            result.bulkOps= bulkOps;
            return res.status(200).json(result).end();
        }
        else{
            if(req.query.collection){
                return res.status(406).json('Collection not valid!');
            }
            else{
                return res.status(400).json('Missing argument!');
            }
        }
    }
    catch(err){
        return res.status(500).json(err.stack || 'Error').end();
    }
};

//Translate process, allergen, checkpoint,packFormat, packaging
exports.translatev3 = async (req, res)=>{
    try {
        if(req.query.collection==='process'||req.query.collection==='allergen'||req.query.collection==='checkpoint'||req.query.collection==='packFormat'||req.query.collection==='packaging'){
            logger.info('Utils controller:: translatev3 => Starting...');
            logger.info('Utils controller:: translatev3 => Collection: %s',req.query["collection"]);
            logger.info('Utils controller:: translatev3 => Skip: %s',req.query["skip"]);
            logger.info('Utils controller:: translatev3 => Limit: %s',req.query["limit"]);

            var collection = require('../models/'+req.query["collection"]);
            var sourceLang = req.query["sourceLang"];
            var targetLang = req.query["targetLang"];
            const CollectionElements = await collection.find({}).skip(parseInt(req.query["skip"])).limit(parseInt(req.query["limit"]));
            logger.info('Utils controller:: translatev3 => Retrieved %s collection elements', CollectionElements.length);
            const lang= CollectionElements.map(obj=>{
                return { id: obj._id, lang: obj.lang}
            });
            const OverWrite = lang.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===targetLang;
                });
            });
            logger.info('Utils controller:: translatev3 => Found %s overwrite elements', OverWrite.length);
            const newTranslates = lang.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===sourceLang;
                }) &&  obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
            }).map((obj)=>{
                return {
                    id: obj.id,
                    lang: obj.lang.map((ob)=>{
                        return{
                            langCode: ob.langCode,
                            name: ob.name,
                            description: ob.description
                        }
                    })
                }
            });
            logger.info('Utils controller:: translatev3 => Found %s new translates elements', newTranslates.length);
            var params = {
                Text: '',
                SourceLanguageCode: sourceLang,
                TargetLanguageCode: targetLang
            }
            logger.info('Utils controller:: translatev3 => Starting overwrite translations...');
            for (var i=0; i<OverWrite.length; i++){
                sourceLangObject= OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev3 => Translating %s',sourceLangObject.name);
                targetLangObject= OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(targetLang)];
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    targetLangObject.name=data;
                }else{
                    targetLangObject.name=sourceLangObject.name;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    targetLangObject.description=data;
                }else{
                    targetLangObject.description=sourceLangObject.description;
                }
                OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(targetLang)]=targetLangObject;
            }
            logger.info('Utils controller:: translatev3 => Finished overwrite translations!');
            var bulkOps = OverWrite.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$set":{"lang":obj.lang}}
                    }
                }
            });
            var result={}
            if(bulkOps.length>0) {
                const aux4 = await collection.bulkWrite(bulkOps);
                result.OverWrite= aux4;
            }
            else{
                const aux4 = 'Nothing to translate!';
                result.OverWrite= aux4;
            }
            logger.info('Utils controller:: translatev3 => Saved overwrite translations...');
            logger.info('Utils controller:: translatev3 => Starting newTranslates translations...');
            for(var i=0; i<newTranslates.length;i++){
                sourceLangObject= newTranslates[i].lang[newTranslates[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev3 => Translating %s',sourceLangObject.name);
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    sourceLangObject.name=data;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    sourceLangObject.description=data;
                }
                sourceLangObject.langCode='en';
                newTranslates[i].lang[newTranslates[i].lang.map((el)=>el.langCode).indexOf(sourceLang)]=sourceLangObject;
            }
            logger.info('Utils controller:: translatev3 => Finished newTranslates translations!');
            var bulkOps1 = newTranslates.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$push":{"lang":obj.lang[0]}}
                    }
                }
            });
            if(bulkOps1.length>0) {
                const resNew = await collection.bulkWrite(bulkOps1);
                result.newTranslates= resNew;
            }
            else{
                const resNew= 'Nothing to translate';
                result.newTranslates= resNew;
            }
            logger.info('Utils controller:: translatev3 => Saved new translate translations...');
            result.bulkOps= bulkOps;
            res.status(200).json(result).end();
        }
        else{
            if(req.query.collection){
                return res.status(406).json('Collection not valid!');
            }
            else{
                return res.status(400).json('Missing argument!');
            }
        }
    }
    catch(err){
        return res.status(500).json(err.stack|| 'Error').end();
    }
}

//FAMILIES AND SUBFAMILIES
exports.translatev4 = async (req, res)=>{
    try {
        if(req.query.collection==='family'){
            logger.info('Utils controller:: translatev4 => Starting...');
            logger.info('Utils controller:: translatev4 => Collection: %s',req.query["collection"]);
            logger.info('Utils controller:: translatev4 => Skip: %s',req.query["skip"]);
            logger.info('Utils controller:: translatev4 => Limit: %s',req.query["limit"]);

            var collection = require('../models/'+req.query["collection"]);
            var sourceLang = req.query["sourceLang"];
            var targetLang = req.query["targetLang"];
            const CollectionElements = await collection.find({}).skip(parseInt(req.query["skip"])).limit(parseInt(req.query["limit"]));
            logger.info('Utils controller:: translatev4 => Retrieved %s collection elements', CollectionElements.length);
            const Families = CollectionElements.map((obj)=>{
                return{
                    id: obj._id,
                    lang: obj.lang
                }
            });
            var Subfamilies= CollectionElements.map(obj=>obj.subfamilies.map(it=>{
                return{
                    id: it._id,
                    lang: it.lang
                }
            }));
            Subfamilies=Subfamilies.reduce((acc,val)=>acc.concat(val),[]);
            const OverWriteFamilies = Families.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===targetLang;
                });
            });
            const OverWriteSubfamilies = Subfamilies.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===targetLang;
                });
            });
            const newTranslatesFamilies = Families.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===sourceLang;
                }) && obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
            }).map((obj)=>{
                return {
                    id: obj.id,
                    lang: obj.lang.map((ob)=>{
                        return{
                            langCode: ob.langCode,
                            name: ob.name,
                        }
                    })
                }
            });

            const newTranslatesSubFamilies = Subfamilies.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===sourceLang;
                }) && obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
            }).map((obj)=>{
                return {
                    id: obj.id,
                    lang: obj.lang.map((ob)=>{
                        return{
                            langCode: ob.langCode,
                            name: ob.name,
                            description: ob.description
                        }
                    })
                }
            });

            logger.info('Utils controller:: translatev4 => Retrieved %s OverWriteFamilies', OverWriteFamilies.length);
            logger.info('Utils controller:: translatev4 => Retrieved %s OverWriteSubfamilies', OverWriteSubfamilies.length);
            logger.info('Utils controller:: translatev4 => Retrieved %s newTranslatesFamilies', newTranslatesFamilies.length);
            logger.info('Utils controller:: translatev4 => Retrieved %s newTranslatesSubFamilies', newTranslatesSubFamilies.length);

            var params = {
                Text: '',
                SourceLanguageCode: sourceLang,
                TargetLanguageCode: targetLang
            }

            logger.info('Utils controller:: translatev4 => Starting OverWriteFamilies translations...');
            
            for (var i=0; i<OverWriteFamilies.length; i++){
                sourceLangObject= OverWriteFamilies[i].lang[OverWriteFamilies[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev4 => Translating %s',sourceLangObject.name);
                targetLangObject= OverWriteFamilies[i].lang[OverWriteFamilies[i].lang.map((el)=>el.langCode).indexOf(targetLang)];
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    targetLangObject.name=data;
                }else{
                    targetLangObject.name=sourceLangObject.name;
                }
                OverWriteFamilies[i].lang[OverWriteFamilies[i].lang.map((el)=>el.langCode).indexOf(targetLang)]=targetLangObject;
            }
            var BulkOpOvFam = OverWriteFamilies.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$set":{"lang":obj.lang}}
                    }
                }
            });

            logger.info('Utils controller:: translatev4 => Starting OverWriteSubfamilies translations...');
            for (var i=0; i<OverWriteSubfamilies.length; i++){
                sourceLangObject= OverWriteSubfamilies[i].lang[OverWriteSubfamilies[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev4 => Translating %s',sourceLangObject.name);
                targetLangObject= OverWriteSubfamilies[i].lang[OverWriteSubfamilies[i].lang.map((el)=>el.langCode).indexOf(targetLang)];
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    targetLangObject.name=data;
                }else{
                    targetLangObject.name=sourceLangObject.name;
                }
                OverWriteSubfamilies[i].lang[OverWriteSubfamilies[i].lang.map((el)=>el.langCode).indexOf(targetLang)]=targetLangObject;
            }
            var BulkOpOvSubFam = OverWriteSubfamilies.map((obj)=>{
                return{
                    updateOne:{
                        "filter":{"subfamilies._id": obj.id},
                        "update":{"$set":{"subfamilies.$.lang":obj.lang}}
                    }
                }
            });

            logger.info('Utils controller:: translatev4 => Starting newTranslatesFamilies translations...');
            for(var i=0; i<newTranslatesFamilies.length;i++){
                sourceLangObject= newTranslatesFamilies[i].lang[newTranslatesFamilies[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev4 => Translating %s',sourceLangObject.name);
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    sourceLangObject.name=data;
                }
                sourceLangObject.langCode='en';
                newTranslatesFamilies[i].lang[newTranslatesFamilies[i].lang.map((el)=>el.langCode).indexOf(sourceLang)]=sourceLangObject;
            }
            var BulkOpNewFamilies = newTranslatesFamilies.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$push":{"lang":obj.lang[0]}}
                    }
                }
            });

            logger.info('Utils controller:: translatev4 => Starting newTranslatesSubFamilies translations...');
            for(var i=0; i<newTranslatesSubFamilies.length;i++){
                sourceLangObject= newTranslatesSubFamilies[i].lang[newTranslatesSubFamilies[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev4 => Translating %s',sourceLangObject.name);
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    sourceLangObject.name=data;
                }
                sourceLangObject.langCode='en';
                newTranslatesSubFamilies[i].lang[newTranslatesSubFamilies[i].lang.map((el)=>el.langCode).indexOf(sourceLang)]=sourceLangObject;
            }
            var BulkOpNewSubFamilies = newTranslatesSubFamilies.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"subfamilies._id": obj.id},
                        "update": {"$push":{"subfamilies.$.lang":obj.lang[0]}}
                    }
                }
            });

            //Execution of BULK OPERATIONS
            var result={};
            //OverWrite Families
            if(BulkOpOvFam.length>0) {
                const OvFam = await collection.bulkWrite(BulkOpOvFam);
                result.OvFamilies= OvFam;
                logger.info('Utils controller:: translatev4 => Saved OverWriteFamilies translations...');
            }
            else{
                const OvFam= 'Nothing to translate';
                result.OvFamilies= OvFam;
            }
            //OverWrite Subfamilies
            if(BulkOpOvSubFam.length>0) {
                const OvSubFam = await collection.bulkWrite(BulkOpOvSubFam);
                result.OvSubFamilies= OvSubFam;
                logger.info('Utils controller:: translatev4 => Saved OverWriteSubfamilies translations...');
            }
            else{
                const OvSubFam= 'Nothing to translate';
                result.OvSubFamilies= OvSubFam;
            }

            //New families
            if(BulkOpNewFamilies.length>0) {
                const NewFam = await collection.bulkWrite(BulkOpNewFamilies);
                result.newTranslatesFamilies= NewFam;
                logger.info('Utils controller:: translatev4 => Saved newTranslatesFamilies translations...');
            }
            else{
                const NewFam= 'Nothing to translate';
                result.newTranslatesFamilies= NewFam;
            }

            //New Subfamilies
            if(BulkOpNewSubFamilies.length>0) {
                const NewSubFam = await collection.bulkWrite(BulkOpNewSubFamilies);
                result.newTranslatesSubFamilies= NewSubFam;
                logger.info('Utils controller:: translatev4 => Saved newTranslatesSubFamilies translations...');
            }
            else{
                const NewSubFam= 'Nothing to translate';
                result.newTranslatesSubFamilies= NewSubFam;
            }

            return res.status(200).json(result).end();
        }
        else{
            if(req.query.collection){
                return res.status(406).json('Collection not valid!');
            }
            else{
                return res.status(400).json('Missing argument!');
            }
        }
    }
    catch(err){
        return res.status(500).json(err.stack|| 'Error').end();
    }
}

//KITCHEN
exports.translatev5 = async (req, res)=>{
    try {
        if(req.query.collection==='kitchen'){
            logger.info('Utils controller:: translatev5 => Starting...');
            logger.info('Utils controller:: translatev5 => Collection: %s',req.query["collection"]);
            logger.info('Utils controller:: translatev5 => Skip: %s',req.query["skip"]);
            logger.info('Utils controller:: translatev5 => Limit: %s',req.query["limit"]);
            
            var result={};
            var collection = require('../models/'+req.query["collection"]);
            var sourceLang = req.query["sourceLang"];
            var targetLang = req.query["targetLang"];
            const CollectionElements = await collection.find({}).skip(parseInt(req.query["skip"])).limit(parseInt(req.query["limit"]));
            logger.info('Utils controller:: translatev5 => Retrieved %s collection elements', CollectionElements.length);
            var Kitchen = CollectionElements.map(obj=>{
                return{
                    id: obj._id,
                    lang: obj.lang
                }
            });
            var WorkRooms = CollectionElements.map(obj=>obj.workRooms.map(it=>{
                return{
                    id: it._id,
                    lang: it.lang
                }
            }));
            WorkRooms=WorkRooms.reduce((acc,val)=>acc.concat(val),[]);
            const OverWriteKitchen = Kitchen.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===targetLang;
                });
            });
            const OverWriteWorkRoom = WorkRooms.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===targetLang;
                });
            });

            const newTranslatesKitchen = Kitchen.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===sourceLang;
                }) && obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
            }).map((obj)=>{
                return {
                    id: obj.id,
                    lang: obj.lang.map((ob)=>{
                        return{
                            langCode: ob.langCode,
                            name: ob.name,
                            description: ob.description
                        }
                    })
                }
            });

            const newTranslatesWorkRooms = WorkRooms.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===sourceLang;
                }) && obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
            }).map((obj)=>{
                return {
                    id: obj.id,
                    lang: obj.lang.map((ob)=>{
                        return{
                            langCode: ob.langCode,
                            name: ob.name,
                            description: ob.description
                        }
                    })
                }
            });

            logger.info('Utils controller:: translatev5 => Retrieved %s OverWriteKitchen', OverWriteKitchen.length);
            logger.info('Utils controller:: translatev5 => Retrieved %s OverWriteWorkRoom', OverWriteWorkRoom.length);
            logger.info('Utils controller:: translatev5 => Retrieved %s newTranslatesKitchen', newTranslatesKitchen.length);
            logger.info('Utils controller:: translatev5 => Retrieved %s newTranslatesWorkRooms', newTranslatesWorkRooms.length);

            var params = {
                Text: '',
                SourceLanguageCode: sourceLang,
                TargetLanguageCode: targetLang
            }

            for (var i=0; i<OverWriteKitchen.length; i++){
                sourceLangObject= OverWriteKitchen[i].lang[OverWriteKitchen[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev5 => Translating OverWriteKitchen %s',sourceLangObject.name);
                targetLangObject= OverWriteKitchen[i].lang[OverWriteKitchen[i].lang.map((el)=>el.langCode).indexOf(targetLang)];
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    targetLangObject.name=data;
                }else{
                    targetLangObject.name=sourceLangObject.name;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    targetLangObject.description=data;
                }else{
                    targetLangObject.description=sourceLangObject.description;
                }
                OverWriteKitchen[i].lang[OverWriteKitchen[i].lang.map((el)=>el.langCode).indexOf(targetLang)]=targetLangObject;
            }
            var BulkOpOvKitchen = OverWriteKitchen.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$set":{"lang":obj.lang}}
                    }
                }
            });
            for (var i=0; i<OverWriteWorkRoom.length; i++){
                sourceLangObject= OverWriteWorkRoom[i].lang[OverWriteWorkRoom[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev5 => Translating OverWriteWorkRoom %s',sourceLangObject.name);
                targetLangObject= OverWriteWorkRoom[i].lang[OverWriteWorkRoom[i].lang.map((el)=>el.langCode).indexOf(targetLang)];
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    targetLangObject.name=data;
                }else{
                    targetLangObject.name=sourceLangObject.name;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    targetLangObject.description=data;
                }else{
                    targetLangObject.description=sourceLangObject.description;
                }
                OverWriteWorkRoom[i].lang[OverWriteWorkRoom[i].lang.map((el)=>el.langCode).indexOf(targetLang)]=targetLangObject;
            }
            var BulkOpOvWorkRoom = OverWriteWorkRoom.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"workRooms._id": obj.id},
                        "update": {"$set":{"workRooms.$.lang":obj.lang}}
                    }
                }
            });
            for (var i=0; i<newTranslatesKitchen.length; i++){
                sourceLangObject= newTranslatesKitchen[i].lang[newTranslatesKitchen[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev5 => Translating newTranslatesKitchen %s',sourceLangObject.name);
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    sourceLangObject.name=data;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    sourceLangObject.description=data;
                }
                sourceLangObject.langCode='en';
                newTranslatesKitchen[i].lang[newTranslatesKitchen[i].lang.map((el)=>el.langCode).indexOf(sourceLang)]=sourceLangObject;
            }
            var BulkOpNewKitchen = newTranslatesKitchen.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$push":{"lang":obj.lang[0]}}
                    }
                }
            });
            for (var i=0; i<newTranslatesWorkRooms.length; i++){
                sourceLangObject= newTranslatesWorkRooms[i].lang[newTranslatesWorkRooms[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev5 => Translating newTranslatesWorkRooms %s',sourceLangObject.name);
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    sourceLangObject.name=data;
                }
                if(sourceLangObject.description!='' && sourceLangObject.description!=null){
                    params.Text=sourceLangObject.description;
                    const data= await awsTranslate(params);
                    sourceLangObject.description=data;
                }
                sourceLangObject.langCode='en';
                newTranslatesWorkRooms[i].lang[newTranslatesWorkRooms[i].lang.map((el)=>el.langCode).indexOf(sourceLang)]=sourceLangObject;
            }
            var BulkOpNewWorkRoom = newTranslatesWorkRooms.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"workRooms._id": obj.id},
                        "update": {"$push":{"workRooms.$.lang":obj.lang[0]}}
                    }
                }
            });

            //Execution of BULK OPERATIONS
            var result={};
            //OverWrite Kitchen
            if(BulkOpOvKitchen.length>0) {
                const OvKitchen = await collection.bulkWrite(BulkOpOvKitchen);
                result.OvKitchen= OvKitchen;
                logger.info('Utils controller:: translatev5 => Saved OverWrite Kitchen translations...');
            }
            else{
                const OvKitchen= 'Nothing to translate';
                result.OvKitchen= OvKitchen;
            }
            //OverWrite WorkRooms
            if(BulkOpOvWorkRoom.length>0) {
                const OvWorkRooms = await collection.bulkWrite(BulkOpOvWorkRoom);
                result.OvWorkRooms= OvWorkRooms;
                logger.info('Utils controller:: translatev5 => Saved OverWrite WorkRooms translations...');
            }
            else{
                const OvWorkRooms= 'Nothing to translate';
                result.OvWorkRooms= OvWorkRooms;
            }

            //New Kitchen
            if(BulkOpNewKitchen.length>0) {
                const NewKitchen = await collection.bulkWrite(BulkOpNewKitchen);
                result.newTraslatesKitchen= NewKitchen;
                logger.info('Utils controller:: translatev5 => Saved New Kitchen translations...');
            }
            else{
                const NewKitchen= 'Nothing to translate';
                result.newTraslatesKitchen= NewKitchen;
            }

            //New WorkRooms
            if(BulkOpNewWorkRoom.length>0) {
                const NewWr = await collection.bulkWrite(BulkOpNewWorkRoom);
                result.newWorkRoom= NewWr;
                logger.info('Utils controller:: translatev5 => Saved New WorkRooms translations...');
            }
            else{
                const NewWr= 'Nothing to translate';
                result.newWorkRoom= NewWr;
            }
            return res.status(200).json(result).end();
        }
        else{
            if(req.query.collection){
                return res.status(406).json('Collection not valid!');
            }
            else{
                return res.status(400).json('Missing argument!');
            }
        }
    }
    catch(err){
        return res.status(500).json(err.stack||'Error').end();
    }    

}

//MEASUREMENT UNIT AND UTENSIL
exports.translatev6 = async (req, res)=>{
    try {
        if(req.query.collection==='measurementUnit'||req.query.collection==='utensil'){
            logger.info('Utils controller:: translatev6 => Starting...');
            logger.info('Utils controller:: translatev6 => Collection: %s',req.query["collection"]);
            logger.info('Utils controller:: translatev6 => Skip: %s',req.query["skip"]);
            logger.info('Utils controller:: translatev6 => Limit: %s',req.query["limit"]);

            var result={};
            var collection = require('../models/'+req.query["collection"]);
            var sourceLang = req.query["sourceLang"];
            var targetLang = req.query["targetLang"];
            
            const CollectionElements = await collection.find({}).skip(parseInt(req.query["skip"])).limit(parseInt(req.query["limit"]));
            
            logger.info('Utils controller:: translatev6 => Retrieved %s collection elements', CollectionElements.length);

            const Lang = CollectionElements.map((obj=>{
                return { id: obj._id, lang: obj.lang}
            }));
            const OverWrite = Lang.filter((obj)=>{
                return obj.lang.some((lang)=>{
                    return lang.langCode===targetLang;
                });
            });
            if(req.query["collection"]==='utensil'){
                var newTranslates = Lang.filter((obj)=>{
                    return obj.lang.some((lang)=>{
                        return lang.langCode===sourceLang;
                    }) && obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
                }).map((obj)=>{
                    return {
                        id: obj.id,
                        lang: obj.lang.map((ob)=>{
                            return{
                                langCode: ob.langCode,
                                name: ob.name,
                                accessories: ob.accessories
                            }
                        })
                    }
                });
            }
            if(req.query["collection"]==='measurementUnit'){
                var newTranslates = Lang.filter((obj)=>{
                    return obj.lang.some((lang)=>{
                        return lang.langCode===sourceLang;
                    }) && obj.lang.map((el)=>el.langCode).indexOf(targetLang)< 0;
                }).map((obj)=>{
                    return {
                        id: obj.id,
                        lang: obj.lang.map((ob)=>{
                            return{
                                langCode: ob.langCode,
                                name: ob.name,
                                shortName: ob.shortName
                            }
                        })
                    }
                });
            }
            var params = {
                Text: '',
                SourceLanguageCode: sourceLang,
                TargetLanguageCode: targetLang
            }
            for (var i=0; i<OverWrite.length; i++){
                sourceLangObject= OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev6 => Translating OverWrite %s',sourceLangObject.name);
                targetLangObject= OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(targetLang)];
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    targetLangObject.name=data;
                }else{
                    targetLangObject.name=sourceLangObject.name;
                }
                if(req.query["collection"]==='utensil'){
                    if(sourceLangObject.accessories!='' && sourceLangObject.accessories!=null){
                        params.Text=sourceLangObject.accessories;
                        const data= await awsTranslate(params);
                        targetLangObject.accessories=data;
                    }else{
                        targetLangObject.accessories=sourceLangObject.accessories;
                    }
                }
                OverWrite[i].lang[OverWrite[i].lang.map((el)=>el.langCode).indexOf(targetLang)]=targetLangObject;
            }
            var bulkOps = OverWrite.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$set":{"lang":obj.lang}}
                    }
                }
            });
            var result={}
            if(bulkOps.length>0) {
                const aux4 = await collection.bulkWrite(bulkOps);
                logger.info('Utils controller:: translatev6 => Saved overwrite translations...');
                result.OverWrite= aux4;
            }
            else{
                const aux4 = 'Nothing to translate!';
                result.OverWrite= aux4;
            }
            for(var i=0; i<newTranslates.length;i++){
                sourceLangObject= newTranslates[i].lang[newTranslates.lang.map((el)=>el.langCode).indexOf(sourceLang)];
                logger.info('Utils controller:: translatev6 => Translating new translates %s',sourceLangObject.name);
                if(sourceLangObject.name!='' && sourceLangObject.name!=null){
                    params.Text=sourceLangObject.name;
                    const data= await awsTranslate(params);
                    sourceLangObject.name=data;
                }
                if(req.query["collection"]==='utensil'){
                if(sourceLangObject.accessories!='' && sourceLangObject.accessories!=null){
                    params.Text=sourceLangObject.accessories;
                    const data= await awsTranslate(params);
                    sourceLangObject.accessories=data;
                }
                }
                sourceLangObject.langCode='en';
                newTranslates[i].lang[newTranslates[i].lang.map((el)=>el.langCode).indexOf(sourceLang)]=sourceLangObject;
            }
            
            var bulkOps1 = newTranslates.map((obj)=>{
                return{
                    updateOne:{
                        "filter": {"_id": obj.id},
                        "update": {"$push":{"lang":obj.lang[0]}}
                    }
                }
            });
            if(bulkOps1.length>0) {
                const resNew = await collection.bulkWrite(bulkOps1);
                logger.info('Utils controller:: translatev5 => Saved New translates translations...');
                result.newTranslates= resNew;
            }
            else{
                const resNew= 'Nothing to translate';
                result.newTranslates= resNew;
            }
            result.bulkOverWrite= bulkOps;
            result.bulkNew= bulkOps1;
            return res.status(200).json(result).end();
        }
        else{
            if(req.query.collection){
                return res.status(406).json('Collection not valid!');
            }
            else{
                return res.status(400).json('Missing argument!');
            }
        }
    }
    catch(err){
        return res.status(500).json(err.stack||'Error').end();
    }
} 

var awsTranslate = async (params) => {

    return new Promise ((resolve, reject) => {

        try {
            var AWS = require('aws-sdk');
    
            AWS.config.accessKeyId = config.awsBucket.accessKey;
            AWS.config.secretAccessKey = config.awsBucket.secret;
            AWS.config.region = config.awsBucket.region;
    
            var translate = new AWS.Translate();

        } catch (err){
            reject(err);
        }

        translate.translateText(params, (err,data) => {
            if(err) reject(err);
            else resolve(data.TranslatedText);
        })
    })
}

var removeDuplicatesRecipes = (arr) => {
  //console.log(arr,'arr')
  // console.log(arr.length,'arr2')
  var i,j,cur,found;
  for(i=arr.length-1;i>=0;i--){
    cur = arr[i];
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= arr[j];
      if(cur == id){
        if(i!=j){
          arr.splice(i,1);
        }
        found=true;
      }
    }
  }
  return arr;
}

var removeDuplicateFamilies = (arr) => {
  //console.log(arr,'arr')
  // console.log(arr.length,'arr2')
  var i,j,cur,found;
  for(i=arr.length-1;i>=0;i--){
    cur = arr[i].family;
    found=false;
    for(j=i-1; !found&&j>=0; j--){
      let id= arr[j].family;
      if(cur == id){
        if(i!=j){
          arr.splice(i,1);
        }
        found=true;
      }
    }
  }
  return arr;
}

exports.excelReport = async (req, res)=>{
    try {

        if(req.query["collection"]==='ingredient'||req.query["collection"]==='utensil'||req.query["collection"]==='measurementUnit'||req.query["collection"]==='process' ||req.query["collection"]==='allergen'||req.query["collection"]==='checkpoint'||req.query["collection"]==='packFormat'||req.query["collection"]==='packaging'||req.query["collection"]==='kitchen'||req.query["collection"]==='family'){
            const excel = require("exceljs");

            let workbook = new excel.Workbook();
            let worksheet = workbook.addWorksheet("Translate Report");
            if(req.query["collection"]==='ingredient'){
            worksheet.columns = [
            { header: "Collection", key: "Collection", width: 25},
            { header: "Nº Document", key: "nDoc", width: 25 },
            { header: "Doc Id", key: "id", width: 30 },
            { header: "Español Name", key: "esp", width: 50 },
            { header: "English Name", key: "eng", width: 50 },
            { header: "Español Description", key: "espdes", width: 50 },
            { header: "English Description", key: "engdes", width: 50 },
            { header: "Español TastingNote", key: "esptn", width: 50 },
            { header: "English TastingNote", key: "engtn", width: 50 },
            ];
            }
            if(req.query["collection"]==='utensil'){
                worksheet.columns = [
                { header: "Collection", key: "Collection", width: 25},
                { header: "Nº Document", key: "nDoc", width: 25 },
                { header: "Doc Id", key: "id", width: 30 },
                { header: "Español Name", key: "esp", width: 50 },
                { header: "English Name", key: "eng", width: 50 },
                { header: "Español Accesories", key: "espacc", width: 50 },
                { header: "English Accessories", key: "engacc", width: 50 },

                ]
            }
            if(req.query["collection"]==='measurementUnit'){
                worksheet.columns = [
                { header: "Collection", key: "Collection", width: 25},
                { header: "Nº Document", key: "nDoc", width: 25 },
                { header: "Doc Id", key: "id", width: 30 },
                { header: "Español Name", key: "esp", width: 50 },
                { header: "English Name", key: "eng", width: 50 },
                ]
            }
            if(req.query["collection"]==='process' ||req.query["collection"]==='allergen'||req.query["collection"]==='checkpoint'||req.query["collection"]==='packFormat'||req.query["collection"]==='packaging'){
                worksheet.columns = [
                { header: "Collection", key: "Collection", width: 25},
                { header: "Nº Document", key: "nDoc", width: 25 },
                { header: "Doc Id", key: "id", width: 30 },
                { header: "Español Name", key: "esp", width: 50 },
                { header: "English Name", key: "eng", width: 50 },
                { header: "Español Description", key: "espdes", width: 50 },
                { header: "English Description", key: "engdes", width: 50 },
                ]
            }
            if(req.query.collection==='family'){
                var worksheet1 = workbook.addWorksheet("Subfamilies");
                worksheet.columns = [
                    { header: "Collection", key: "Collection", width: 25},
                    { header: "Nº Document", key: "nDoc", width: 25 },
                    { header: "Doc Id", key: "id", width: 30 },
                    { header: "Español Name", key: "esp", width: 50 },
                    { header: "English Name", key: "eng", width: 50 },
                ]
                worksheet1.columns=[
                    {header: 'Family', key: "fam", width:25},
                    {header: 'Nº Family object', key:"Nfam", width:25},
                    {header: 'Subfamily id', key:"subid", width:25},
                    {header: 'Español Name', key:"subname", width:25},
                    {header: 'English Name', key:"subnameEN", width:25},
                ]
            }

            if(req.query.collection==='kitchen'){
                var worksheet1 = workbook.addWorksheet("workRooms");
                worksheet.columns = [
                    { header: "Collection", key: "Collection", width: 25},
                    { header: "Nº Document", key: "nDoc", width: 25 },
                    { header: "Doc Id", key: "id", width: 30 },
                    { header: "Español Name", key: "esp", width: 50 },
                    { header: "English Name", key: "eng", width: 50 },
                    {header: "Español Description", key: "espdes", width: 50 },
                    {header: "Español Description", key: "engdes", width: 50 }
                ]
                worksheet1.columns=[
                    {header: 'Kitchen', key: "kit", width:25},
                    {header: 'Nº Kitchen object', key:"Nkit", width:25},
                    {header: 'Workroom id', key:"workid", width:25},
                    {header: 'Español Name', key:"workname", width:25},
                    {header: 'English Name', key:"worknameEN", width:25},
                    {header: 'Español Description', key:"workdes", width:25},
                    {header: 'English Description', key:"workdesEN", width:25}
                ]
            }
            var collection = require('../models/'+req.query["collection"]);
            const CollectionElements = await collection.find({})
            if(req.query.collection==='kitchen'){
                var kitchen = CollectionElements.map((obj)=>{
                    return{
                        id: obj._id,
                        lang: obj.lang
                    }
                })
                var workRooms = CollectionElements.map((obj,index)=>obj.workRooms.map(it=>{
                    return{
                        it: index,
                        idName: obj.lang[0].name,
                        id: it._id,
                        lang: it.lang
                    }
                }));
                workRooms = workRooms.reduce((acc,val)=>acc.concat(val),[]);
                kitchen.forEach((data,index)=>{
                    worksheet.addRow({
                        Collection: req.query.collection,
                        nDoc: index,
                        id: data.id,
                        esp: data.lang[data.lang.map((el)=>el.langCode).indexOf('es')].name,
                        eng: data.lang[data.lang.map((el)=>el.langCode).indexOf('en')].name,
                        espdes: data.lang[data.lang.map((el)=>el.langCode).indexOf('es')].description,
                        engdes: data.lang[data.lang.map((el)=>el.langCode).indexOf('en')].description
                    })
                });
                workRooms.forEach((data,index)=>{
                    if(data.lang){
                        worksheet1.addRow({
                            kit: data.idName,
                            Nkit: data.it,
                            workid: data.id,
                            workname: data.lang[data.lang.map((el)=>el.langCode).indexOf('es')].name,
                            worknameEN: data.lang[data.lang.map((el)=>el.langCode).indexOf('en')].name,
                            workdes: data.lang[data.lang.map((el)=>el.langCode).indexOf('es')].description,
                            workdesEN: data.lang[data.lang.map((el)=>el.langCode).indexOf('en')].description,
                            })
                    }
                });

            }
            if(req.query.collection==='family'){
                var families= CollectionElements.map((obj)=>{
                    return{
                        id: obj._id,
                        lang: obj.lang
                    }
                });
                var Subfamilies= CollectionElements.map((obj,index)=>obj.subfamilies.map(it=>{
                    return{
                        it: index,
                        idName: obj.lang[0].name,
                        id: it._id,
                        lang: it.lang
                    }
                }));
                Subfamilies=Subfamilies.reduce((acc,val)=>acc.concat(val),[]);
                families.forEach((data, index)=>{
                    worksheet.addRow({
                        Collection: req.query.collection,
                        nDoc: index,
                        id: data.id,
                        esp: data.lang[data.lang.map((el)=>el.langCode).indexOf('es')].name,
                        eng: data.lang[data.lang.map((el)=>el.langCode).indexOf('en')].name
                    })
                });
                Subfamilies.forEach((data,index)=>{
                    if(data.lang){
                        worksheet1.addRow({
                            fam: data.idName,
                            Nfam: data.it,
                            subid: data.id,
                            subname: data.lang[data.lang.map((el)=>el.langCode).indexOf('es')].name,
                            subnameEN: data.lang[data.lang.map((el)=>el.langCode).indexOf('en')].name,
                            })
                    }
                });
            }
            if(req.query["collection"]==='ingredient'){
                CollectionElements.forEach((data, index)=>{
                    worksheet.addRow({
                        Collection: req.query["collection"],
                        nDoc: index,
                        id: data._id,
                        esp: data.lang[0].name,
                        eng: data.lang[1].name,
                        espdes:data.lang[0].description,
                        engdes:data.lang[1].description,
                        esptn:data.lang[0].tastingNote,
                        engtn:data.lang[1].tastingNote
                    });
                });
            }
            if(req.query["collection"]==='process' ||req.query["collection"]==='allergen'||req.query["collection"]==='checkpoint'||req.query["collection"]==='packFormat'||req.query["collection"]==='packaging'){
                CollectionElements.forEach((data, index)=>{
                    worksheet.addRow({
                        Collection: req.query["collection"],
                        nDoc: index,
                        id: data._id,
                        esp: data.lang[0].name,
                        eng: data.lang[1].name,
                        espdes:data.lang[0].description,
                        engdes:data.lang[1].description
                    });
                });
            }
            if(req.query["collection"]==='utensil'){
                CollectionElements.forEach((data, index)=>{
                    if(data.lang!=null && data.lang!=undefined && data.lang.length>0){
                    worksheet.addRow({
                        Collection: req.query["collection"],
                        nDoc: index,
                        id: data._id,
                        esp: data.lang[0].name,
                        eng: data.lang[1].name,
                        espacc:data.lang[0].accessories,
                        engacc:data.lang[1].accessories
                    });
                    }
                });
            }
            if(req.query["collection"]==='measurementUnit'){
                CollectionElements.forEach((data, index)=>{
                    if(data.lang!=null && data.lang!=undefined && data.lang.length>0){
                        worksheet.addRow({
                            Collection: req.query["collection"],
                            nDoc: index,
                            id: data._id,
                            esp: data.lang[0].name,
                            eng: data.lang[1].name
                        });
                    }
                });
            }
            

            // res is a Stream object
            res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "translate_report_"+req.query["collection"]+".xlsx"
            );
            //return res.status(200).json(Subfamilies).end();
            return workbook.xlsx.write(res).then(function () {
            res.status(200).end();})
        }
        else{
            if(req.query.collection){
                return res.status(406).json('Collection not supported!'+req.query.collection).end();
            }
            else{
                return res.status(400).json('Missing argument!').end();
            }
        }
    }
    catch(err){
        return res.status(500).json(err.stack||'Error').end();
    }
}
