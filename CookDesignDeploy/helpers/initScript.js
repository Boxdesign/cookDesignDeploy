'use strict';

var async = require('async');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.server;

exports.createDatabaseInitialCollections = () => {

	var User = require('../models/user');
	var Role = require('../models/role');
	var Account = require('../models/account');
	var config = require('../config/config')

	logger.info('Initial script createDatabaseInitialCollections - Starting execution of initial script...')

	async.waterfall([

    (cb) => {

    	//Create user if not exists
			User.find({email:'ADMIN@USER.COM'}, (err, users) => {
				if(err) {
					logger.error('Initial script createDatabaseInitialCollections - Error finding user ADMIN@USER.COM')
					return cb(err);
				}
				if(users.length>0) {
					logger.info('Initial script createDatabaseInitialCollections - Retrieved user ADMIN@USER.COM from database')
					return cb(null,users[0]);
				}

				logger.info('Initial script createDatabaseInitialCollections - User ADMIN@USER.COM does not exist in database, create it.')

				let user = new User({
					email: 'ADMIN@USER.COM',
				  password: 'MyP@ssword!',
				  firstName: 'ADMIN',
				  lastName: 'USER',
				  language: 'es',
				  active: true
				});

				user.save((err, user) => {
					if(err) {
						logger.error('Initial script createDatabaseInitialCollections - Error saving ADMIN@USER.COM')
						return cb(err);
					}
					logger.error('Initial script createDatabaseInitialCollections - User ADMIN@USER.COM saved correctly')
					cb(null,user)
				});

			});

		}, (user, cb) => {

			//Create Role if not exists
			Role.find({name:'Admin'}, (err, roles) => {
				if(err) return cb(err);
				if(roles.length>0) return cb(null,user,roles[0]);

				let role = new Role({
					name:'Admin',
			    entities: [ 
			      {
			          name : 'user',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'role',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'location',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'measurementUnit',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'family',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'utensil',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'checkpoint',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'process',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'packaging',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'packformat',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'allergen',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'gastrofamily',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'ingredient',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'config',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'gallery',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'subproduct',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'account',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'dish',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'product',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'gastro-offer',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'report',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'template',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'provider',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'document',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'article',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'admin',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'drink',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'export',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'print',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'print-book',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			          name : 'queue',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      }  ,
			      {
			          name : 'selentaImport',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			        name: 'kitchen',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			        name: 'workRoom',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      },
			      {
			        name: 'utils',
								"permissions" : {
									"read" : true,
									"edit" : true,
									"delete" : true
								}
			      }         
			    ]
				});

				role.save((err, role) => {
					if(err) return cb(err);
					cb(null, user, role)
				});

			});

		}, (user, role, cb) => {

			//Create Account if not exists
			Account.find({$and:[{user:user._id},{role:role._id}]}, (err, accounts) => {
				if(err) return cb(err);
				if(accounts.length>0) return cb(null,true);

				let account = new Account({
					name: 'ADMIN',
					user: user._id,
					role: role._id,
					active: true
				});

				account.save((err, account) => {
					if(err) return cb(err);
					cb(null,true);
				});

			});

		}], (err, ok) => {
				//console.log('************************************************************************************')
				if(err) return err
				return true
		})

}