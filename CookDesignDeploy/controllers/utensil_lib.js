"use strict";

var waterfall = require("async-waterfall");
var locHelper = require("../helpers/locations");
var Utensil = require("../models/utensil");
var async = require("async");
var referenceNumberGeneratorHelper = require("../helpers/referenceNumberGenerator");
var config = require("../config/config");
var loggerHelper = require("../helpers/logger");
const logger = loggerHelper.controllers;

/**
 * @api {post} /utensil Add new utensil
 * @apiGroup {utensil}
 * @apiName Add new
 *
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *     "lang":[
 *         {
 *             "langCode": "es",
 *             "name": "Sarten",
 *         },
 *         {
 *             "langCode": "en",
 *             "name": "pan",
 *         }
 *     ],
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
  var inUten = req.body;
  inUten.last_account = account._id;
  inUten.assigned_location = account.location._id;
  inUten.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
    config.refNumberPrefixes.utensil
  );
  var utensil = new Utensil(inUten);

  utensil.save((err) => {
    if (err)
      return res
        .status(500)
        .json(err.message || "Error")
        .end();
    res.status(200).json(utensil);
  });
};

/**
 * @api {put} /utensil Edit utensil
 * @apiGroup {utensil}
 * @apiName Edit
 *
 * @apiDescription Complete replaces a utensil
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} Request-Example:
 * {
 *      "id": "5BA8e04a6df598f322f0aaCD2"
 *     "lang":[
 *         {
 *             "lang": "es",
 *             "name": "Paella",
 *         },
 *         {
 *             "lang": "en",
 *             "name": "Paella",
 *         }
 *     ],
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
  let updateObj = req.body;

  waterfall(
    [
      (cb) => {
        Utensil.findById(updateObj, function (err, utensil) {
          if (err) return cb(err);
          if (!utensil) {
            var err = new Error("Document not found");
            err.statusCode = 400;
            return cb(err);
          }

          utensil.gallery = updateObj.gallery;
          if (updateObj.family) utensil.family = updateObj.family;
          if (updateObj.subfamily) utensil.subfamily = updateObj.subfamily;
          if (updateObj.externalFamily)
            utensil.externalFamily = updateObj.externalFamily;
          if (updateObj.externalLink)
            utensil.externalLink = updateObj.externalLink;
          if (updateObj.externalSubfamily)
            utensil.externalSubfamily = updateObj.externalSubfamily;
          if (updateObj.lang) utensil.lang = updateObj.lang;
          utensil.last_account = userData._id;
          utensil.save((err, updatedIng) => {
            if (err) return cb(err);
            cb(null, updatedIng);
          });
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

/**
 * @api {get} /utensil Get all utensils
 * @apiGroup {utensil}
 * @apiName Get All
 *
 * @apiDescription Get all utensils with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {int} perPage  Recors per page.
 *  @apiParam {int} page  Page number.
 *  @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 *  @apiParam {string} filterText  Text te filter (in name field).
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
  var filterText = params.filterText || "";
  var sortField = params.sortField || "lang.name";
  var sortOrder = Number(params.sortOrder) || 1;

  logger.info("Utensil controller::getAll -Entering method");
  logger.info(
    "Utensil controller::userProfile: %s",
    JSON.stringify(userProfile)
  );
  logger.info("Utensil controller::params: %s", JSON.stringify(params));
  logger.info("Utensil controller::sortField: %s", JSON.stringify(sortField));
  logger.info("Utensil controller::sortOrder: %s", JSON.stringify(sortOrder));

  waterfall(
    [
      (cb) => {
        Utensil.aggregate(
          [
            { $unwind: "$lang" },
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
            if (err) return cb(err);

            logger.info(
              "Utensil controller::retrieved %s utensils",
              docs.length
            );

            Utensil.populate(
              docs,
              {
                path:
                  "assigned_location last_account gallery provider family family.subfamilies externalFamily externalFamily.subfamilies",
              },
              (err, docs) => {
                if (err) return cb(err);
                logger.info("Utensil controller::finished populating utentils");
                cb(null, docs);
              }
            );
          }
        );
      },
      (docs, cb) => {
        let data;

        Utensil.aggregate(
          [
            { $unwind: "$lang" },
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
          (err, docsCount) => {
            if (err) return cb(err);

            data = {
              utensils: docs,
              totalElements: docsCount.length,
            };

            cb(null, data);
          }
        );
      },
    ],
    (err, data) => {
      if (err) {
        logger.error(err);
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      }
      res.status(200).json(data).end();
    }
  );
};

/**
 * @api {get} /utensil/details Get all langs for a unit
 * @apiGroup {utensil}
 * @apiName Get Langs
 *
 * @apiDescription Get all base measurement units
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
exports.getUtensilLang = (req, res) => {
  waterfall(
    [
      (cb) => {
        let userProfile = req.userData;
        let params = req.query;

        Utensil.findOne({ _id: params._id }, (err, doc) => {
          if (err) return cb(err);
          return cb(null, doc);
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
 * @api {get} /utensil/detail Get utensil for a unit
 * @apiGroup {utensil}
 * @apiName Get Langs
 *
 * @apiDescription Get all base measurement units
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
exports.getUtensil = (req, res) => {
  waterfall(
    [
      (cb) => {
        let userProfile = req.userData;
        let params = req.query;

        Utensil.findOne(
          {
            _id: params._id,
          },
          {
            lang: { $elemMatch: { langCode: userProfile.user.language } },
            family: 1,
            subfamily: 1,
            gallery: 1,
            referenceNumber: 1,
            provider: 1,
            last_account: 1,
            updatedAt: 1,
            externalFamily: 1,
          }
        )
          .populate("family subfamilies last_account gallery")
          .exec((err, doc) => {
            if (err) return cb(err);
            cb(null, doc);
          });
      },
    ],
    (err, data) => {
      if (err) {
        return res.status(500).json(err).end();
      } else if (!data) {
        return res.status(400).json(data).end();
      }
      //console.log(data,'data')
      res.status(200).json(data);
    }
  );
};

/**
 * @api {delete} /utensil Delete utensil
 * @apiGroup {utensil}
 * @apiName Delete utensil
 *
 * @apiDescription Delete a have-no-child utensil
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {json} Delete-Example:
 * {
 *    "_id": "57973cca583324f56361e0f2"
 * }
 *
 * @apiError inUse  If the utensil have any dep it cannot be deleted
 *
 * @apiVersion 0.1.0
 *
 */

exports.remove = (req, res) => {
  var utToDelete = req.query._id;
  var userData = req.userData;

  waterfall(
    [
      (cb) => {
        //Obtenemos del modelo original el Id de empresa
        Utensil.findOne(
          { _id: utToDelete },
          "assigned_location",
          (err, doc) => {
            if (err) return res.status(500).json(err).end();
            if (!doc) return res.status(400).json(err).end();
            //miramos si tiene permisos
            //locHelper.canEdit(userData.location._id, doc.assigned_location, cb);
            cb(null, doc);
          }
        );
      },
      (doc, cb) => {
        if (doc) {
          doc.remove((err, doc) => {
            if (err) return cb(err);
            cb(null, doc);
          });
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

  //     (ok, cb) => {
  //         //miramos si no tiene ninguna unidad de meida asignada
  //         //todo mirar si tiene alguna depencencia
  //         // MeasurementUnit.findOne()
  //         //     .elemMatch('parentUnits', {unit: utToDelete})
  //         //     .exec((err, doc) => {
  //         //         if (err)
  //         //             return cb(true);
  //         //         if (doc)
  //         //             return cb('inUse');
  //         //         cb(null, true)
  //         //     });
  //         cb(null, true)

  //     },
  //     (canDelete, cb) => {
  //         if (canDelete) {
  //             Utensil.remove({_id: utToDelete}, (err) => {
  //                 if (err) {
  //                     return cb(err);
  //                 }
  //                 cb(null, true);
  //             })
  //         }
  //     }
  // ], (err, ok) => {
  //     if (err) {
  //         switch (err) {
  //             case  'inUse':
  //                 res.status(400).json({'message': err}).end();

  //                 break;
  //             default:
  //                 res.status(500).json(err).end();
  //                 break;
  //         }
  //     }

  //     res.json({'deleted': 'ok'}).end();
  // })
};

//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

exports.generateReferenceNumber = (req, res) => {
  var referenceNumberGeneratorHelper = require("../helpers/referenceNumberGenerator");

  waterfall(
    [
      (cb) => {
        Utensil.find({}, (err, docs) => {
          if (err) {
            return cb(err);
          }
          cb(null, docs);
        });
      },
      (docs, cb) => {
        async.eachSeries(
          docs,
          function (utensil, cb_async) {
            function generateReferenceNumber() {
              return function () {
                let filtered = utensil.lang.filter((lang) => {
                  return lang.name == "";
                });

                if (filtered.length > 0) {
                  filtered.forEach((filteredObject) => {
                    let index = utensil.lang.indexOf(filteredObject);
                    utensil.lang.splice(index, 1);
                  });
                }

                utensil.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
                  config.refNumberPrefixes.utensil
                );

                if (utensil.referenceNumber) {
                  let name = "";
                  if (utensil.lang && utensil.lang.length)
                    name = utensil.lang[0].name;

                  //console.log(utensil.referenceNumber,'Reference Number of Utensil', name)

                  utensil.save((err) => {
                    if (err) return cb_async(err);
                    cb_async();
                  });
                }
              };
            }
            setTimeout(generateReferenceNumber(), 1);
          },
          function (err) {
            cb(null, true);
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
      res.status(200).json(ok).end();
    }
  );
};
