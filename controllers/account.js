 var waterfall = require('async-waterfall');
 var locHelper = require('../helpers/locations');
 var fs = require('fs');
 var async = require('async');
 require('../models/account');
 var Account = require('../models/account');
 var {ObjectId} = require('mongodb');
 var mongoose = require('../node_modules/mongoose');

/**
 * @api {get} /account/detail Get account info
 * @apiGroup {account}
 * @apiName Get account
 *
 * @apiDescription Get information about account
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id?  Account id
 *
 * @apiSuccess {Object} Account info
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getAccount = (req, res) => {
    //Get account information.
    let userProfile = req.userData;
    let params = req.query;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return doc._id; }); //Array of ObjectId
    var subproductLocations;

    waterfall([
        (cb) => {	
        	let userProfile = req.userData;

            let pipeline = {};

            if (req.query._id) {
                pipeline = { '_id': req.query._id } //find by account _id (default option if param _id is provided)
            } else {
                pipeline = { 'user': userProfile.user._id } //find by user _id
            } 

            Account.findOne(pipeline, {
            	name: true,
            	active: true,
            	user: true,
            	location: true,
            	role: true,
            	checkLocOnLogin: true
            })
            .populate('user role')
            .exec((err, doc) => {
                if (err) cb(err)
                cb(null, doc)
            })

         }], (err, doc) => {
            if (err) {
                return res.status(500).json(err).end();
            } else if (!doc) {
                return res.status(404).json(doc).end();
            }
            res.status(200).json(doc);
    });
};


 /**
 * @api {post} /account Create account
 * @apiGroup {account}
 * @apiName Create account
 *
 * @apiDescription Create account
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Location-Example:
 *     {
 *      "name" : "Miquel account",
 *      "user" : "57e014c61ba87743ea281b51",
 *      "role" : "578e4c89131a7f624f2b9086",
 *      "location" : "57fb67f3be547f474b31b4ce"
 *      }
 *
 * @apiSuccess {Object} Account info
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.addAccount = (req, res) => {
    //Get account information.
    let userProfile = req.userData;

    waterfall([
        (cb) => {   
            var data = req.body;
            var account = new Account({
                name: data.name,
                user: data.user,
                role: data.role,
                location: data.location,
                checkLocOnLogin: data.checkLocOnLogin
            });

            account.save(function (err) {
                if (err) {
                    return cb(err)

                } else {
                    cb(null, account);

                }
            });

         }], (err, doc) => {
        if (err) {
            return res.status(500).json(err).end();
        } else if (!doc) {
            return res.status(404).json(doc).end();
        }
        res.status(200).json(doc);
    });
};


 /**
 * @api {get} /account Get user accounts
 * @apiGroup {account}
 * @apiName Create account
 *
 * @apiDescription Get user accounts
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id?  Account id
 *
 * @apiSuccess {Object} Account info
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getUserAccounts = (req, res) => {
    let params = req.query;
    var filterText = params.filterText || '';
    var sortField = params.sortField || 'name';
    var sortOrder = Number(params.sortOrder) || 1;
    let userProfile = req.userData;
    var userId;
    var skip;
    var limit;
    var filterActivePipeline;

    if(params._id) userId = new ObjectId(params._id);    
    else userId = new ObjectId(userProfile.user._id);

    if(params.perPage && params.page) skip=Number(params.perPage)*Number(params.page); else skip=0;
    if(params.perPage) limit=Number(params.perPage); else limit=0;

    if(params.activeFilter) {
      pipeline={
        'user' : userId,
        'name': {$regex: filterText, $options: 'i'},
        'deleted': false,  
        'active' : true    
      }
    } else { 
      pipeline={
        'user' : userId,
        'name': {$regex: filterText, $options: 'i'},
        'deleted': false
      }
    }

    waterfall([
        (cb) => {   
          Account.find(
          pipeline,
          {
            'name':true,
            'user': true,
            'role': true,
            'location': true,
            'active': true,
            'checkLocOnLogin': true
          })
          .sort({[sortField]:sortOrder})
          .skip(skip)
          .limit(Number(params.perPage))
          .populate('role user')
          .exec( (err, account) => {
            if(err) return cb(err)
            cb(null, account)
          })
    }, (doc,cb)=> {
            Account.count(
             pipeline)
            .exec((err, count) => {
                if (err) return cb(err)
                let data = {
                  account: doc,
                  totalElements: count
                }
                cb(null, data)
            });

    }], (err, doc) => {
        if (err) {
            return res.status(500).json(err).end();
        } else if (!doc) {
            return res.status(404).json(doc).end();
        }
        res.status(200).json(doc);
    });
};

/**
 * @api {put} / Edit account
 * @apiGroup {account}
 * @apiName Edit account
 *
 * @apiDescription Update account information.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Request-Example:
 * {
 *     "_id": "5BA8e04a6df598f322f0aaCD2"
 *     "name": "Miquel Fonolleda"
 *      ...
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.editAccount = (req, res) => {
  var userData = req.userData;
  let updatedAccount = req.body;
  let accountId = new ObjectId(updatedAccount._id);

  console.log(updatedAccount, 'updatedAccount')

  waterfall([
      (cb) => {
      
      if(mongoose.Types.ObjectId.isValid(accountId)) {  

          Account.findById(accountId, (err, doc) => {
              if (err) cb(err);
              if (!doc) {
                  let err=new Error("Document not found");
                  err.statusCode=404;
                  return cb(err)
              }
             cb(null,doc);     
          });
        } else {
          let err=new Error("User id not valid");
          err.statusCode=400;
          return cb(err)
        }

      }, (doc, cb) => {

            Account.findById(accountId)
            .exec((err,doc)=>{
              if(err) cb(err)

                doc.name=updatedAccount.name;
                doc.active=updatedAccount.active;
                doc.role=updatedAccount.role;
                doc.location=updatedAccount.location;
                doc.user=doc.user;
                doc.checkLocOnLogin = updatedAccount.checkLocOnLogin;

                doc.save((err,doc) => {
                if (err) return cb(err)
                  cb(null, doc)
              })
            })

    }], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};

/**
 * @api {delete} /account Delete account
 * @apiGroup {account}
 * @apiName Delete account
 *
 * @apiDescription Delete an account
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  account id
 *
 * @apiSuccess {Object} account removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.remove = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var accountId = new ObjectId(params._id);

    waterfall([
        (cb) => {     

        if(mongoose.Types.ObjectId.isValid(accountId)) {  
            Account.findById(accountId, (err, doc) => {
                if (err) return cb(err);
                if (!doc) {
                    var err = new Error('Document not found')
                    err.statusCode = 404;
                    return cb(err);
                }
               cb(null,doc);
            })
        } else {
            var err = new Error('Invalid Object Id');
            err.statusCode=400;
            return cb(err)
        }        
    }, (doc, cb) => {
          doc.deleted=true;             
          doc.save((err,doc) => {
              if (err) return cb(err)
                cb(null, doc)
          })
          // doc.remove((err,doc) => {
          //     if (err) return cb(err)
          //     cb(null, doc)
          // })            
    }], (err, ok) => {       
        	if(err) return res.status(500).json(err.message || 'Error').end();
          res.status(200).json(ok).end();
    })
}