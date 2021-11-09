 var waterfall = require('async-waterfall');
 var locHelper = require('../helpers/locations');
 var mongoose = require('../node_modules/mongoose');
 var fs = require('fs');
 var async = require('async');
 var Article = require('../models/article');
 var Ingredient = require('../models/ingredient'); 
 var {ObjectId} = require('mongodb');
 var config = require('../config/config');
 var assert = require('assert');

/**
 * @api {post} /article Add new article
 * @apiGroup {article}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Ingredient-Creation:
 * {
 *     "name": ""
 *     "active" : true
 * }
 *
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.add = (req, res) => {

    var account = req.userData;
    var inArticle = req.body;

    inArticle.last_account = account._id;
    var article = new Article(inArticle);

    article.save((err, doc) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc);
    });
};

/**
 * @api {put} /article Edit article
 * @apiGroup {article}
 * @apiName Edit
 *
 * @apiDescription Replaces article
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "_id": "5BA8e04a6df598f322f0aaCD2"
 *     "commercialName": "Acme"
 *      ...
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.edit = (req, res) => {
  var userData = req.userData;
  let updatedArticle = req.body;
  let articleId = new ObjectId(updatedArticle._id);
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var articleLocations;

  waterfall([
      (cb) => {
      if(mongoose.Types.ObjectId.isValid(articleId)) {  

          Article.findById(articleId, (err, doc) => {
              if (err) return cb(err);
              if (!doc) {
                  let err=new Error("Document not found");
                  err.statusCode=404;
                  return cb(err)
              }
              articleLocations=doc.location;
              //Check whether list of subproduct locations includes at least one customer location.
              
              var match = articleLocations.find((id) => {
                  let locId = new ObjectId(id);
                  for(var i=0; i<userLocIds.length; i++) {
                      if (userLocIds[i].equals(locId)) return true;
                  }
              });
              if (match) { cb(null, match); }
              else { 
                  var err = new Error('Access to article location is not allowed');
                  err.statusCode=400;
                  return cb(err); 
              }
          });

        } else {
          let err=new Error("Article id not valid");
          err.statusCode=400;
          return cb(err)
        }

      }, (doc, cb) => {
            updatedArticle.last_account = userData._id;

            Article.findById(articleId, (err, doc) => {
                if (err) return cb(err)
                doc.lang = updatedArticle.lang;
                doc.category = updatedArticle.category;
                doc.provider = updatedArticle.provider;
                doc.document = updatedArticle.document;
                doc.location = updatedArticle.location;
                doc.reference = updatedArticle.reference;
                doc.netPrice = updatedArticle.netPrice;
                doc.grossPrice = updatedArticle.grossPrice;
                doc.active = updatedArticle.active;
                doc.allergens = updatedArticle.allergens;
                doc.packFormat = updatedArticle.packFormat;
                doc.packUnits = updatedArticle.packUnits
                doc.grossWeightPerUnit = updatedArticle.grossWeightPerUnit
                doc.netWeightPerUnit = updatedArticle.netWeightPerUnit
                doc.totalGrossWeight = updatedArticle.totalGrossWeight
                doc.packPrice = updatedArticle.packPrice
                doc.grossPricePerUnit = updatedArticle.grossPricePerUnit
                doc.netPricePerUnit = updatedArticle.netPricePerUnit
                doc.externalReference = updatedArticle.externalReference
                doc.last_account = updatedArticle.last_account;

                doc.save((err, doc) => {
                  if(err) return cb(err)
                  cb(null, doc)
                })
            })

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/**
 * @api {get} /article/detail Get article
 * @apiGroup {article}
 * @apiName Get
 *
 * @apiDescription Gets article
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Subproduct id
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "_id": "5BA8e04a6df598f322f0aaCD2"
 *     "commercialName": "Acme"
 *      ...
 *
 * @apiSuccess {json} Article obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.get = (req, res) => {
  var userData = req.userData;
  let params = req.query;
  let articleId = new ObjectId(params._id);
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var articleLocations;
  var Ingredient = require('../models/ingredient');
  var Packaging = require('../models/packaging');
  var Model;

  waterfall([
      (cb) => {
      
      if(mongoose.Types.ObjectId.isValid(articleId)) {  

          Article.findById(articleId, (err, doc) => {
              if (err) return cb(err);
              if (!doc) {
                  let err=new Error("Document not found");
                  err.statusCode=404;
                  return cb(err)
              }
              articleLocations=doc.location;
              //Check whether list of subproduct locations includes at least one customer location.
              
              var match = articleLocations.find((id) => {
                  let locId = new ObjectId(id);
                  for(var i=0; i<userLocIds.length; i++) {
                      if (userLocIds[i].equals(locId)) return true;
                  }
              });
              if (match) { cb(null, match); }
              else { 
                  var err = new Error('Access to article location is not allowed');
                  err.statusCode=400;
                  return cb(err); 
              }
          });

        } else {
          let err=new Error("Article id not valid");
          err.statusCode=400;
          return cb(err)
        }

      }, (doc, cb) => {

            Article.findById(articleId, function (err, article) {
              if(article.category.kind == 'ingredient') {
                Model = Ingredient;
              } else if (article.category.kind == 'packaging') {
                Model = Packaging;
              }
              var opts = [
                  { path: 'document' },
                  { path: 'provider' },
                  { path: 'packFormat' },
                  { path: 'category.item', match: { 'lang.langCode': userData.user.language}, model: Model}
              ]

              //ToDo: match in populate does not work. Need to filter ingredient's or packaging's lang field by user lang
              Article.populate(article, opts, function (err, doc) {
                if(err) return cb(err)
                cb(null, doc)
              });
            });

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/**
 * @api {delete} /article Delete article
 * @apiGroup {article}
 * @apiName Delete article
 *
 * @apiDescription Delete a article
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  article id
 *
 * @apiSuccess {Object} Article removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.remove = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var articleLocations;
    var articleId = new ObjectId(params._id);

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the gastroOffer's locations      

        if(mongoose.Types.ObjectId.isValid(params._id)) {  
            
            Article.findById(articleId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }
                //Check whether list of gastroOffer locations includes at least one customer location.
                if (doc.location) articleLocations=doc.location;
                else articleLocations=[]
                
                var match = articleLocations.find((id) => {
                    let locId = new ObjectId(id);
                    for(var i=0; i<userLocIds.length; i++) {
                        if (userLocIds[i].equals(locId)) return true;
                    }
                });

                if (match) { cb(null, doc); }
                else { 
                    var err = new Error('Access to gastroOffer location is not allowed');
                    err.statusCode=400;
                    return cb(err);
                }
            })
        } else {
            var err = new Error('Invalid Object Id');
            err.statusCode=400;
            return cb(err)
        }        
    }, (doc, cb) => {
        //remove article
        doc.remove(function (err, doc) {
            if (err) return cb(err)
            cb(null, doc);
         });

    }], (err, ok) => {       
        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
    })
}

/**
 * @api {get} /article Get all articles
 * @apiGroup {article}
 * @apiName Get All
 *
 * @apiDescription Get all articles with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {int} provider  provider Id.
 * @apiParam {int} perPage  Recors per page.
 * @apiParam {int} page  Page number.
 * @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 * @apiParam {string} filterText  Text te filter (in name field).
 * @apiParam {string} filterLocation  Text te filter (in name field).
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getAll = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var filterText = params.filterText || '';
    var sortField = params.sortField || 'lang.description';
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var filterLocation;
    var filterProvider;
    var filterLocationPipeline;
    var filterProviderPipeline;
    var filterIngPackPipeline;
    var filterNoExternalReference;
    var Ingredient = require('../models/ingredient')
    var Packaging = require('../models/packaging');
    var MeasurementUnit = require('../models/measurementUnit')

    waterfall([
        (cb) => {

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }

            //If an array of filter locations if provided, build the filter location pipeline
            filterLocationPipeline = {};
            if (filterLocation.length > 0) {
                filterLocationPipeline = {'location': {$in: filterLocation}}
            }

            //Filter by provider
            filterProviderPipeline = {};
            if(params.provider) {
              let providerId= new ObjectId(params.provider);
              filterProviderPipeline={'provider':providerId}
            }

            //Filter by ingredient or packaging
            filterIngPackPipeline = {};
            if(params.ing_pack) {
              let ing_packId= new ObjectId(params.ing_pack);
              filterIngPackPipeline={'category.item':ing_packId}
            } 

            //Filter by No External Reference
            filterNoExternalReference = {};
            if(params.noExternalReference) {
              filterNoExternalReference = {'externalReference': {$in: ['', null]}}
            } 

            cb(null, true)

        }, (ok, cb) => {

            Article.aggregate([
              {$match: filterProviderPipeline },
              { // Alternative to populate to use filters on aggregate
                "$lookup": {
                    "from": "providers",
                    "localField": "provider",
                    "foreignField": "_id",
                    "as": "provider"
                }
              },{ "$unwind": "$provider" },
              {$match: filterNoExternalReference },
              {$match: {'location': {$in: userLocIds}}},
              {$match: filterLocationPipeline},
              {$match: filterIngPackPipeline},
              {$match: {'lang.langCode': userProfile.user.language}},
              {$match: {
                $or: [
                  {'lang.description': {$regex: filterText, $options: 'i'} },
                  {'provider.commercialName': {$regex: filterText, $options: 'i'} },
                  {'reference': {$regex: filterText, $options: 'i'} },
                  {'netPrice' : Number(filterText) }
                ]
              }},
              {$sort: { [sortField] : sortOrder }},
              {$skip: Number(params.perPage)*Number(params.page)},
              {$limit: Number(params.perPage)}
            ], (err, docs) => {
                if(err) return cb(err);

                async.eachSeries(docs, (article, cb_async) => {

                	if(article.category.kind == 'ingredient'){

			              let opts = [
			                  { path: 'document' },
                        { path: 'packFormat' },                        
			                  { path: 'location' },
			                  { path: 'category.item', match: { 'lang.langCode': userProfile.user.language}, model: Ingredient}
			              ]

		                Article.populate(article, opts, (err, res) => {
		                    if (err) return cb_async(err)
		                    cb_async()
		                });

                	}
                	else if(article.category.kind == 'packaging')
                	{

			              let opts = [
			                  { path: 'document' },
                        { path: 'packFormat' },                        
			                  { path: 'location' },
			                  { path: 'category.item', match: { 'lang.langCode': userProfile.user.language}, model: Packaging}
			              ]

		                Article.populate(article, opts, (err, res) => {
		                    if (err) return cb_async(err)
		                    cb_async()
		                });	              

                	}

                }, (err) => {
                	if(err) return cb(err)
                	cb(null, docs)
                })

              })

        },(docs, cb) => { //Populate measurement unit

 	          let opts = [
              { path: 'category.item.measurementUnit'}
          	]        	

						MeasurementUnit.populate(docs, opts, (err, articles) => {
                if(err) return cb(err)

                //Filter measurement unit lang
                articles.forEach((article)=>{

                	if(article.category.item && article.category.item.measurementUnit) {

	                	let filteredLang = article.category.item.measurementUnit.lang.filter((lang) => {
	                		return lang.langCode == userProfile.user.language;
	                	})
	                	article.category.item.measurementUnit.lang = filteredLang;
	               	} else {
	               		if(!article.category.item) console.error('category.item is null for article with id %s!', article._id)
	               	  else console.error('measurementUnit is null for article with id %s!', article._id)
	               	}

                })
                cb(null, articles)
            });	

        },(docs, cb) => { //Create location text list

          let locationList;

          docs.forEach((article) => { 

            locationList = '';

            article.location.forEach((loc, index) => {

              if (index < article.location.length -1 )
                  locationList = locationList + loc.name + ', '
              else 
                locationList = locationList + loc.name
            })
            article.locationList = locationList;
          })

          cb(null, docs)

        },(docs, cb) => { //Map location array back to _ids

            docs.forEach((article) => {
              article.location = article.location.map((loc) => {
                return loc._id;
              })
            })

            cb(null, docs)   

        },(docs, cb) => { //run another search without limit, sort or skip to count docs

            Article.aggregate([
              {$match: filterProviderPipeline },
              { // Alternative to populate to use filters on aggregate
                "$lookup": {
                    "from": "providers",
                    "localField": "provider",
                    "foreignField": "_id",
                    "as": "provider"
                }
              },{ "$unwind": "$provider" },
              {$match: filterNoExternalReference },
              {$match: {'location': {$in: userLocIds}}},
              {$match: filterLocationPipeline},
              {$match: filterIngPackPipeline},
              {$match: {'lang.langCode': userProfile.user.language}},
              { $match: {
                $or: [
                  {'lang.description': {$regex: filterText, $options: 'i'} },
                  {'provider.commercialName': {$regex: filterText, $options: 'i'} }
                ]
              }}
            ], (err, docCount) => {
                if (err) return cb(err) 

                let article = {
                    'articles': docs,
                    'totalElements': docCount.length
                  };

                cb(null, article)                
              })

        }], (err, ok) => {    
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();   
        })
};


exports.articlesByProvider = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var filterText =  '';
    var sortName =  'comercialName';
    var sortDescription =  'lang.description';
    var sortOrder =  1;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var filterLocation;
    var filterProvider;
    var filterLocationPipeline;
    var filterIngPipeline;

    waterfall([
        (cb) => {


            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }

            //If an array of filter locations if provided, build the filter location pipeline
            filterLocationPipeline = {};
            if (filterLocation.length > 0) {
                filterLocationPipeline = {'location': {$in: filterLocation}}
            }

            //Filter by ingredient or packaging
            filterIngPipeline = {};
            if(params.id) {
              let ingId= new ObjectId(params.id);
              filterIngPipeline={'category.item':ingId}
            } 

            cb(null, true)

        }, (ok, cb) => {

            Article.aggregate([
              {$match: {'location': {$in: userLocIds}}},
              {$match: filterLocationPipeline},
              {$match: filterIngPipeline},
              {$match: {'lang.langCode': userProfile.user.language}},                          
              {$sort: { [sortDescription] : sortOrder }},
              { // Alternative to populate to use filters on aggregate
                "$lookup": {
                    "from": "providers",
                    "localField": "provider",
                    "foreignField": "_id",
                    "as": "provider"
                }
              },
              { "$unwind": "$provider" },
              { 
                $group : { 
                  _id : "$provider._id", 
                  comercialName: {"$first": "$provider.commercialName"}, 
                  description: {"$push": "$lang.description" }  
                } 
              }, 
              {$sort: { [sortName] : sortOrder }}

            ], (err, docs) => {
                // if(err) return cb(err);
                cb(null, docs)         
              })
        }], (err, docs) => {    
            if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(docs).end();   
        })
};


/**
 * @api {get} /article Get all articles
 * @apiGroup {article}
 * @apiName Get All
 *
 * @apiDescription Get all articles with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {int} provider  provider Id.
 * @apiParam {int} perPage  Recors per page.
 * @apiParam {int} page  Page number.
 * @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 * @apiParam {string} filterText  Text te filter (in name field).
 * @apiParam {string} filterLocation  Text te filter (in name field).
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.changeHasDataSheet = (req, res) => {

  console.log(req.query, 'req')
  let articleId = new ObjectId(req.query.id);
  let hasDataSheet = req.query.hasDataSheet;

  waterfall([
      (cb) => {
      if(mongoose.Types.ObjectId.isValid(articleId)) {  

          Article.findById(articleId, (err, doc) => {
                if (err) return cb(err)
                console.log(doc, 'doc')
                doc.hasDataSheet = hasDataSheet;
                doc.save((err, doc) => {
                  if(err) return cb(err)
                  cb(null, doc)
                })
            })
        } else {
          let err=new Error("Article id not valid");
          err.statusCode=400;
          return cb(err)
        }

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
    };

/**
 * @api {get} /article Get all articles
 * @apiGroup {article}
 * @apiName Get All
 *
 * @apiDescription Get all articles with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {int} provider  provider Id.
 * @apiParam {int} perPage  Recors per page.
 * @apiParam {int} page  Page number.
 * @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 * @apiParam {string} filterText  Text te filter (in name field).
 * @apiParam {string} filterLocation  Text te filter (in name field).
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.updateAllHasDataSheet = (req, res) => {
        let totalNumArticle;
        let articleCount = 0;

        var AWS = require('aws-sdk');

        AWS.config.accessKeyId = config.awsBucket.accessKey;
        AWS.config.secretAccessKey = config.awsBucket.secret;
        AWS.config.region = config.awsBucket.region;


        waterfall([
        (cb) => {
            Article.count({}, (err, count) => {
                if (err) return cb(err)
                totalNumArticle = count;
                console.log(totalNumArticle, 'totalNumArticle')
                cb(null)
            })
        }, (cb) => {
            async.during(
            (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
                return callback(null, articleCount < totalNumArticle);
            },
            (callback) => {
                Article
                    .findOne({})
                    .skip(articleCount)
                    .limit(1)
                    .exec((err, article) => {
                        if (err) callback(err)
                        articleCount++
                        var params = {
                            Bucket: config.awsBucket.bucketName,
                            Prefix: 'article/' + article._id,
                        };
                        var s3 = new AWS.S3;
                        s3.listObjectsV2(params, function(err, data) {
                            if (err) return cb(err)
                            if (data.KeyCount >0) article.hasDataSheet = true 
                            else if (data.KeyCount == 0) article.hasDataSheet = false
                            article.save((err) => {
                              if (err) return callback(err)
                              callback(null, true)
                            });
                        });
                      })
                    }, (err) => { // Finished looping through all ingredients
                        if (err) return cb(err)
                        cb(null, true)
                    })
            }
        ], (err, ok) => {
            if (err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
    };


  /**s
 * @api {get} /article/ingredient Get all ingredients
 * @apiGroup {provider}
 * @apiName Get All
 *
 * @apiDescription Get all ingredients
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {int} perPage  Recors per page.
 *  @apiParam {int} page  Page number.
 *  @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 *  @apiParam {string} filterText  Text te filter (in name field).
 *  @apiParam {string} filterLocation Locations to use for cost
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getIngredients = async (req, res) => {
  let userProfile = req.userData;
  let params = req.query;
  params.filterText = params.filterText || '';
  var sortField = params.sortField || 'lang.name';
  var sortOrder = Number(params.sortOrder) || 1;
  var filterLocation;
  var activePipeline;
  var quarteringPipeline;

    if (params.filterLocation) {
        filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
    } else {
        filterLocation = [];
    }

    activePipeline = {}
    if (params.active) {
        if (params.active == 'true') activePipeline = { active: true }
        else if (params.active == 'false') activePipeline = { active: false }
    }

    quarteringPipeline = {};
    if (params.noQuartering) quarteringPipeline = { quartering: null }

    try {
      const ingredients = await Ingredient.aggregate([
          { "$unwind": "$lang" },
          { $match: activePipeline },
          { $match: quarteringPipeline },
          { $match: { 'lang.langCode': userProfile.user.language } },
          { $match: { 'lang.name': { $regex: params.filterText, $options: 'i' } } },
          {
              $sort: {
                  [sortField]: sortOrder
              }
          },
          { $skip: Number(params.perPage) * Number(params.page) },
          { $limit: Number(params.perPage) }
      ])

      await Ingredient.populate(ingredients, { path: "gallery measurementUnit quartering" });
  
      data = {
        'ingredients': ingredients,
        'totalElements': ingredients.length
      };
      return res.status(200).json(data).end();        

    } catch (err) {
      return res.status(500).json(err.message || 'Error').end();
    }        

};