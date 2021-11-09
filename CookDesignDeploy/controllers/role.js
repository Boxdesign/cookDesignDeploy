'use strict';

var enums = require('../config/dbEnums');
var waterfall = require('async-waterfall');
var Role = require('../models/role');
var {ObjectId} = require('mongodb');
var mongoose = require('../node_modules/mongoose');

/**
 * @api {post} /role Create a new role
 * @apiGroup {Roles}
 * @apiName Create Role
 **
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 * @apiParam  {json} Roles the roles.
 * @apiParamExample {json} Request-Example:
 *     {
*        "name":"testRole",
 *       "entities":[{
 *           "name": "user",
 *           "permissions": {
 *               "read": 1,
 *               "create": 0,
 *               "edit": 0
 *           }
 *      }]
 * }
 *
 * @apiSuccess {Object} role  Id of created role
 * @apiError Not Found Object
 *
 * @apiVersion 0.1.0
 *
 */

exports.createRole = (req, res) => {
    let newRole = req.body;
    let permissions;
    if (newRole) {
        let role = new Role(newRole);

        role.save((err) => {
            if (err) {
                return res.status(500).json({'message': 'Error saving role'});
            }

            res.status(200).json({'role_id': role._id});
        })
    }
};

/**
 * @api {put} /role Edit role
 * @apiGroup {Roles}
 * @apiName Edit Role
 *
 * @apiDescription With  the role id, it will replace all the entities with the new array. So you should give all the array
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 * @apiParam  {json} Roles the roles.
 * @apiParamExample {json} Request-Example:
 *     {
*        "_id":"578e4c89131a7f624f2b9086",
 *       "entities":[{
 *           "name": "user",
 *           "permissions": {
 *               "read": 1,
 *               "create": 0,
 *               "edit": 0
 *           }
 *      }]
 * }
 *
 * @apiSuccess {Object} role  Id of edited role
 * @apiError Not Found Object
 *
 * @apiVersion 0.1.0
 *
 */
exports.replaceEntities = (req, res) => {
    let upRole = req.body;

    Role.findOne({_id: upRole._id}, function (err, doc) {
        doc.entities = upRole.entities;
        doc.save((err) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(doc);
        });
    });
};

/**
 * @api {put} / Edit role
 * @apiGroup {role}
 * @apiName Edit role
 *
 * @apiDescription Update role information.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Request-Example:
 * {
 *     "_id": "5BA8e04a6df598f322f0aaCD2"
 *     "name": "Miquel"
 *     "entities" : [
 *        "name" : "product",
 *        "permissions" : {
 *          "read" : true, 
 *          "write" : true, 
 *          "delete" : true 
 *        }
 *     ] 
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.edit = (req, res) => {
  var userData = req.userData;
  let updatedRole = req.body;
  let roleId = new ObjectId(updatedRole._id);

  waterfall([
      (cb) => {
      
      if(mongoose.Types.ObjectId.isValid(roleId)) {  

          Role.findById(roleId, (err, doc) => {
              if (err) cb(err);
              if (!doc) {
                  let err=new Error("Document not found");
                  err.statusCode=404;
                  return cb(err)
              }
             cb(null,doc);     
          });
        } else {
          let err=new Error("Role id not valid");
          err.statusCode=400;
          return cb(err)
        }

      }, (doc, cb) => {
            updatedRole.last_account = userData._id;

            Role.findById(roleId)
            .exec((err,doc)=>{
              if(err) cb(err)

                doc.name=updatedRole.name;
                doc.entities=updatedRole.entities;
                // doc.entities.forEach((entity)=>{
                //   let entityMatch = updatedRole.entities.filter((e)=> {
                //     return entity.name == e.name;
                //   })
                //   if(entityMatch && entityMatch[0]!=null) { 
                //     if(entityMatch[0].permissions) {
                //       if(entityMatch[0].permissions.read) entity.permissions.read = true;
                //       else entity.permissions.read = false;
                //       if(entityMatch[0].permissions.edit) entity.permissions.edit = true;
                //       else entity.permissions.edit = false;
                //       if(entityMatch[0].permissions.delete) entity.permissions.delete = true;
                //       else entity.permissions.delete = false;             
                //     }
                //   }
                // })

                console.log(doc.entities)

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
 * @api {get} /role Get all roles
 * @apiGroup {role}
 * @apiName Get All
 *
 * @apiDescription Get all roles with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {int} perPage  Recors per page.
 * @apiParam {int} page  Page number.
 * @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 * @apiParam {string} filterText  Text te filter (in name field).
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
    var sortField = params.sortField || 'name';
    var sortOrder = Number(params.sortOrder) || 1;

    waterfall ([
        (cb) => {

            Role.aggregate([
              {$match: {
                $or: [
                  {'name': {$regex: filterText, $options: 'i'} }
                ]
              }},
              {$sort: { [sortField] : sortOrder }},
              {$skip: Number(params.perPage)*Number(params.page)},
              {$limit: Number(params.perPage)}
            ], (err, docs) => {
                if (err) return cb(err)
                cb(null, docs)                
            })
        },(docs, cb) => {
            //Get total number of elements for pagination
            let countPipeline = {
                    'name': {$regex: filterText, $options: 'i'}
                }   

            Role.count(countPipeline, (err, count) => {
              if (err) return cb(err)

                let roles = {
                    'roles': docs,
                    'totalElements': count
                };

                cb(null, roles)
            })

       }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
  });
 };

/**
 * @api {get} /role get role
 * @apiGroup {Roles}
 * @apiName Get Role
 *
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 * @apiParam  {String} _id the role id.

 *
 * @apiSuccess {Object} role  the role
 * @apiError Not Found Object
 *
 * @apiVersion 0.1.0
 *
 */
exports.getRole = (req, res) => {

 Role.findOne({'_id' : req.query._id}, (err, doc) => {
     if(err) return res.status(500).json(err.message || 'Error').end();
     res.status(200).json(doc);
 })
};

/**
 * @api {delete} /role Delete role
 * @apiGroup {user}
 * @apiName Delete role
 *
 * @apiDescription Delete a role
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  role id
 *
 * @apiSuccess {Object} role removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
 exports.remove = (req, res) => {
    let userProfile = req.userData;
    let params = req.query;
    var roleId = new ObjectId(params._id);

    waterfall([
        (cb) => {     

        if(mongoose.Types.ObjectId.isValid(roleId)) {  
            Role.findById(roleId, (err, doc) => {
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
            doc.remove((err,doc) => {
                if (err) return cb(err)
                cb(null, doc)
            })            
    }], (err, ok) => {       
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
    })
}


exports.getEntities = (req, res) => {
    res.json({
        'entities': enums.entities
    })
};