'use strict';
var async = require('async');
var locHelper = require('../helpers/locations');
var Selenta = require('../models/selenta');
var Article = require('../models/article');
var Provider = require('../models/provider');
var Family = require('../models/family');
var Subfamily = require ('../models/subfamily')
var {ObjectId} = require('mongodb');


/**
 * @api {get} /selentaImport/newArticles
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta SAP Articles
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} perPage  table items per page
 * @apiParam {string} page  table page
 * @apiParam {string} filterText  filter text by 'article.MAKTX'
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapNewArticles = (req, res) => {
    let params = req.query;
    var filterText = params.filterText || '';
    var perPage = params.perPage || 5;
    var page = params.page || 0;
    var sortField = params.sortField || 'article.MAKTX';
    var sortOrder = Number(params.sortOrder) || 1;

  async.waterfall([
    (cb) => {
      
      //Get selenta new sap articles (issue.type == 'article')
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'article'} },
        { $match: {
          $or: [
            {'article.MAKTX': {$regex: filterText, $options: 'i'} },
            {'article.PROVIDER.NAME1': {$regex: filterText, $options: 'i'} }
          ]
        }},
        { $sort: { [sortField] : sortOrder } },
        { $skip: Number(perPage)*Number(page) },
        { $limit: Number(perPage) }
      
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      })
    },(docs, cb) => { //run another search without limit, sort or skip to count docs

      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'article'} },
        { $match: {
          $or: [
            {'article.MAKTX': {$regex: filterText, $options: 'i'} },
            {'article.PROVIDER.NAME1': {$regex: filterText, $options: 'i'} }
          ]
        }}
      ], (err, docCount) => {
          if (err) return cb(err);
          
          let articles = {
              'articles': docs,
              'totalElements': docCount.length
            };

          cb(null, articles)                
        })
    }
    ], (err, articles) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(articles);
    }
  );
};

/**
 * @api {get} /selentaImport/newProviders
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta SAP Providers
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} perPage  table items per page
 * @apiParam {string} page  table page
 * @apiParam {string} filterText  filter text by 'provider.NAME1'
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapNewProviders = (req, res) => {
    let params = req.query;
    var filterText = params.filterText || '';
    var perPage = params.perPage || 5;
    var page = params.page || 0;
    var sortField = params.sortField || 'provider.NAME1';
    var sortOrder = Number(params.sortOrder) || 1;

  async.waterfall([
    (cb) => {
      
      //Get selenta new sap providers (issue.type == 'provider')
      Selenta.aggregate([
        { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'provider'} },
        { $match: {
          $or: [
            {'provider.NAME1': {$regex: filterText, $options: 'i'} }
          ]
        }},
        { $sort: { [sortField] : sortOrder } },
        { $skip: Number(perPage)*Number(page) },
        { $limit: Number(perPage) }
      
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      })
    },(docs, cb) => { //run another search without limit, sort or skip to count docs

      Selenta.aggregate([
        { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'provider'} },
        { $match: {
          $or: [
            {'provider.NAME1': {$regex: filterText, $options: 'i'} }
          ]
        }}
      ], (err, docCount) => {
          if (err) return cb(err) ;
          
          let providers = {
              'providers': docs,
              'totalElements': docCount.length
            };

          cb(null, providers)
        })
    }
    ], (err, providers) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(providers);
    }
  );
};



/**
 * @api {get} /selentaImport/deletedArticles
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta deleted SAP Articles
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} perPage  table items per page
 * @apiParam {string} page  table page
 * @apiParam {string} filterText filter text by 'article.MAKTX'
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapDeletedArticles = (req, res) => {      
    let params = req.query;
    var filterText = params.filterText || '';
    var perPage = params.perPage || 5;
    var page = params.page || 0;
    var sortField = params.sortField || 'article._id.lang.description';
    var sortOrder = Number(params.sortOrder) || 1;
    var filterLocation;
    var totalElements;
    var deletedArticles;
    var externalReferences;

  async.waterfall([
    (cb) => {

      //Filter locations
      if (params.filterLocation) {
          filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
      } else {
          filterLocation = [];
      }
      
      //Get selenta new sap articles (issue.type == 'deletedArticle')
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'deletedArticle'} },
        { // Alternative to populate to use filters on aggregate
          "$lookup": {
              "from": "articles",
              "localField": "article._id",
              "foreignField": "_id",
              "as": "article._id"
          }
        },{ "$unwind": "$article._id" },
        { // Populate article with provider
          "$lookup": {
              "from": "providers",
              "localField": "article._id.provider",
              "foreignField": "_id",
              "as": "article._id.provider"
          }
        },{ "$unwind": "$article._id.provider" },
        { $match: {'article._id.location': {$in: filterLocation}} },
        { $match: {
          $or: [
            {'article._id.lang.description': {$regex: filterText, $options: 'i'} },
            {'article._id.provider.commercialName': {$regex: filterText, $options: 'i'} }
          ]
        }},
        { $sort: { [sortField] : sortOrder } }
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      });

    },(docs, cb) => {

      //Deleted SAP articles references to check
      externalReferences = [];
      docs.forEach((doc)=>{
        externalReferences.push('000000000' + doc.article._id.externalReference);
      });

      //count Docs
      totalElements = docs.length;

      // $skip: Number(perPage)*Number(page)
      docs.splice(0,Number(perPage)*Number(page));

      // $limit: Number(perPage)
      deletedArticles = docs.slice(0,Number(perPage));

      let articles = {
        'deletedArticles': deletedArticles,
        'totalElements': totalElements
      };

      cb(null, articles)

    },(docs, cb) => { 

      //Check deleted SAP articles references
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'originalArticle'} },
        { $match: {'article.MATNR' : {$in: externalReferences} } }
      ], (err, conflicts) => {
        if (err) return cb(err);
        cb(null, docs);
      })

    }
    ], (err, articles) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(articles);
    }
  );
};


/**
 * @api {get} /selentaImport/deletedProviders
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta deleted SAP Providers
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} perPage  table items per page
 * @apiParam {string} page  table page
 * @apiParam {string} filterText filter text by 'article.MAKTX'
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapDeletedProviders = (req, res) => {
    let params = req.query;
    var filterText = params.filterText || '';
    var perPage = params.perPage || 5;
    var page = params.page || 0;
    var sortField = params.sortField || 'provider._id.commercialName';
    var sortOrder = Number(params.sortOrder) || 1;
    var filterLocation;
    var totalElements;
    var deletedProviders;
    var externalReferences;

  async.waterfall([
    (cb) => {

      //Filter locations
      if (params.filterLocation) {
          filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
      } else {
          filterLocation = [];
      }
      
      //Get selenta new sap articles (issue.type == 'deletedProvider')
      Selenta.aggregate([
        { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'deletedProvider'} },
        { // Alternative to populate to use filters on aggregate
          "$lookup": {
              "from": "providers",
              "localField": "provider._id",
              "foreignField": "_id",
              "as": "provider._id"
          }
        },{ "$unwind": "$provider._id" },
        { $match: {'provider._id.location': {$in: filterLocation}} },
        { $match: {
          $or: [
            {'provider._id.commercialName': {$regex: filterText, $options: 'i'} }
          ]
        }},
        { $sort: { [sortField] : sortOrder } }
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      })

    },(docs, cb) => { 

      //Deleted SAP Providers references to check
      externalReferences = [];
      docs.forEach((doc)=>{
        externalReferences.push(doc.provider._id.externalReference);
      });

      //count Docs
      totalElements = docs.length;

      // $skip: Number(perPage)*Number(page)
      docs.splice(0,Number(perPage)*Number(page));

      // $limit: Number(perPage)
      deletedProviders = docs.slice(0,Number(perPage));

      let articles = {
        'deletedProviders': deletedProviders,
        'totalElements': totalElements
      };

      cb(null, articles)

    },(docs, cb) => { 

      //Check deleted SAP providers references
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'originalArticle'} },
        { $match: {'article.PROVIDER.LIFNR' : {$in: externalReferences} } }
      ], (err, conflicts) => {
        if (err) return cb(err);
        console.log('CHECK DELETED PROVIDERS (0):', conflicts.length);
        cb(null, docs);
      })

    }
    ], (err, articles) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(articles);
    }
  );
};


/**
 * @api {delete} /selentaImport/newArticle
 * @apiGroup {selentaImport}
 * @apiName Delete selentaImport
 *
 * @apiDescription Delete a selenta SAP Article
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  selenta SAP Article id
 *
 * @apiSuccess {Object} Article removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.removeSelentaSapNewArticle = (req, res) => {
    let params = req.query;
    var selentaId = new ObjectId(params.articleId);
    var providerId = params.providerId;

    async.waterfall([
      (cb) => {
          Selenta.findById(selentaId, (err, doc) => {
              if (err) return cb(err)
              if (!doc) { 
                  var err=new Error('Document not found');
                  err.statusCode=400;
                  return cb(err);
              }
              cb(null,doc);
          });
      }, 
      (doc, cb) => {
          //Remove all object if only have one provider
          if(doc.article[0].PROVIDER && doc.article[0].PROVIDER.length < 2) {

              doc.remove(function (err, doc) {
                  if (err) return cb(err);
                  cb(null, doc);
              });
          //Remove provider from object if have more than one provider
          } else {

            doc.article[0].PROVIDER = doc.article[0].PROVIDER.filter(function( obj ) {
                return obj.LIFNR !== providerId;
            });

            doc.save((err, updatedDoc) => {
                if (err) return cb(err);
                cb(null, updatedDoc);
            });
          }
      }], 
      (err, ok) => {
        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
      })
    
}


/**
 * @api {delete} /selentaImport/newProvider
 * @apiGroup {selentaImport}
 * @apiName Delete selentaImport
 *
 * @apiDescription Delete a selenta SAP Article
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  selenta SAP Article id
 *
 * @apiSuccess {Object} Article removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.removeSelenta = (req, res) => {
    let params = req.query;
    var providerId = new ObjectId(params.providerId);

    async.waterfall([
      (cb) => {
          Selenta.findById(providerId, (err, doc) => {
              if (err) return cb(err)
              if (!doc) { 
                  var err=new Error('Document not found');
                  err.statusCode=400;
                  return cb(err);
              }
              cb(null,doc);
          });
      }, 
      (doc, cb) => {

          doc.remove(function (err, doc) {
              if (err) return cb(err);
              cb(null, doc);
          });
  }], 
      (err, ok) => {
        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
      })
    
}

/**
 * @api {get} /selentaImport/updatedArticles
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta updated SAP Articles
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapUpdatedArticles = (req, res) => {

  let params = req.query;
  var filterText = params.filterText || '';	

  async.waterfall([
    (cb) => {
      
      //Get selenta updated sap articles (issue.type == 'updatedArticle')
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : {$in: ['updatedArticle','updatedAllergens'] } } },
        { $match: {
          $or: [
            {'issue.description': {$regex: filterText, $options: 'i'} },
            {'article.MAKTX': {$regex: filterText, $options: 'i'} }, 
            {'article.MATNR': {$regex: filterText, $options: 'i'} } 
          ]
        }},
        { $sort: {'article.updatedDate' : -1 } }
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      })

    }
    ], (err, articles) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(articles);
    }
  );
};


/**
 * @api {get} /selentaImport/articlesConflicts
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta conflicts SAP Articles
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapArticlesConflicts = (req, res) => {

  let params = req.query;
  var filterText = params.filterText || '';

  async.waterfall([
    (cb) => {
      
      //Get selenta conflict sap articles (issue.type == 'noConvArticle' && 'mismatchUnitArticle')
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : {$in: ['noConvArticle','mismatchUnitArticle', 'costVariationWarning'] } } },
        { $match: {
          $or: [
            {'issue.description': {$regex: filterText, $options: 'i'} },
            {'article.MAKTX': {$regex: filterText, $options: 'i'} }, 
            {'article.MATNR': {$regex: filterText, $options: 'i'} } 
          ]
        }}
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      })

    }], (err, articles) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(articles);
    }
  );
};



/**
 * @api {get} /selentaImport/articles
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta SAP original Articles
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} perPage  table items per page
 * @apiParam {string} page  table page
 * @apiParam {string} filterText  filter text by 'article.MAKTX'
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapArticles = (req, res) => {
    let params = req.query;
    var filterText = params.filterText || '';
    var perPage = params.perPage || 5;
    var page = params.page || 0;
    var sortField = params.sortField || 'article.MATNR';
    var sortOrder = Number(params.sortOrder) || 1;

  async.waterfall([
    (cb) => {
      
      //Get selenta sap articles (issue.type == 'originalArticle')
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'originalArticle'} },
        { $match: {
          $or: [
            {'article.MATNR': {$regex: filterText, $options: 'i'} },
            {'article.MAKTX': {$regex: filterText, $options: 'i'} },
            {'article.PROVIDER.NAME1': {$regex: filterText, $options: 'i'} }
          ]
        }},
        { $sort: { [sortField] : sortOrder } },
        { $skip: Number(perPage)*Number(page) },
        { $limit: Number(perPage) }
      
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      });
    },(docs, cb) => {

      // Attach cookDesign Id of linked article
      async.eachSeries(docs, function(doc, cb_async) {
                
        Article.find({'externalReference':doc.article.MATNR.substring(9,18)}, (err, articles) => {
          if(err) return cb_async(err);
          if(articles.length<1) return cb_async();
          
          //Populate with provider
          Provider.populate(articles, {
            path:'provider',
            match: {
              'externalReference': doc.article.PROVIDER.LIFNR
            }
          }, (err, populatedArticles) => {
            if (err) return cb_async(err);
            if(articles.length<1) return cb_async();

            //delete article that populated filters not match
            populatedArticles = populatedArticles.filter((article)=>{
              return article.provider !== null
            })

            if(populatedArticles.length<1) return cb_async();

            doc.article.cookDesignId = populatedArticles[0]._id;
            cb_async();
          });
        });

      },(err)=>{
        if(err) return cb(err);
        cb(null, docs);
      });

       
    },(docs, cb) => { //run another search without limit, sort or skip to count docs

      Selenta.aggregate([
        { $match: {'issue.type' : 'originalArticle'} },
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {
          $or: [
            {'article.MATNR': {$regex: filterText, $options: 'i'} },
            {'article.MAKTX': {$regex: filterText, $options: 'i'} },
            {'article.PROVIDER.NAME1': {$regex: filterText, $options: 'i'} }
          ]
        }}
      ], (err, docCount) => {
          if (err) return cb(err);
          
          let articles = {
              'articles': docs,
              'totalElements': docCount.length
            };

          cb(null, articles)                
        })
    }
    ], (err, articles) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(articles);
    }
  );
};


/**
 * @api {get} /selentaImport/article
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta SAP original article
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapArticle = (req, res) => {
  let params = req.query;
  let id; //Can be either a cookDesign id or MATNR
  let pipeLine;
  let MATNR;
  let LIFNR;

  async.waterfall([
    (cb) => {

    	if(!params.MATNR) {
    		let err = new Error('Error: Must provide article MATNR!')
    		return cb(err)
    	}
    	else
    	{
    		if(params.MATNR.length > 9) MATNR = params.MATNR
    		else MATNR = '000000000' + params.MATNR
    	}

    	if(!params.LIFNR) {
    		let err = new Error('Error: Must provide article LIFNR!')
    		return cb(err)
    	}
    	else
    	{
    		LIFNR = params.LIFNR;
    	}

    	cb(null)

    },(cb) => {

      //Get selenta sap article
      Selenta.aggregate([
        { $match: {'issue.type' : 'originalArticle'}},
        { $match: { "article.MATNR": MATNR} },
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {"article.PROVIDER.LIFNR": LIFNR} }
      ], (err, doc) => {
        if (err) return cb(err);
        if(!doc || !doc.length) {
        	let err = new Error('Warning: Could not find article')
        	return cb(err)
        }
        cb(null, doc[0]);
      });

    }], (err, doc) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(doc);
    }
  );
};

/**
 * @api {get} /selentaImport/providers
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta SAP original Providers
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} perPage  table items per page
 * @apiParam {string} page  table page
 * @apiParam {string} filterText  filter text by 'provider.MAKTX'
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaSapProviders = (req, res) => {

  let params = req.query;
  var filterText = params.filterText || '';
  var perPage = params.perPage || 5;
  var page = params.page || 0;
  var sortField = params.sortField || 'NAME1';
  var sortOrder = Number(params.sortOrder) || 1;
  var providers = [];
  var totalElements;
  var filteredProviders;

  async.waterfall([
    (cb) => {
      
      //Get selenta sap articles (issue.type == 'originalArticle')
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'originalArticle'} },
        { $match: {
          $or: [
            {'article.PROVIDER.NAME1': {$regex: filterText, $options: 'i'} },
            {'article.PROVIDER.BLDAT': {$regex: filterText, $options: 'i'} },
            {'article.PROVIDER.LIFNR': {$regex: filterText, $options: 'i'} }
          ]
        }}
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      });

    },(docs, cb) => {

      // Create Providers array
      docs.forEach((doc)=>{
        providers.push(doc.article.PROVIDER);
      });

      //sort providers by id
      providers.sort(function(a,b) {return (a.LIFNR > b.LIFNR) ? 1 : ((b.LIFNR > a.LIFNR) ? -1 : 0);} );

      //delete duplicates
      providers = providers.filter(function(item, pos, ary) {
        return !pos || item.LIFNR != ary[pos - 1].LIFNR;
      });
      
      //count Docs
      totalElements = providers.length;

      //sort providers by sortField and sortOrder
      providers.sort(function(a,b) {return (a[sortField] > b[sortField]) ? sortOrder : ((b[sortField] > a[sortField]) ? -sortOrder : 0);} );

      // $skip: Number(perPage)*Number(page)
      providers.splice(0,Number(perPage)*Number(page));

      // $limit: Number(perPage)
      filteredProviders = providers.slice(0,Number(perPage));

      let object = {
        'providers': filteredProviders,
        'totalElements': totalElements
      };

      cb(null, object)

    },(docs, cb) => {

      // Attach cookDesign Id of linked provider
      async.eachSeries(docs.providers, function(doc, cb_async) {
                
        Provider.find({'externalReference':doc.LIFNR}, (err, providers) => {
          if(err) return cb_async(err);
          if(providers.length<1) return cb_async();

          doc.cookDesignId = providers[0]._id;
          cb_async();
        });

      },(err)=>{
        if(err) return cb(err);
        cb(null, docs);
      });

    }
    ], (err, providers) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(providers);
    }
  );
};


/**
 * @api {get} /selentaImport/family
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get selenta SAP original recipe families
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaRecipeFamilies = (req, res) => {

  let params = req.query;
  var filterText = params.filterText || '';
  var perPage = params.perPage || 5;
  var page = params.page || 0;
  var sortField = params.sortField || 'DESCRIPCIO';
  var sortOrder = Number(params.sortOrder) || 1;
  var recipeFamilies = [];
  var totalElements;
  var arrayFamiliesAndSubfamiliesInSelenta = [];
  var filteredRecipeFamilies;
  var families = [];
  var totalLength = 0;

  console.log(params,'params')
  console.log(filterText,'filterText')
  console.log(perPage,'perPage')
  console.log(page,'page')
  console.log(sortField,'sortField')
  console.log(sortOrder,'sortOrder')

  async.waterfall([
    (cb) => {
      
      //Get selenta sap articles (issue.type == 'originalArticle')
      Selenta.aggregate([
        { $unwind: { path: "$family", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'family'} },
        { $match: {
          $or: [
            {'family.DESCRIPCIO': {$regex: filterText, $options: 'i'} },
            {'family.GRUP_ARTICLES': {$regex: filterText, $options: 'i'}}
          ]
        }},  
        { $sort: { [sortField] : sortOrder } },
        { $skip: Number(perPage)*Number(page) },
        { $limit: Number(perPage) }
      ], (err, docs) => {
        if (err) return cb(err);
        //console.log(docs,'docsSelenta')
        cb(null, docs);
      });

    },(docs,cb)=>{

      Selenta.aggregate([
        { $unwind: { path: "$family", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'family'} },
        { $match: {
          $or: [
            {'family.DESCRIPCIO': {$regex: filterText, $options: 'i'} },
            {'family.GRUP_ARTICLES': {$regex: filterText, $options: 'i'}}
          ]
        }}
      ], (err, docCount) => {

          if (err) return cb(err) ;
          
          let count = [];

          docCount.forEach((doc)=>{

            if(doc.family.GRUP_ARTICLES){

              count.push(doc)

            }

          })

          totalLength = Number(count.length) ;
          //console.log(totalLength,'totalLengthSelenta')

          cb(null, docs)
        })

    },(docs, cb) => {

      docs.forEach((selentaFamily)=>{

        if(selentaFamily.family.GRUP_ARTICLES){

           arrayFamiliesAndSubfamiliesInSelenta.push(selentaFamily);

        } 

      })

      // console.log(docs.length,'docs.length')
      // console.log(arrayFamiliesAndSubfamiliesInSelenta.length,'arrayFamiliesAndSubfamiliesInSelenta')

      cb(null,docs)

    },(docs, cb) => {

      families = {
        selenta : arrayFamiliesAndSubfamiliesInSelenta,
        totalElements: totalLength
      }
      
      cb(null,families)

    }], (err, families) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(families);
    }
  );
};

/**
 * @api {get} /selentaImport/familyCookDesign
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Get cookDesign original recipe families
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.getSelentaCookDesignFamilies = (req, res) => {

  let params = req.query;
  var filterText = params.filterText || '';
  var perPage = params.perPage || 5;
  var page = params.page || 0;
  var sortField = params.sortField || 'lang.name';
  var sortOrder = Number(params.sortOrder) || 1;
  var recipeFamilies = [];
  var totalElements;
  var arrayFamiliesAndSubfamiliesInCookDesign = [];
  var filteredRecipeFamilies;
  var families = [];
  var totalLength = 0;

  // console.log(params,'params')
  // console.log(filterText,'filterText')
  // console.log(perPage,'perPage')
  // console.log(page,'page')
  // console.log(sortField,'sortField')
  // console.log(sortOrder,'sortOrder')

  async.waterfall([
    (cb) => {
      
      //Get selenta sap articles (issue.type == 'originalArticle')
      Selenta.aggregate([
        { $unwind: { path: "$family", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'family'} },
        { // Alternative to populate to use filters on aggregate
          "$lookup": {
              "from": "families",
              "localField": "family.familyId",
              "foreignField": "_id",
              "as": "family._id"
          }
        },
        { $unwind : { path: "$family.familyId", preserveNullAndEmptyArrays: true }},       
        { $match: {
          $or: [
            {'family.familyId.lang.name': {$regex: filterText, $options: 'i'} },
            {'family.externalCode': {$regex: filterText, $options: 'i'}}
          ]
        }},
        { $sort: { [sortField] : sortOrder } },
        { $skip: Number(perPage)*Number(page) },
        { $limit: Number(perPage) }
      ], (err, docs) => {
        if (err) return cb(err);
        //console.log(docs,'docsCookDesign')
        cb(null, docs);
      });

    },(docs,cb)=>{

      Selenta.aggregate([
        { $unwind: { path: "$family", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'family'} },
        { $match: {
          $or: [
            {'family.familyId.lang.name': {$regex: filterText, $options: 'i'} },
            {'family.externalCode': {$regex: filterText, $options: 'i'}}
          ]
        }}
      ], (err, docCount) => {
          if (err) return cb(err) ;
          
          let count = [];

          docCount.forEach((doc)=>{

            if(doc.family.externalCode && doc.family.externalCode.length){

              count.push(doc)

            }

          })

          totalLength = Number(count.length) ;
          //console.log(totalLength,'totalLengthCookDesign')

          cb(null, docs)
        })

    },(docs, cb) => {

      docs.forEach((selentaFamily)=>{

        if(selentaFamily.family.externalCode && selentaFamily.family.externalCode.length){

          arrayFamiliesAndSubfamiliesInCookDesign.push(selentaFamily);

        } 

      })

      // console.log(docs.length,'docs.length')
      // console.log(arrayFamiliesAndSubfamiliesInCookDesign.length,'arrayFamiliesAndSubfamiliesInCookDesign')

      cb(null,docs)

    },(docs,cb) => {

      Family.populate(arrayFamiliesAndSubfamiliesInCookDesign, {path:"family.familyId"},(err,docs)=>{
        if(err) return cb(err)
          cb(null,docs)
      })

    },(docs, cb) => {

      families = {
        cookDesign : arrayFamiliesAndSubfamiliesInCookDesign,
        totalElements: totalLength
      }
      
      //console.log(families,'families')
      cb(null,families)

    }], (err, families) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(families);
    }
  );
};


/**
 * @api {get} /selentaImport/downloadSapArticles
 * @apiGroup {selentaImport}
 * @apiName Get
 *
 * @apiDescription Download selenta SAP original Articles in a csv file
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {json} selentaImport obj
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 **/
exports.downloadSelentaSapArticles = (req, res) => {
    let params = req.query;
    var sortField = params.sortField || 'article.MATNR';
    var sortOrder = Number(params.sortOrder) || 1;
    var json2csv = require('json2csv');
    var fs = require('fs');
    var data = [];
 		var config = require('../config/config');

  async.waterfall([
    (cb) => {
      
      //Get selenta sap articles (issue.type == 'originalArticle')
      Selenta.aggregate([
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$article.PROVIDER", preserveNullAndEmptyArrays: true } },
        { $match: {'issue.type' : 'originalArticle'} },
        { $sort: { [sortField] : sortOrder } },
      ], (err, docs) => {
        if (err) return cb(err);
        cb(null, docs);
      });

    },(docs, cb) => {

      // Attach cookDesign Id of linked article
      async.eachSeries(docs, function(doc, cb_async) {
                
        Article.find({'externalReference':doc.article.MATNR.substring(9,18)}, (err, articles) => {
          if(err) return cb_async(err);
          if(articles.length<1) return cb_async();
          
          //Populate with provider
          Provider.populate(articles, {
            path:'provider',
            match: {
              'externalReference': doc.article.PROVIDER.LIFNR
            }
          }, (err, populatedArticles) => {
            if (err) return cb_async(err);
            if(articles.length<1) return cb_async();

            //delete article that populated filters not match
            populatedArticles = populatedArticles.filter((article)=>{
              return article.provider !== null
            })

            if(populatedArticles.length<1) return cb_async();

            doc.article.cookDesignId = populatedArticles[0]._id;
            cb_async();
          });
        });

      },(err)=>{
        if(err) return cb(err);
        cb(null, docs);
      });

    },(docs, cb) => {

			  var AWS = require('aws-sdk');
			  AWS.config.accessKeyId = config.awsBucket.accessKey;
			  AWS.config.secretAccessKey = config.awsBucket.secret;
			  AWS.config.region = config.awsBucket.region;
	      var s3 = new AWS.S3;

    	  async.eachSeries(docs, function(doc, cb_async) {

    	  	 if(doc.article.cookDesignId) {

			        var params = {
			          Bucket: 'cookdesign-prod',
			          Prefix: 'article/' + doc.article.cookDesignId,
			          MaxKeys: 1000
			        };

			        s3.listObjectsV2(params, function(err, data) {
			          if (err) return cb_async(err)
			          if(data.KeyCount > 0 ) doc.article.hasDatasheet = true; else doc.article.hasDatasheet=false;
			          cb_async()
			        }); 
			     }
			     else
			     {
			     	  cb_async();
			     }

	      },(err)=>{
		        if(err) return cb(err);
		        cb(null, docs);
	      });

    },(docs, cb) => {

    		docs.forEach((doc) => {

    				let selentaArticle = {};

  					selentaArticle.MATNR = doc.article.MATNR;
  					selentaArticle.MATKL = doc.article.MATKL;
  					selentaArticle.MAKTX = doc.article.MAKTX;
  					selentaArticle.MTART = doc.article.MTART;
  					selentaArticle.MSEH3 = doc.article.MSEH3;

    				selentaArticle.IDNLF = doc.article.PROVIDER.IDNLF;
						selentaArticle.LIFNR = doc.article.PROVIDER.LIFNR;
						selentaArticle.NAME1 = doc.article.PROVIDER.NAME1;
						selentaArticle.DMBTR = doc.article.PROVIDER.DMBTR;
						selentaArticle.BLDAT = doc.article.PROVIDER.BLDAT;
						selentaArticle.ERFMG = doc.article.PROVIDER.ERFMG;
						selentaArticle.ERFME = doc.article.PROVIDER.ERFME;
						selentaArticle.LOEVM = doc.article.PROVIDER.LOEVM;

    				selentaArticle.UMREN = '';
    				selentaArticle.MEINH = '';
    				selentaArticle.UMREZ = '';
    				selentaArticle.MEINS = '';

    				if(doc.article.UMA.length){

    					 doc.article.UMA.forEach((u, i)=>{
    					 			
    					 			let comma = doc.article.UMA.length-1 == i? '':' , ';

    					 			let UMREN = u.UMREN != ''? u.UMREN:'-';
    					 			let MEINH = u.MEINH != ''? u.MEINH:'-';
    					 			let UMREZ = u.UMREZ != ''? u.UMREZ:'-';
    					 			let MEINS = u.MEINS != ''? u.MEINS:'-';

    					 			selentaArticle.UMREN = selentaArticle.UMREN + UMREN + comma;
    					 			selentaArticle.MEINH = selentaArticle.MEINH + MEINH + comma;
    					 			selentaArticle.UMREZ = selentaArticle.UMREZ + UMREZ + comma;
    					 			selentaArticle.MEINS = selentaArticle.MEINS + MEINS + comma;    					 			
    					 })
    				}

    				selentaArticle.ZCEREALES_GLUT = '';
						selentaArticle.ZCRUSTACEOS = '';
						selentaArticle.ZHUEVOS = '';
						selentaArticle.ZPESCADOS = '';
						selentaArticle.ZCACAHUETES = '';
						selentaArticle.ZSOJA = '';
						selentaArticle.ZLACTEOS = '';
						selentaArticle.ZFRUTOS_SEC = '';
						selentaArticle.ZAPIO = '';
						selentaArticle.ZMOSTAZA = '';
						selentaArticle.ZSESAMO = '';
						selentaArticle.ZSULFITOS = '';
						selentaArticle.ZALTRAMUCES = '';
						selentaArticle.ZMOLUSCOS = '';
						selentaArticle.Z0MG = '';

    				if(doc.article.ALERGENOS && doc.article.ALERGENOS.length) {

  							selentaArticle.ZCEREALES_GLUT = doc.article.ALERGENOS[0].ZCEREALES_GLUT;
  							selentaArticle.ZCRUSTACEOS = doc.article.ALERGENOS[0].ZCRUSTACEOS;
  							selentaArticle.ZHUEVOS = doc.article.ALERGENOS[0].ZHUEVOS;
  							selentaArticle.ZPESCADOS = doc.article.ALERGENOS[0].ZPESCADOS;
  							selentaArticle.ZCACAHUETES = doc.article.ALERGENOS[0].ZCACAHUETES;
  							selentaArticle.ZSOJA = doc.article.ALERGENOS[0].ZSOJA;
  							selentaArticle.ZLACTEOS = doc.article.ALERGENOS[0].ZLACTEOS;
  							selentaArticle.ZFRUTOS_SEC = doc.article.ALERGENOS[0].ZFRUTOS_SEC;
  							selentaArticle.ZAPIO = doc.article.ALERGENOS[0].ZAPIO;
  							selentaArticle.ZMOSTAZA = doc.article.ALERGENOS[0].ZMOSTAZA;
  							selentaArticle.ZSULFITOS = doc.article.ALERGENOS[0].ZSULFITOS;
  							selentaArticle.ZALTRAMUCES = doc.article.ALERGENOS[0].ZALTRAMUCES;
  							selentaArticle.ZMOLUSCOS = doc.article.ALERGENOS[0].ZMOLUSCOS;
  							selentaArticle.Z0MG = doc.article.ALERGENOS[0].Z0MG;
    				}

    				selentaArticle.LINKED = doc.article.cookDesignId?  'SI' : 'NO';
    				selentaArticle.DATASHEET = doc.article.hasDatasheet?  'SI' : 'NO';

    				data.push(selentaArticle);
    		})

    		cb(null)

    },(cb) => {

        var fields = ['MATNR', 'MATKL', 'MAKTX', 'MTART', 'MSEH3', 'IDNLF', 'LIFNR', 'NAME1', 'DMBTR', 'BLDAT', 'ERFMG', 'ERFME', 'LOEVM' , 'UMREN', 'MEINH', 'UMREZ', 'MEINS', 'ZCEREALES_GLUT', 'ZCRUSTACEOS', 'ZHUEVOS', 'ZPESCADOS', 'ZCACAHUETES', 'ZSOJA', 'ZLACTEOS', 'ZFRUTOS_SEC', 'ZAPIO', 'ZMOSTAZA', 'ZSESAMO', 'ZSULFITOS', 'ZALTRAMUCES', 'ZMOLUSCOS', 'Z0MG', 'LINKED', 'DATASHEET'];
        var fieldNames = ['MATNR', 'MATKL', 'MAKTX', 'MTART', 'MSEH3', 'PROVIDER - IDNLF', 'PROVIDER - LIFNR', 'PROVIDER - NAME1', 'PROVIDER - DMBTR', 'PROVIDER - BLDAT', 'PROVIDER - ERFMG', 'PROVIDER - ERFME', 'PROVIDER - LOEVM', 'UMA - UMREN', 'UMA - MEINH', 'UMA - UMREZ', 'UMA - MEINS', 'ALERGENOS - ZCEREALES_GLUT', 'ALERGENOS - ZCRUSTACEOS', 'ALERGENOS - ZHUEVOS', 'ALERGENOS - ZPESCADOS', 'ALERGENOS - ZCACAHUETES', 'ALERGENOS - ZSOJA', 'ALERGENOS - ZLACTEOS', 'ALERGENOS - ZFRUTOS_SEC', 'ALERGENOS - ZAPIO', 'ALERGENOS - ZMOSTAZA', 'ALERGENOS - ZSESAMO', 'ALERGENOS - ZSULFITOS', 'ALERGENOS - ZALTRAMUCES', 'ALERGENOS - ZMOLUSCOS', 'ALERGENOS - Z0MG', 'ARTICULO VINCULADO', 'FICHA TECNICA'];

        json2csv({ data: data, fields: fields, fieldNames: fieldNames }, (err, csv) => {
            if (err) return cb(err);

            fs.writeFile('/tmp/selentaSapArticles.csv', csv, (err) => {
                if (err) return cb(err);
                cb(null)
            });
        });
      
    }], (err) => {
   		if(err) return res.status(500).json(err.message || 'Error').end();
   		console.log('Finished downloadSelentaSapArticles!')
      res.status(200).json().end();
    }
  );
};




