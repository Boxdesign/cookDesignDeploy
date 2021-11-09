var Kitchen = require("../models/kitchen");
var { ObjectId } = require("mongodb");
var async = require("async");
var mongoose = require("../node_modules/mongoose");
var referenceNumberGeneratorHelper = require("../helpers/referenceNumberGenerator");
var config = require("../config/config");
var loggerHelper = require("../helpers/logger");
const logger = loggerHelper.controllers;

/**
 * @api {post} /kitchen Add new kitchen
 * @apiGroup {kitchen}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Kitchen-Creation:
 {
    "lang": [{
        "langCode": "es",
        "name": "Cocina",
        "description": " Cocina de Marmol"
    }],
    "referenceNumber":"1600002017..."

 }
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 **/

exports.add = (req, res) => {
  var inKitchen = req.body;
  inKitchen.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
    config.refNumberPrefixes.kitchen
  );
  var kitchen = new Kitchen(inKitchen);

  kitchen.save((err, doc) => {
    if (err)
      return res
        .status(500)
        .json(err.message || "Error")
        .end();
    res.status(200).json(doc).end();
  });
};

exports.addWorkRoom = (req, res) => {
  console.log(req, "req");
  var userData = req.userData;
  var inKitchenWorkRoom = req.body;
  inKitchenWorkRoom.workRoom.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
    config.refNumberPrefixes.workRoom
  );

  async.waterfall(
    [
      (cb) => {
        //Obtenemos del modelo original el Id de empresa
        Kitchen.findOne(
          { _id: inKitchenWorkRoom._id },
          "assigned_location",
          (err, doc) => {
            if (err) return cb(err);
            if (!doc) return res.status(400).json(err).end();
            //locHelper.canEdit(userData.location._id, doc.assigned_location, cb, doc);
            cb(null, doc);
          }
        );
      },
      (param, cb) => {
        inKitchenWorkRoom.last_account = userData._id;

        Kitchen.findOneAndUpdate(
          { _id: inKitchenWorkRoom._id },
          {
            $addToSet: {
              workRooms: inKitchenWorkRoom.workRoom,
            },
          },
          function (err, doc) {
            if (err) return cb(err);
            cb(null, inKitchenWorkRoom);
          }
        );
      },
    ],
    (err, ok) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      res.status(200).json(ok);
    }
  );
};

/**
 * @api {put} /kitchen Edit kitchen
 * @apiGroup {kitchen}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a kitchen
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "_id": "5BA8e04a6df598f322f0aaCD2"
 *     "lang": [{
            "langCode": "es",
            "name": "Cocina",
            "description": "Fogones"
        }],
 *     "referenceNumber": "160002017..."
 * }
 *
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.edit = (req, res) => {
  var userData = req.userData;

  async.waterfall(
    [
      (cb) => {
        let updateObj = req.body;

        //Obtenemos del modelo original el Id de cocina
        Kitchen.findOne({ _id: updateObj._id }, (err, doc) => {
          if (err) return cb(err);
          if (!doc) return res.status(400).json(doc).end();
          //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
          cb(null, doc);
        });
      },
      (param, cb) => {
        let updateObj = req.body;

        Kitchen.update({ _id: updateObj._id }, updateObj, (err) => {
          if (err) return cb(err);
          cb(null, updateObj);
        });
      },
    ],
    (err, ok) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      res.status(200).json(ok);
    }
  );
};

exports.editWorkRoom = (req, res) => {
  var userData = req.userData;
  let updateObj = req.body;
  async.waterfall(
    [
      (cb) => {
        //Obtenemos del modelo original el Id de empresa
        Kitchen.findOne(
          { "workRooms._id": updateObj._id },
          "assigned_location",
          (err, doc) => {
            if (err) return cb(err);
            if (!doc) return res.status(400).json(err).end();
            //locHelper.canEdit(userData.location._id, doc.assigned_location, cb, doc);
            cb(null, doc);
          }
        );
      },
      (param, cb) => {
        updateObj.last_account = userData._id;

        Kitchen.findOneAndUpdate(
          { "workRooms._id": updateObj._id },
          {
            $set: {
              "workRooms.$": updateObj,
            },
          },
          function (err, doc) {
            if (err) return cb(err);
            cb(null, updateObj);
          }
        );
      },
    ],
    (err, ok) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      res.status(200).json(ok);
    }
  );
};

/**
 * @api {get} /kitchen Get All kitchen
 * @apiGroup {kitchen}
 * @apiName Get Kitchens
 *
 * @apiDescription Get all kitchens
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} all Kitchen list
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getKitchens = (req, res) => {
  let params = req.query;
  var filterText = params.filterText || "";
  var sortField = params.sortField || "lang.name";
  var sortOrder = Number(params.sortOrder) || 1;
  let userProfile = req.userData;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var filterLocation;
  var filterLocationPipeline;

  async.waterfall(
    [
      (cb) => {
        if (params.filterLocation) {
          filterLocation = JSON.parse(params.filterLocation).map(function (
            doc
          ) {
            return new ObjectId(doc);
          });
        } else {
          filterLocation = [];
        }

        //If an array of filter locations if provided, build the filter location pipeline
        filterLocationPipeline = {};
        if (filterLocation.length > 0) {
          filterLocationPipeline = { location: { $in: filterLocation } };
        }

        Kitchen.aggregate(
          [
            { $unwind: "$lang" },
            { $match: { location: { $in: userLocIds } } },
            { $match: filterLocationPipeline },
            { $match: { "lang.langCode": userProfile.user.language } },
            {
              $match: {
                $or: [
                  { "lang.name": { $regex: filterText, $options: "i" } },
                  { "lang.description": { $regex: filterText, $options: "i" } },
                  { referenceNumber: { $regex: filterText, $options: "i" } },
                ],
              },
            },
            { $sort: { [sortField]: sortOrder } },
            { $skip: Number(params.page) * Number(params.perPage) },
            { $limit: Number(params.perPage) },
          ],
          (err, docs) => {
            if (err) {
              return cb(err);
            }
            cb(null, docs);
          }
        );
      },
      (docs, cb) => {
        Kitchen.aggregate(
          [
            { $match: { location: { $in: userLocIds } } },
            { $match: filterLocationPipeline },
            { $match: { "lang.langCode": userProfile.user.language } },
            {
              $match: {
                $or: [
                  { "lang.name": { $regex: filterText, $options: "i" } },
                  { "lang.description": { $regex: filterText, $options: "i" } },
                  { referenceNumber: { $regex: filterText, $options: "i" } },
                ],
              },
            },
          ],
          (err, docCount) => {
            if (err) return cb(err);

            let kitchens = {
              kitchens: docs,
              totalElements: docCount.length,
            };

            cb(null, kitchens);
          }
        );
      },
    ],
    (err, data) => {
      if (err) {
        return res.status(500).json(err).end();
      } else if (!data) {
        return res.status(400).json(data).end();
      }
      res.status(200).json(data);
    }
  );
};

//Function used to sort array based on name
function compare(a, b) {
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

/**
 * @api {get} /kitchen/details Get all langs for a unit
 * @apiGroup {kitchen}
 * @apiName Get Langs
 *
 * @apiDescription Get all langs
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {text} Get-Example:
 *    ?_id=57973cca583324f56361e0f2
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getKitchenLang = (req, res) => {
  async.waterfall(
    [
      (cb) => {
        let userProfile = req.userData;
        let params = req.query;

        Kitchen.findOne(
          { _id: params._id },
          {
            lang: 1,
            referenceNumber: 1,
          }
        ).exec((err, docs) => {
          if (err) {
            return cb(err);
          }
          //console.log(docs,'docsLang')
          cb(null, docs);
        });
      },
    ],
    (err, data) => {
      if (err) {
        return res.status(500).json(err).end();
      } else if (!data) {
        return res.status(400).json(data).end();
      }
      res.status(200).json(data);
    }
  );
};

exports.getWorkRoomLang = (req, res) => {
  async.waterfall(
    [
      (cb) => {
        let userProfile = req.userData;
        let params = req.query;

        Kitchen.findOne(
          { "workRooms._id": params._id },
          {
            //  'workRooms.lang': 1
          }
        ).exec((err, docs) => {
          if (err) {
            return cb(err);
          }
          cb(null, docs.workRooms.id(params._id));
        });
      },
    ],
    (err, data) => {
      if (err) {
        return res.status(500).json(err).end();
      } else if (!data) {
        return res.status(400).json(data).end();
      }
      res.status(200).json(data);
    }
  );
};

/**
 * @api {delete} /kitchen Delete kitchen
 * @apiGroup {kitchen}
 * @apiName Delete kitchen
 *
 * @apiDescription Delete a have-no-child kitchen
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Delete-Example:
 * {
 *    "_id": "57973cca583324f56361e0f2"
 * }
 *
 * @apiError inUse  If the kitchen have any dep it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */

exports.remove = (req, res) => {
  var ktToDelete = req.query._id;
  var userData = req.userData;

  async.waterfall(
    [
      (cb) => {
        //Obtenemos del modelo original el Id de empresa
        Kitchen.find({ _id: ktToDelete }, (err, doc) => {
          if (err) return res.status(500).json(err).end();
          if (!doc) {
            return res.status(400).json(err).end();
          }
          //console.log(err,'error')

          logger.info(
            "Kitchen Controller --- REMOVE : find kitchen to remove %j",
            doc
          );
          //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
          cb(null, doc);
        });
      },
      (doc, cb) => {
        //console.log(doc,'doc')
        if (doc) {
          doc[0].remove(function (err, doc) {
            if (err) return cb(err);
            cb(null, doc);
          });
          logger.info(
            "Kitchen Controller --- REMOVE : kitchen %j removed successfully",
            doc
          );
        } else {
          logger.info(
            "Kitchen Controller --- REMOVE : kitchen is an invalid ObjectId"
          );
          var err = new Error("Invalid Object Id");
          err.statusCode = 400;
          return cb(err);
        }
      },
    ],
    (err, ok) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      res.status(200).json(ok).end();
    }
  );
};

exports.removeWorkRoom = (req, res) => {
  var workRoomId = req.query._id;
  var userData = req.userData;
  var restrict = require("../helpers/kitchenRestrict");
  console.log("***********");

  async.waterfall(
    [
      (cb) => {
        //Obtenemos del modelo original el Id de empresa
        Kitchen.findOne({ "workRooms._id": workRoomId }, "", (err, doc) => {
          if (err) return cb(err);
          if (!doc) return res.status(400).json(err).end();
          cb(null, doc);
        });
      },
      (doc, cb) => {
        if (doc) {
          Kitchen.findOne(
            { "workRooms._id": workRoomId },
            "",
            (err, kitchen) => {
              if (err) return cb(err);
              if (!kitchen) return res.status(400).json(err).end();

              //Verify that there aren't any models that contain this workRoom's kitchen
              restrict.workRoomRestrict(workRoomId, function (err, matches) {
                if (err) return cb(err);
                if (matches.length > 0) {
                  var err = new Error(
                    "WorkRoom can not be removed because it is being used."
                  );
                  err.statusCode = 400;
                  return cb(err);
                } else {
                  //Ok to remove workRoom
                  // console.log('ok to remove workRoom')
                  // cb(null, matches);
                  kitchen.workRooms.id(workRoomId).remove();

                  kitchen.save((err) => {
                    if (err) return cb(err);
                    cb(null, matches);
                  });
                }
              });
            }
          );
        }
      },
    ],
    (err, ok) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      res.status(200).json(ok).end();
    }
  );
};

exports.assignKitchenToOrganizationLoc = (req, res) => {
  var Location = require("../models/location");
  var Kitchen = require("../models/kitchen");
  var async = require("async");
  var organization;
  var kitchens;

  async.waterfall(
    [
      (cb) => {
        //Get location ids
        Location.find({}, { _id: true }, (err, docs) => {
          if (err) return cb(err);
          if (!docs.length) {
            let err = new Error("Could not find any location!");
            return cb(err);
          }
          organizationId = docs[0];
          cb(null, true);
        });
      },
      (doc, cb) => {
        //Get families
        Kitchen.find({}, (err, docs) => {
          if (err) return cb(err);
          if (!docs.length) {
            let err = new Error("Could not find any kitchens!");
            return cb(err);
          }
          kitchens = docs;
          cb(null, true);
        });
      },
      (doc, cb) => {
        async.eachSeries(
          kitchens,
          (kitchen, cb_async) => {
            kitchen.location = [];
            kitchen.location = kitchen.location.concat([organizationId]);

            kitchen.save((err) => {
              if (err) return cb_async(err);
              cb_async();
            });
          },
          (err) => {
            //Finished kitchen loop
            if (err) return cb(err);
            cb(null, true);
          }
        );
      },
    ],
    (err, doc) => {
      if (err)
        return res
          .status(err.statusCode || 500)
          .json(err.message || "Error")
          .end();
      res
        .status(200)
        .json({ message: "Updated kitchen locations successfully" })
        .end();
    }
  );
};
