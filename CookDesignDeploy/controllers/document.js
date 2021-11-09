
 var waterfall = require('async-waterfall');
 var async = require('async');
 var config = require('../config/config');
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.document;

/**
 * @api {post} /uploadFile ...
 * @apiGroup {document}
 * @apiName Get All
 *
 * @apiDescription ...
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} ...  
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.uploadFile = (req, res) => {
  let folderPath = req.body.folderPath || null;
  let id = req.body.id || null;
  let fileObject = req.file;
  var AWS = require('aws-sdk');

  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

  var fs = require('fs-extra');
  var d = new Date();
  var n = d.toISOString();

  async.waterfall([

    (cb) => {

      fs.readFile(fileObject.path, (err, buffer) => {
        if(err) return cb(err)
        var s3obj = new AWS.S3({
          params: {
            Bucket: config.awsBucket.bucketName,
            Key: folderPath,
            ContentType: 'application/zip',
            ACL: 'private',
            Body: buffer,
            Metadata: {id: id}
          }
        })
        cb(null, s3obj)
      })

    }, (s3obj, cb) => {
      s3obj.upload().send((err,data) => {
        if(err) return cb(err)
        cb(null, data)
      });

    }], (err, doc) => {
      if (err) res.status(err.statusCode || 500).json(err.message).end();
      return res.status(200).json(doc).end();
    })
};


/**
 * @api {get} /listFiles ...
 * @apiGroup {document}
 * @apiName Get All
 *
 * @apiDescription ...
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} ...  
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.listFiles = (req, res) => {  
  var AWS = require('aws-sdk');
  var prefix = req.query.prefix
  var itemsPerPage = req.query.itemsPerPage
  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

  waterfall([
      (cb) => {
        var params = {
          Bucket: config.awsBucket.bucketName,
          Prefix: prefix,
          MaxKeys: itemsPerPage
          // ,
          // continuationToken: continuationToken     
        };
        var s3 = new AWS.S3;
        s3.listObjectsV2(params, function(err, data) {
          if (err) return cb(err)
          cb(null, data)
        });      

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })  
};


/**
 * @api {get} /getFile ...
 * @apiGroup {document}
 * @apiName Get All
 *
 * @apiDescription ...
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} ...  
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getFile = (req, res) => {  
  var AWS = require('aws-sdk');
  var key = req.query.key

  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

  waterfall([
      (cb) => {
        var params = {
          Bucket: config.awsBucket.bucketName,
          Key: key
        };
        var s3 = new AWS.S3;
        s3.getObject(params, function(err, data) {
          if (err) return cb(err)
          cb(null, data)
        });      

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })  
};


/**
 * @api {delete} /deleteFile ...
 * @apiGroup {document}
 * @apiName Get All
 *
 * @apiDescription ...
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} ...  
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.deleteFile = (req, res) => {  
  var AWS = require('aws-sdk');
  var key = req.query.key

  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

  waterfall([
      (cb) => {
        var params = {
          Bucket: config.awsBucket.bucketName,
          Key: key
        };
        var s3 = new AWS.S3;
        s3.deleteObject(params, function(err, data) {
          if (err) return cb(err)
          cb(null, data)
        });      

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })  
};

/**
 * @api {get} /changeName ...
 * @apiGroup {document}
 * @apiName Get All
 *
 * @apiDescription ...
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} ...  
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.changeName = (req, res) => {  
  var AWS = require('aws-sdk');
  var name = req.query.name
  var newName = req.query.newName
  var originalKey = req.query.key
  var newKey = originalKey.replace(name, newName)
  var copySource = '/'+ config.awsBucket.bucketName +'/'+ originalKey 
  copySource = encodeURI(copySource)

  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;

  waterfall([
      (cb) => { //copy file

  //       var params = {
  //         Bucket: config.awsBucket.bucketName,
  //         Key: originalKey
  //       };
  //       var s3 = new AWS.S3;
  //       s3.getObject(params, function(err, data) {
  //         if (err) return cb(err)
  //           console.log(data, 'data')
  //         cb(null, data)
  //       }); 

  // }, (docs, cb) => { //delete file
        var params = {
            Bucket: config.awsBucket.bucketName,
            CopySource: copySource ,
            Key: newKey,
            ACL: 'private'
          };
          var s3 = new AWS.S3;
          s3.copyObject(params, function(err, data) {
            if (err) return cb(err);
            cb(null, true);
          });    

  }, (docs, cb) => { //delete file
       var params = {
          Bucket: config.awsBucket.bucketName,
          Key: originalKey
        };
        var s3 = new AWS.S3;
        s3.deleteObject(params, function(err, data) {
          if (err) return cb(err)
          cb(null, true)
        });      


    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })  
};


/**
 * @api {get} /changeProviderFiles ...
 * @apiGroup {document}
 * @apiName Get All
 *
 * @apiDescription ...
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} ...  
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.changeProviderFiles = (req, res) => {
  var AWS = require('aws-sdk');
  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;
 	var Provider = require('../models/provider');


  waterfall([
  (cb) => {

      Provider.find()
      .populate('document')
      .exec((err,doc) => {
        if(err) return cb(err)
        cb(null, doc)
    })

  }, (docs, cb) => {
    async.eachSeries(docs, (provider, cb_async_1) => {
      if (provider.document && provider.document.length) {
        async.eachSeries(provider.document, (doc, cb_async_2) => {
          var params = {
            Bucket: config.awsBucket.bucketName,
            CopySource: doc.value.url,
            Key: 'provider/'+ provider._id + '/' + doc.label,
            ACL: 'private'
          };
          var s3 = new AWS.S3;
          s3.copyObject(params, function(err, data) {
            if (err) return cb_async_2(err);
            cb_async_2();
          });
        }, (err) => {
          if(err) return cb_async_1(err)
          cb_async_1()
        })
      }
      else
      {
       process.nextTick(() => cb_async_1());      
      }
    }, (err) => { //Finished loop
      if(err) return cb(err)
      cb(null, true)

    })                     
  }], (err, ok) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(ok).end();
  })
};

/**
 * @api {get} /changeArticleFiles ...
 * @apiGroup {document}
 * @apiName Get All
 *
 * @apiDescription ...
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} ...  
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.changeArticleFiles = (req, res) => {
  var AWS = require('aws-sdk');
  AWS.config.accessKeyId = config.awsBucket.accessKey;
  AWS.config.secretAccessKey = config.awsBucket.secret;
  AWS.config.region = config.awsBucket.region;
 	var Article = require('../models/article');

 	logger.info('Document - changeArticleFiles - Entering changeArticleFiles method...')


  waterfall([
  (cb) => {

      Article.find()
      .populate('document')
      .exec((err,doc) => {
        if(err) return cb(err)
        logger.info('Document - changeArticleFiles - Obtained list of articles')
        cb(null, doc)
    })

  }, (docs, cb) => {

    async.eachSeries(docs, (article, cb_async_1) => {
      if (article.document && article.document.length) {
        async.eachSeries(article.document, (doc, cb_async_2) => {
          var params = {
            Bucket: config.awsBucket.bucketName,
            CopySource: doc.value.url,
            Key: 'article/'+ article._id + '/' + doc.label,
            ACL: 'private'
          };
          var s3 = new AWS.S3;
          s3.copyObject(params, function(err, data) {
            if (err) return cb_async_2(err);
            cb_async_2();
          });
        }, (err) => {
          if(err) return cb_async_1(err)
          cb_async_1()
        })
      }
      else
      {
       process.nextTick(() => cb_async_1());      
      }
    }, (err) => { //Finished loop
      if(err) return cb(err)
      logger.error('Document - changeArticleFiles - Finished moving all documents in provider articles')
      cb(null, true)

    })                     
  }], (err, ok) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
      res.status(200).json(ok).end();
  })
};

