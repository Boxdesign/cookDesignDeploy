 var waterfall = require('async-waterfall');
 var locHelper = require('../helpers/locations');
 var mongoose = require('../node_modules/mongoose');
 var fs = require('fs');
 var async = require('async');
 var Provider = require('../models/provider');
 var Ingredient = require('../models/ingredient');
 var {ObjectId} = require('mongodb');
 var config = require('../config/config');
 var assert = require('assert');


/**
 * @api {post} /provider Add new provider
 * @apiGroup {provider}
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
    var inProvider = req.body;

    inProvider.last_account = account._id;
    var provider = new Provider(inProvider);

    provider.save((err, doc) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc);
    });
};

/**
 * @api {put} /provider Edit provider
 * @apiGroup {provider}
 * @apiName Edit
 *
 * @apiDescription Replaces provider
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
  let updatedProvider = req.body;
  let providerId = new ObjectId(updatedProvider._id);
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var Article = require('../models/article');
  var providerLocations;
  var deletedLocations=[];
  var failedArticle = [];
  var match;
  var matchLocation;


  waterfall([
      (cb) => {
      
      if(mongoose.Types.ObjectId.isValid(providerId)) {  

          Provider.findById(providerId, (err, doc) => {
              if (err) return cb(err);
              if (!doc) {
                  let err=new Error("Document not found");
                  err.statusCode=404;
                  return cb(err)
              }
              providerLocations=doc.location;
              //Check whether list of subproduct locations includes at least one customer location.
              
              var match = providerLocations.find((id) => {
                  let locId = new ObjectId(id);
                  for(var i=0; i<userLocIds.length; i++) {
                      if (userLocIds[i].equals(locId)) return true;
                  }
              });
              if (match) { cb(null, match); }
              else { 
                  var err = new Error('Access to provider location is not allowed');
                  err.statusCode=400;
                  return cb(err); 
              }
          });

        } else {
          let err=new Error("Provider id not valid");
          err.statusCode=400;
          return cb(err)
        }

      }, (doc, cb) => { 
      //Check whether locations have been deleted. If so, check that there aren't any articles with only one of these locations
      //in which case they would be left without a location it it were to be deleted. If that's the case, return an error. Otherwise 
      //a provider post-save hook will trigger a job to delete the location(s) on all the provider articles.

        Provider.findById(providerId)
        .exec((err, provider)=>{
          if(err) return cb(err)
          locHelper.deletedLocations(updatedProvider.location, provider.location, (res) => {
            deletedLocations = res;
            if (deletedLocations && deletedLocations.length > 0) {
              Article.find({'provider':providerId})
              .exec((err,articles) => {               
                if(err) return cb(err)
                articles.forEach((article, index) => {
                  if (article.location.length <= deletedLocations.length) {
                  matchLocation=0
                    article.location.forEach((loc, index) => {                      
                      if (locHelper.findLocations(deletedLocations, loc)>-1) matchLocation++                     
                    })
                  if (matchLocation==article.location.length) failedArticle.push(article.lang[0].description)
                  }
                })
                if (failedArticle.length>0) {
                  failedArticleString = failedArticle.toString().replace(/,/g, ", ");
                  let err = new Error('There are some items that will remain without localization: ' + failedArticleString); 
                  return cb(err)
                } else {
                  cb(null, doc)
                }
              })
            } else cb(null, doc)      
          })
        })
      }, (doc, cb) => {
            updatedProvider.last_account = userData._id;

            Provider.findById(providerId)
            .exec((err,doc)=>{
              if(err) return cb(err)
              	
              doc.commercialName=updatedProvider.commercialName;
              doc.legalName=updatedProvider.legalName;
              doc.address=updatedProvider.address;
              doc.contact=updatedProvider.contact;
              doc.document=updatedProvider.document;
              doc.identification=updatedProvider.identification;
              doc.email=updatedProvider.email;
              doc.url=updatedProvider.url;
              doc.telephone=updatedProvider.telephone;
              doc.approved=updatedProvider.approved;
              doc.provider=updatedProvider.provider;
              doc.creditor=updatedProvider.creditor;
              doc.taxId = updatedProvider.taxId;
              doc.active=updatedProvider.active;
              doc.externalReference=updatedProvider.externalReference;
              doc.location=updatedProvider.location;
              doc.last_account=updatedProvider.last_account;
              
              doc.save((err,doc) => {
                if (err) return cb(err)
                  cb(null, doc)
              })
            })

    }], (err, ok) => {
        if (err) res.status(err.statusCode || 500).json(err.message).end();
        return res.status(200).json(ok).end();
    })
};


/**
 * @api {get} /provider/detail Get provider
 * @apiGroup {provider}
 * @apiName Get
 *
 * @apiDescription Gets provider
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
 * @apiSuccess {json} Provider obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.get = (req, res) => {
  var userData = req.userData;
  let params = req.query;
  let providerId = new ObjectId(params._id);
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var providerLocations;

  waterfall([
      (cb) => {
      
      if(mongoose.Types.ObjectId.isValid(providerId)) {  

          Provider.findById(providerId, (err, doc) => {
              if (err) return cb(err);
              if (!doc) {
                  let err=new Error("Document not found");
                  err.statusCode=404;
                  return cb(err)
              }
              providerLocations=doc.location;
              //Check whether list of subproduct locations includes at least one customer location.
              
              var match = providerLocations.find((id) => {
                  let locId = new ObjectId(id);
                  for(var i=0; i<userLocIds.length; i++) {
                      if (userLocIds[i].equals(locId)) return true;
                  }
              });
              if (match) { cb(null, match); }
              else { 
                  var err = new Error('Access to provider location is not allowed');
                  err.statusCode=400;
                  return cb(err); 
              }
          });

        } else {
          let err=new Error("Provider id not valid");
          err.statusCode=400;
          return cb(err)
        }

      }, (doc, cb) => {
            Provider.findById(providerId)
            .populate('document')
            .exec((err,doc) => {
              if(err) return cb(err)
              cb(null, doc)
            })

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};


/**
 * @api {delete} /provider Delete provider
 * @apiGroup {provider}
 * @apiName Delete provider
 *
 * @apiDescription Delete a provider
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  provider id
 *
 * @apiSuccess {Object} Provider removed
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
    var providerLocations;
    var providerId = new ObjectId(params._id);

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the gastroOffer's locations      

        if(mongoose.Types.ObjectId.isValid(params._id)) {  
            Provider.findById(providerId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }
                //Check whether list of gastroOffer locations includes at least one customer location.
                providerLocations=doc.location;
                
                var match = providerLocations.find((id) => {
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
        //remove provider
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
 * @api {get} /provider Get all providers
 * @apiGroup {provider}
 * @apiName Get All
 *
 * @apiDescription Get all providers with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
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
    var sortField = params.sortField || 'commercialName';
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var filterLocation;
    var filterLocationPipeline;
    var filterNoExternalReference;
  	var activePipeline;

    waterfall([
        (cb) => {

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }    

		        activePipeline={}
		        if (params.active)  {
		        	if(params.active == 'true') activePipeline =  { active: true }
		        	else if (params.active == 'false') activePipeline =  { active: false }
		        }            

            //If an array of filter locations if provided, build the filter location pipeline
            filterLocationPipeline = {};
            if (filterLocation.length > 0) {
                filterLocationPipeline = {'location': {$in: filterLocation}}
            }

            //Filter by No External Reference
            filterNoExternalReference = {};
            if(params.noExternalReference) {
              filterNoExternalReference = {'externalReference': {$in: ['', null]}}
            }

            cb(null, true)

        }, (ok, cb) => {

            Provider.aggregate([
              {$match: filterNoExternalReference },
              {$match: {'location': {$in: userLocIds}}},
              {$match: filterLocationPipeline},
        			{$match: activePipeline},
              { $match: {
                $or: [
                  {'commercialName': {$regex: filterText, $options: 'i'} }
                ]
              }},
              {$sort: { [sortField] : sortOrder }},
              {$skip: Number(params.perPage)*Number(params.page)},
              {$limit: Number(params.perPage)}
            ], (err, docs) => {
                if (err) return cb(err);

                Provider.populate(docs, {path: "document location"}, (err, docs) => {
                    if (err) return cb(err)
                    cb(null, docs)
                });
              })

        },(docs, cb) => { //Create location text list

          let locationList;

          docs.forEach((provider) => { 

            locationList = '';

            provider.location.forEach((loc, index) => {

              if (index < provider.location.length -1 )
                  locationList = locationList + loc.name + ', '
              else 
                locationList = locationList + loc.name
            })
            provider.locationList = locationList;
          })

          cb(null, docs)

        },(docs, cb) => { //Map location array back to _ids

            docs.forEach((provider) => {
              provider.location = provider.location.map((loc) => {
                return loc._id;
              })
            })

            cb(null, docs)             
            
        },(docs, cb) => {

            //Get total number of elements for pagination
            Provider.aggregate([
              {$match: filterNoExternalReference },
              {$match: {'location': {$in: userLocIds}}},
              {$match: filterLocationPipeline},
        			{$match: activePipeline},
              { $match: {
                $or: [
                  {'commercialName': {$regex: filterText, $options: 'i'} }
                ]
              }}
            ], (err, docCount) => {
                if (err) return cb(err)
                  
                let provider = {
                  'providers': docs,
                  'totalElements': docCount.length
                };

                cb(null, provider)
            })

        }], (err, ok) => {    
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();   
        })
};