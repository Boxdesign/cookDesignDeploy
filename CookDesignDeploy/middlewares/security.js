'use strict';

var Auth = require('../models/auth');
var User = require('../models/user');
var Account = require('../models/account');
var moment = require('moment');
var waterfall = require('async-waterfall');
var config = require('../config');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.server;
/*
 Este middleware se encarga de comporbar si la petición tiene un token, y adjuntara el usuario con el token al cuerpo de la petición.
 Si el token no es correcto, le devolbera un error y le cerrara la sesión
 */


exports.loggedIn = (req, res, next) => {

    var patt = /kue/;
    var socket = '';
 
    //si es una ruta publica (/auth) no autentificamos
    if (req.path == '/auth/login' || patt.test(req.path) || req.path == 'socket.io'|| req.path == '/' || req.path == '/utils/translate' || req.path =='/utils/translatev2' || req.path =='/utils/translatev3'|| req.path == '/utils/translatev4'|| req.path == '/utils/translatev5' || req.path == '/utils/translatev6' || req.path == '/utils/translateReport') return next();

    //logger.info(req.path, 'Starting token verification');
    //Si no esta en un path publico
    waterfall([
        (cb) => {
            // console.log('aa');
            var authToken = req.get('Authorization');
            if (!authToken) return cb('noToken');
						else cb(null, authToken);
        },
        (authToken, cb) => { //Check first whether auth token is included in config file

        	if(authToken == config.workerToken) return cb(true)
        	else cb(null, authToken);

        },
        (authToken, cb) => {

            Auth.findOne({'token': authToken}, (err, token) => {
                if (err || !token) {
                    return cb('tokenNotFound');
                }

                //Miramos que el token no haya caducado
                if (moment(token.exp).isBefore(moment())) {
                    //EL token ha caducado
                    return cb('tokenExpired');
                }

                //Get socket id
                if(token.socket) socket = token.socket;

                //Actualizamos la expiración
                token.exp = moment().add(config.tonkenExp, 'hours');
                token.save();

                cb(null, token);
            });
        },
        //Attach user data to the request
        (token, cb) => {

            let pipeline = {};
            if(!token.account) pipeline={'user': token.user} 
            else pipeline={'_id': token.account}

            Account.findOne(pipeline, (err, selAccount) => {
                let opts = [
                    {path: 'user'},
                    {path: 'role'},
                    {path: 'location'}
                ];

                Account.populate(selAccount, opts, (err, popAccount) => {
                    if (err) return cb(err)

                    req.userData = popAccount;
                  	req.userData.socket = socket;

                    cb(null, popAccount);

                })
            });

            // User.findOne({'_id': user_id},'_id email',(err, user) => {
            //     if (err || !user) {
            //         return res.status(500).end();
            //     }
            //     logger.info( req.userData, 'Account located');
            //     cb(null, true)
            // })
        }

    ], (err, success) => {
    	  if(err){
    	  	if(err == true) {
    	  		return next(); //Token matches worker token
    	    }
    	  	else 
    	  	{
            logger.warn(err);
            return res.status(401).end();
    	  	}
    	  }
				else
				{
	        next();
				}
    });

};

/*
 * This middleware should check if the current user can do an action o a entity.
 * Ej. canDo('read', 'recipes),
 * if Can, nothing happens, if Can't, it will
 */
exports.canDo = (req, res, next) => {

    var patt = /kue/;

    if (   
    			req.path == '/auth/login' || 
    			req.path == '/auth/account' || 
    			req.path == '/auth/loggedin' || 
    			patt.test(req.path) || 
    			req.path == 'socket.io' || 
    			req.path == '/socketio/send' || 
    			req.path == '/' ||
                req.path == '/appRelease'||
                req.path == '/utils/translate' ||
                req.path == '/utils/translatev2'||
                req.path == '/utils/translatev3'||
                req.path == '/utils/translatev4'||
                req.path == '/utils/translatev5'||
                req.path == '/utils/translatev6'|| 
                req.path == '/utils/translateReport'
    	 )  return next();

    //Note: location here refers to app path (/ingredient, /library, etc.) not a location within the organization.

    //Obtenemos el   path
    let desiredLocation = req.path.split('/', 2)[1];
    //Obtenemos el method
    let desiredMethod = req.method;

    let allowedLocations = req.userData.role.entities;

    //logger.info('Desired ', desiredMethod, desiredLocation);

    let hasAccess = allowedLocations.find((x) => x.name == desiredLocation);
    var allowAccess = false;

    //Sabemos que el usuario puede acceder a la ruta, ahora toca mirar si puede realizar la accion
    if (hasAccess) {
        switch (desiredMethod.toLowerCase()) {
            case 'get':
                allowAccess = hasAccess.permissions.read;
                break;
            case 'put':
            case 'post':
            case 'patch':
                allowAccess = hasAccess.permissions.edit;
                break;
            case 'delete':            
                allowAccess = hasAccess.permissions.delete;
                break;
        }
        if (allowAccess){
            return next();
        }
    }
    //logger.warn('Accessing unauthorized method');
    var err = new Error('Insufficient Permissions');
    err.statusCode=403;
    return res.status(err.statusCode).json(err.message).end();

    // return res.status(403).json({
    //     'message': 'Insufficient Permissions'
    // });
};