// var mongoose = require('mongoose');
//
// mongoose.createConnection('mongodb://localhost/test');

var waterfall = require('async-waterfall');
var User = require('../models/user');
var Account = require('../models/account');
var {ObjectId} = require('mongodb');
var mongoose = require('../node_modules/mongoose');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.server;

//Creacion de usuarios
exports.create = (req, res) => {
    waterfall([
        (cb) => {
            var account = req.userData;
            var data = req.body;
            var last_account = account._id;

            var user = new User({
                email: data.email,
                password: data.password,
                firstName: data.firstName,
                lastName: data.lastName,
                gallery:data.gallery,
                active: data.active,
                last_account: last_account,
                language:data.language
            });
            user.save(function (err, doc) {
                if (err) return cb(err)
                cb(null, doc);
            });
        }

        // //Le creamos una cuenta SuperAdmin por defecto
        // (user, cb) => {
        //     var account = new Account({
        //         name: 'Default - ' + user.email,
        //         user: user._id
        //     });

        //     account.save((err) => {
        //         if (err) {
        //             res.status(400).end();
        //         } else {
        //             res.json(user);

        //         }
        //     })

        // }
    ], (err, doc) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(doc).end();
    })


};

/**
 * @api {get} /user Get all users
 * @apiGroup {user}
 * @apiName Get All
 *
 * @apiDescription Get all users with pagination, ordering and filters
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
    var sortField = params.sortField || 'firstName';
    var sortOrder = Number(params.sortOrder) || 1;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var filterLocation;
   

    waterfall ([
        (cb) => {

            // if (params.filterLocation) {
            //     filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            // } else {
            //     filterLocation = [];
            // }

            //If an array of filter locations if provided, build the filter location pipeline
            // let filterLocationPipeline = {};
            // if (filterLocation.length > 0) {
            //     filterLocationPipeline = {'location': {$in: filterLocation}}
            // }

            User.aggregate([
              {$match: {'deleted': false}},
              {$match: { 
                $or: [
                  {'firstName': {$regex: filterText, $options: 'i'}}, 
                  {'lastName': {$regex: filterText, $options: 'i'}},
                  {'email': {$regex: filterText, $options: 'i'}}
                ]
              }},
              {$sort: { [sortField] : sortOrder }},
              {$skip: Number(params.perPage)*Number(params.page)},
              {$limit: Number(params.perPage)}
            ], (err, docs) => {
                if (err) cb(err)
                   User.populate(docs, {path: "gallery"}, (err, docs) => {
                        if (err) {
                            return cb(err)
                        }
                        cb(null, docs)
                     });
            })
        },(docs, cb) => {
            //Get total number of elements for pagination
            let countPipeline = {
                  $or: [
                    {'firstName': {$regex: filterText, $options: 'i'}}, 
                    {'lastName': {$regex: filterText, $options: 'i'}},
                    {'email': {$regex: filterText, $options: 'i'}}
                  ],
                  'deleted':false
                }   

            User.count(countPipeline, (err, count) => {
              if (err) return cb(err)

                let users = {
                    'users': docs,
                    'totalElements': count
                };

                cb(null, users)
            })

       }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
  });
 };

/**
 * @api {PUT} /user/account Add and assing an account to a user login
 * @apiGroup {users}
 * @apiName Add Account
 *
 * @apiDescription Add an account to a user login, assign it to a existing location and add a role for it.
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 * @apiParam  {Json} input_data  see example.
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "name": "Account Default Account",
 *       "user": "578e4c89131a7f624f2b9088",
 *       "role": "578e4c89131a7f624f2b9086",
 *       "location": "578e04a6df598f322f0aa262"
 *     }
 *
 * @apiSuccess {Json} accountId  Created account object
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.createAccount = (req, res) => {
//Creamos una cuenta y la asignamos a una compañia
    waterfall([
        (cb) => {
            let data = req.body;
            //creamos la cuenta
        let account = new Account(      data);

            account.save((err) => {
                if (err) {
                    logger.warn(err, 'Cant save new Account');
                   	return cb('errSavingRole')
                }
                cb(null, account);
            })
        },
        (account, cb) => {
            //Obtenemos la nueva cuenta populada y la devolvemos
            //@SEE http://mongoosejs.com/docs/api.html#model_Model.populate

            Account.findById(account._id, (err, selAccount) => {
                let opts = [
                    {path: 'user'},
                    {path: 'role'},
                    {path: 'location'}
                ];

                Account.populate(selAccount, opts, (err, popAccount) => {
                    if (err) {
                        logger.warn(err, 'Cant get new Account');
                        return cb('errGettingRole')
                    }

                    cb(null, popAccount);
                })
            })
        }
    ], (err, suc)=> {
     		if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(suc);
    })
};

/**
 * @api {get} /user Get user
 * @apiGroup {users}
 * @apiName Get user
 *
 * @ApiHeader (Security) {String}  Authorization auth Token*
 *
 * @apiSuccess {Object} Accounts  Object with array with all the acounts
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getUser = (req, res) => {
    let params = req.query;
    userId = new ObjectId(params._id);
    //let user = req.body;

    waterfall([
        (cb) => {
            User.findById(userId, (err,doc)=>{
                if (err) return cb(err)
                cb(null, doc)
            })
        }, (doc,cb)=>{
            User.populate(doc, {path: "gallery"}, (err, doc) => {
                if (err) return cb(err)
                cb(null, doc)
            });
        }

    ], (err, ok) => {
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    })
};

/**
 * @api {put} / Edit user
 * @apiGroup {user}
 * @apiName Edit user
 *
 * @apiDescription Update user information, except password.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Request-Example:
 * {
 *     "_id": "5BA8e04a6df598f322f0aaCD2"
 *     "firstName": "Miquel"
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
  let updatedUser = req.body;
  let userId = new ObjectId(updatedUser._id);

  waterfall([
      (cb) => {
      
      if(mongoose.Types.ObjectId.isValid(userId)) {  

          User.findById(userId, (err, doc) => {
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
            updatedUser.last_account = userData._id;

            User.findById(userId)
            .exec((err,doc)=>{
              if(err) cb(err)

                doc.firstName=updatedUser.firstName;
                doc.lastName=updatedUser.lastName;
                doc.active=updatedUser.active;
                doc.gallery=updatedUser.gallery;
                doc.language=updatedUser.language;
                doc.last_account=updatedUser.last_account;
                doc.email=updatedUser.email;

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
 * @api {put} /password Change user password
 * @apiGroup {user}
 * @apiName Change user password
 *
 * @apiDescription Replaces user password
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Request-Example:
 * {
       "_id" : "435236574657457",
 *     "password" : "secret"
 * }
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.changePassword = (req, res) => {
  var userData = req.userData;
  let updatedUser = req.body;
  let userId = new ObjectId(updatedUser._id);

  waterfall([
      (cb) => {
      
      if(mongoose.Types.ObjectId.isValid(userId)) {  

          User.findById(userId, (err, doc) => {
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

            User.findById(userId)
            .exec((err,doc)=>{
              if(err) return cb(err)

                doc.password=updatedUser.password;
                doc.last_account=userData._id;

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
 * @api {delete} /user Delete user
 * @apiGroup {user}
 * @apiName Delete user
 *
 * @apiDescription Delete a user
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  user id
 *
 * @apiSuccess {Object} user removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.remove = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var userId = new ObjectId(params._id);
    var deleted = params.deleted;

    waterfall([
        (cb) => { //location check. Verify that at least one user location is within the gastroOffer's locations      

        if(mongoose.Types.ObjectId.isValid(params._id)) {  
            User.findById(userId, (err, doc) => {
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
    }], (err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
    })
}
