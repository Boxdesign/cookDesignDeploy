'use strict';

var StringHelper = require('../helpers/string');
var Auth = require('../models/auth');
var User = require('../models/user');
var Account = require('../models/account');
var config = require('../config/config');
var moment = require('moment');
var waterfall = require('async-waterfall');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.server;


/**
 * @api {post} /auth/login Login
 * @apiGroup {auth}
 * @apiName Users
 *
 * @apiDescription This endpint will return all authentificated users
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *   "email":"jferreira@albira.com",
 *   "password":"secret"
 * }

 *
 *
 * @apiSuccess {Object} Token Auth token
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.login = (req, res) => {
    var data = req.body;
    var account;  
    var Account = require('../models/account')
    logger.info('Auth controller:: REQ: ',data)
    waterfall([
        (cb) => {
            User.doLogin(data.email, data.password, (err, user) => { //Get user
                logger.info('***Error gettig user***',err)
                logger.info('***gettig user***',user)
                if (err)  cb(err);
                if(!user || user == null) {
                  let err=new Error("User not found");
                  err.statusCode=404;
                  return cb(err)
                }
                cb(null, user);
            });

        }, (user, cb) => {  //Remove old token, if any
            Auth.remove({'user': user._id}, (err) => {
                if (err) cb(err);
                cb(null, user)
            })

        }, (user, cb) => {  //Create new token
            let token = StringHelper.randomString();

            var auth = new Auth({
                token: token,
                user: user._id,
                exp: moment().add(config.tonkenExp, 'hours')
            });

            auth.save((err) => { //save it
                if (err) cb(err)
                let data = {
                    'token': token
                }
                cb(null, data);
            })
        }

    ], (err, ok) => {
        logger.error('***Error***',err)
        logger.info('***Ok***',ok)
        if(err) return res.status(500).json(err.message || 'Error').end();
        res.status(200).json(ok).end();
    });

};

/**
 * @api {post} /auth/account Select an active account for the current user
 * @apiGroup {auth}
 * @apiName SelectAccount
 *
 * @apiDescription When de user is loggedIn and the token is generated, the user shoun be asigned to an account.
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 *  @apiParam {Json} The account Id  Fields per page.
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "account": "578e04a6df598f322f0aa262"
 *     }
 *
 *
 * @apiSuccess {Json} Success  If the vinculation was succefull or not
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.useAccount = (req, res) => {

    waterfall([
            (cb) => {
                
                Auth.findOne({'user': req.userData.user}, (err, auth) => { //Get the user auth
                    if (err) {
                        return cb(err);
                    }
                    auth.account = req.body.account; //set the user auth with the specified account
                    auth.save((err) => {
                        if (err) {
                            return cb(err);
                        }
                        cb(null, auth)
                    })
                })
            },
            //Obtenemos la cuenta seleccionada y la retornamos
            (auth, cb) => {
                Account.findById(auth.account, (err, selAccount) => { //Update the user auth with the selected account
                    let opts = [
                        {path: 'user'},
                        {path: 'role'},
                        {path: 'location'}
                    ];

                    if(!selAccount.active) {  //If the account is not active, it can't be used!
                        let err = new Error("Account is not active.")
                        err.statusCode=404;
                        return cb(err)
                    }

                    Account.populate(selAccount, opts, (err, popAccount) => {
                        if (err) {
                            logger.warn(err, 'Cant get Account');
                            return cb(err)
                        }

                        cb(null, popAccount);
                    })
                })
            }
        ],
        (err, ok)=> {
	        if(err) return res.status(500).json(err.message || 'Error').end();
	        res.status(200).json(ok);
        });
};

/**
 * @api {get} /auth/loggedin Checks whether a user is logged in
 * @apiGroup {auth}
 * @apiName IsLoggedIn
 *
 * @apiDescription Verifies that the user has a valid auth doc
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 * @apiSuccess {Json} Success  Returns true if the user is logged in
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.isLoggedIn = (req, res, next) => {
    let userProfile = req.userData;
    var authToken = req.get('Authorization');

    //If the request gets to this point, it means that the user token is valid.
    //Must check now whether the auth has an account assigned to it.

    waterfall([
        (cb) => {                
            Auth.findOne({'token': authToken})
            .populate('user')
            .exec((err, auth) => { //Get the user auth
                if (err) return cb(err);
                if (!auth) {
                    var err=new Error("No valid auth found!");
                    err.statusCode=404;
                    return cb(err)
                }
                cb(null, auth)
            })
        // }, (auth, cb) => {
        //     User.populate(auth, {path: 'auth.account.user'})


        }, (auth, cb) => {
            let data = {};
            if(auth.account) { 
                data = {
                    isLoggedIn: true,
                    user: auth.user,
                    account: auth.account
                }
            } 
            else {
                data = {
                    isLoggedIn: false,
                    user: null,
                    account: null
                }
            }
            cb(null, data)
        }],
        (err, ok)=> {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok);
        });
};

exports.isTokenValid = (req, res, next) => {

};
