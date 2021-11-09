"use strict";

var waterfall = require("async-waterfall");
var locHelper = require("../helpers/locations");
var gastroCostHelper = require("../helpers/gastroCost");
var mongoose = require("../node_modules/mongoose");
var fs = require("fs");
var async = require("async");
var GastroOffer = require("../models/gastroOffer");
var Ingredient = require("../models/ingredient");
var User = require("../models/user");
var Location = require("../models/location");
var { ObjectId } = require("mongodb");
var config = require("../config/config");
var assert = require("assert");
var async = require("async");
var referenceNumberGeneratorHelper = require("../helpers/referenceNumberGenerator");
var loggerHelper = require("../helpers/logger");
const logger = loggerHelper.controllers;

/**
 * @api {post} /gastro-offer Add new gastroOffer
 * @apiGroup {gastroOffer}
 * @apiName Add new
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} GastroOffer-Creation:
 {	
	"location" : ["57e557b687ae842825ae6d22","57e5573f87ae842825ae6d1f", "57e53fabf9475a721f6e2c6f"],
    "active" : "true",
	"versions": [
		{
			"lang" :[
				{
					"langCode": "es",
					"name" : "GastroOffer 22",
					"description" : "Descripción del gastroOffer 22"
				},
				{
					"langCode": "en",
					"name" : "GastroOffer 22",
					"description" : "Description of gastroOffer 22"
				}
			],
			"active" : "true",
			"type" : "57e557b687ae842825ae6d22",
			"season" : "57e557b687ae842825ae6d23",
			"composition" : []
		}
	]
}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 **/

exports.add = (req, res) => {
  var account = req.userData;
  var inGastroOffer = req.body;
  var gastroOfferLocations = inGastroOffer.location || null;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  });

  logger.info("Entering gastro add method...");
  logger.info("gastroOfferLocations: %j", gastroOfferLocations);
  logger.info("userLocations: %j", userLocations);

  waterfall(
    [
      (cb) => {
        //location check: each gastroOffer location should have at least one user location in its upper path. Each gastroOffer's location
        // includes its upper path.

        if (gastroOfferLocations != null) {
          //Check whether list of gastroOffer locations includes at least one customer location.
          var match = gastroOfferLocations.find((id) => {
            let locId = new ObjectId(id);
            for (var i = 0; i < userLocIds.length; i++) {
              if (userLocIds[i].equals(locId)) return true;
            }
          });

          if (match) {
            logger.info(
              "Initial location permission checks are ok. Move on to next step."
            );
            cb(null, match);
          } else {
            var err = new Error(
              "Access to gastroOffer location is not allowed"
            );
            err.statusCode = 400;
            return cb(err);
          }
        } else {
          let error = new Error("Must specify a valid location");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        inGastroOffer.versions.last_account = account._id;

        switch (inGastroOffer.type) {
          case "menu":
            inGastroOffer.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.menu
            );
            break;
          case "dailyMenuCarte":
            inGastroOffer.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.dailyMenuCarte
            );
            break;
          case "buffet":
            inGastroOffer.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.buffet
            );
            break;
          case "carte":
            inGastroOffer.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.carte
            );
            break;
          case "fixedPriceCarte":
            inGastroOffer.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.fixedPriceCarte
            );
            break;
          case "catalog":
            inGastroOffer.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.catalog
            );
            break;
        }
        //console.log('inGastroOffer to ADD',inGastroOffer)
        var gastroOffer = new GastroOffer(inGastroOffer);

        logger.info(
          "Created new instance of gastro offer. Ready to save %j",
          gastroOffer
        );

        gastroOffer.save((err) => {
          if (err) {
            logger.error("Error saving gastro offer");
            logger.error(err);
            return cb(err);
          }
          cb(null, gastroOffer);
        });
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

/**
 * @api {post} /gastro-offer Add new gastroOffer version
 * @apiGroup {gastroOffer}
 * @apiName Add new verion
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiParamExample {json} GastroOffer-Creation:
 * {
	"_id": "57ea7dfe991de2ce2d211fc3",
    "active" : true,
	"versions": [
		{
			"lang" :[
				{
					"langCode": "es",
					"name" : "GastroOffer 1",
					"description" : "Descripción del gastroOffer 22"
				},
				{
					"langCode": "en",
					"name" : "GastroOffer 1",
					"description" : "Description of gastroOffer 22"
				}
			],
			"active" : "true",
            "type" : "57e557b687ae842825ae6d22",
            "season" : "57e557b687ae842825ae6d23",
            "composition" : []
		}
	]
}
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.addVersion = (req, res) => {
  var account = req.userData;
  var inGastroOffer = req.body;
  var gastroOfferLocations;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  });
  var menuType;
  var sortField = "updatedAt";
  var sortOrder = 1;
  var activeVersion;
  var locationWarning = false;
  var Dish = require("../models/dish");
  var Product = require("../models/product");
  var Drink = require("../models/drinks");
  var Model;

  waterfall(
    [
      (cb) => {
        //Verify maximum number of versions
        GastroOffer.findById(inGastroOffer._id, (err, doc) => {
          if (err) return cb(err);
          if (!doc) {
            var err = new Error("Document not found");
            err.statusCode = 404;
            return cb(err);
          }
          if (doc.versions.length >= config.maxNumVersionsGastroOffer) {
            doc.versions
              .sort(function (a, b) {
                return a[sortField] > b[sortField]
                  ? sortOrder
                  : b[sortField] > a[sortField]
                  ? -sortOrder
                  : 0;
              })
              .shift();
          }
          menuType = doc.type[0];
          cb(null, doc);
        });
      },
      (doc, cb) => {
        //location check: each gastroOffer location should have at least one user location in its upper path. Each gastroOffer's location
        // also includes its upper path.

        gastroOfferLocations = doc.location;
        //Check whether list of gastroOffer locations includes at least one customer location.

        var match = gastroOfferLocations.find((id) => {
          let locId = new ObjectId(id);
          for (var i = 0; i < userLocIds.length; i++) {
            if (userLocIds[i].equals(locId)) return true;
          }
        });

        if (match) {
          cb(null, doc);
        } else {
          var err = new Error("Access to gastroOffer location is not allowed");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        //If new version active, update previous active version to not active
        doc.versions.forEach(function (version) {
          if (version.active == true) version.active = false;
        });

        inGastroOffer.version.last_account = account._id;

        doc.active = inGastroOffer.active;
        doc.location = inGastroOffer.location;
        cb(null, doc);
      },
      (doc, cb) => {
        //Calculate drink composition reference and location cost for gastro offer locations in composition list
        gastroCostHelper.calculateGastroOfferLocCost(
          inGastroOffer.version,
          menuType,
          inGastroOffer.location,
          (err, res) => {
            if (err) {
              logger.error(
                "Error calclating location costs of GastroOffer ",
                err
              );
              return cb(err);
            }

            switch (menuType) {
              case "menu":
              case "dailyMenuCarte":
              case "buffet":
              case "fixedPriceCarte":
                inGastroOffer.version.locationCost = res.locationCost;
                if (menuType == "menu" || menuType == "buffet")
                  inGastroOffer.version.totalCost = res.cost;
                else inGastroOffer.version.meanCost = res.cost;

                break;

              case "catalog":
              case "carte":
                //Nothing to do. In this case the function calculateGastroOfferLocCost is just used to save the location cost
                //of the gastro elements (dishes, drinks or products) in each gastro element of the composition array.
                break;
            }

            cb(null, doc);
          }
        );
      },
      (doc, cb) => {
        doc.versions.push(inGastroOffer.version);
        doc.save((err, savedDoc) => {
          if (err) {
            logger.error("Could not save new version of gastro offer", err);
            return cb(err);
          }
          cb(null, savedDoc);
        });
      },
      (savedDoc, cb) => {
        //Populate composition elements

        //Get active version (should be last one in the array)
        activeVersion = savedDoc.versions.find(function (version) {
          return version.active == true;
        });

        if (activeVersion) {
          //Populate composition elements
          async.eachSeries(
            activeVersion.composition,
            function (compElement, cb_async) {
              if (compElement.element.kind == "dish") {
                Model = Dish;
              } else if (compElement.element.kind == "product") {
                Model = Product;
              } else if (compElement.element.kind == "drink") {
                Model = Drink;
              }

              Model.populate(
                compElement,
                { path: "element.item" },
                (err, compElement) => {
                  if (err) return cb_async(err);
                  //Filter active version
                  let activeVersion = compElement.element.item.versions.find(
                    (version) => {
                      return version.active == true;
                    }
                  );
                  compElement.element.item.versions = activeVersion;
                  cb_async();
                }
              );
            },
            (err) => {
              //finished async loop
              if (err) return cb(err);
              logger.info("Populated gastro offer composition items.");
              cb(null, savedDoc);
              //console.log(doc,'docGOgetVersion')
            }
          );
        } else {
          logger.error("Could not find active version of gastro offer.");
          cb(null, true);
        }
      },
      (savedDoc, cb) => {
        //Check all composition element's location include the gastro offer's locations

        if (activeVersion) {
          activeVersion.composition.forEach((compElement) => {
            let included = savedDoc.location.every((l1) => {
              let loc1 = new ObjectId(l1);
              return compElement.element.item.location.some((l2) => {
                let loc2 = new ObjectId(l2);
                return loc2.equals(loc1);
              });
            });
            if (!included) locationWarning = true;
          });
          cb(null, savedDoc);
        } else {
          cb(null, savedDoc);
        }
      },
      (savedDoc, cb) => {
        //Build res object with gastro id and version id
        let res = {
          id: savedDoc._id,
          activeVersionId: activeVersion._id,
          locationWarning: locationWarning,
        };

        cb(null, res);
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
/**
 * @api {delete} /gastro-offer Delete gastroOffer
 * @apiGroup {gastroOffer}
 * @apiName Delete GastroOffer
 *
 * @apiDescription Delete a gastroOffer
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  GastroOffer id
 *
 * @apiSuccess {Object} GastroOffer removed
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.remove = (req, res) => {
  let userProfile = req.userData;
  let params = req.query;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var gastroOfferLocations;
  var gastroOfferId = new ObjectId(params._id);
  var versionId = new ObjectId(params._versionId); //params.location is a string

  waterfall(
    [
      (cb) => {
        //location check. Verify that at least one user location is within the gastroOffer's locations

        if (mongoose.Types.ObjectId.isValid(params._id)) {
          GastroOffer.findById(gastroOfferId, (err, doc) => {
            if (err) cb(err);
            if (!doc) {
              var err = new Error("Document not found");
              err.statusCode = 404;
              return cb(err);
            }
            //Check whether list of gastroOffer locations includes at least one customer location.
            gastroOfferLocations = doc.location;

            var match = gastroOfferLocations.find((id) => {
              let locId = new ObjectId(id);
              for (var i = 0; i < userLocIds.length; i++) {
                if (userLocIds[i].equals(locId)) return true;
              }
            });

            if (match) {
              cb(null, doc);
            } else {
              var err = new Error(
                "Access to gastroOffer location is not allowed"
              );
              err.statusCode = 400;
              return cb(err);
            }
          });
        } else {
          var err = new Error("Invalid Object Id");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        //remove gastroOffer
        doc.remove(function (err, doc) {
          if (err) return cb(err);
          cb(null, doc);
        });
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

/**
 * @api {delete} /gastro-offer/version Delete gastroOffer version
 * @apiGroup {gastroOffer}
 * @apiName Get GastroOffer
 *
 * @apiDescription Delete a gastroOffer version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  GastroOffer id
 * @apiParam {string} _versionId  GastroOffer version id
 *
 * @apiSuccess {Object} GastroOffer version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.removeVersion = (req, res) => {
  //Can't delete an active version
  //Can't delete if there is only one version left
  //Can't delete if the gastroOffer is not within the user's location zone
  let userProfile = req.userData;
  let params = req.query;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var gastroOfferLocations;
  var gastroOfferId = new ObjectId(params._id);
  var versionId = new ObjectId(params._versionId); //params.location is a string

  waterfall(
    [
      (cb) => {
        //Verify gastroOffer exists

        if (
          mongoose.Types.ObjectId.isValid(params._id) &&
          mongoose.Types.ObjectId.isValid(params._versionId)
        ) {
          GastroOffer.findById(gastroOfferId, (err, doc) => {
            if (err) cb(err);
            if (!doc) {
              let err = new Error("Document not found");
              err.statusCode = 404;
              return cb(err);
            }
            cb(null, doc);
          });
        } else {
          let err = new Error("ObjectId not valid");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        //Verify there are at least 2 versions

        if (doc.versions.length < 2) {
          let err = new Error(
            "It is not possible to remove the only version of the gastroOffer"
          );
          err.statusCode = 400;
          return cb(err);
        } else {
          cb(null, doc);
        }
      },
      (doc, cb) => {
        //location check. Verify that at least one user location is within the gastroOffer's locations

        //Check whether list of gastroOffer locations includes at least one customer location.
        gastroOfferLocations = doc.location;

        var match = gastroOfferLocations.find((id) => {
          let locId = new ObjectId(id);
          for (var i = 0; i < userLocIds.length; i++) {
            if (userLocIds[i].equals(locId)) return true;
          }
        });

        if (match) {
          cb(null, doc);
        } else {
          var err = new Error("Access to gastroOffer location is not allowed");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        //remove version
        for (var i = 0; i < doc.versions.length; i++) {
          let obj = doc.versions[i];
          let id = new ObjectId(obj._id);
          if (id.equals(versionId)) {
            doc.versions.splice(i, 1);
          }
        }

        doc.save(function (err) {
          if (err) return cb(err);
          cb(null, doc);
        });
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

/**
 * @api {put} /gastro-offer/version Set version as active
 * @apiGroup {gastroOffer}
 * @apiName Set As Active
 *
 * @apiDescription Set a gastroOffer version as active
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  GastroOffer id
 * @apiParam {string} _versionId  GastroOffer version id
 *
 * @apiSuccess {Object} GastroOffer active version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.setAsActiveVersion = (req, res) => {
  //sets gastroOffer version as active
  //Location check
  //Must make the previous version not active
  let userProfile = req.userData;
  let params = req.query;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var gastroOfferLocations;
  var gastroOfferId = new ObjectId(params._id);
  var versionId = new ObjectId(params.versionId); //params.location is a string
  let activeGastroVersion;
  var MeasUnit = require("../models/measurementUnit");
  var GastroOffer = require("../models/gastroOffer");
  var Drink = require("../models/drinks");
  var Dish = require("../models/dish");
  var Product = require("../models/product");
  var Model;
  var menuType = params.menuType;
  //If a gastroOffer type is provided, build the filter gastroOffer pipeline.

  waterfall(
    [
      (cb) => {
        //location check. Verify that at least one user location is within the gastroOffer's locations
        if (
          mongoose.Types.ObjectId.isValid(gastroOfferId) &&
          mongoose.Types.ObjectId.isValid(versionId)
        ) {
          GastroOffer.findById(gastroOfferId, (err, doc) => {
            if (err) return cb(err);
            if (!doc) {
              let err = new Error("Document not found");
              err.statusCode = 404;
              return cb(err);
            }
            gastroOfferLocations = doc.location;
            //Check whether list of gastroOffer locations includes at least one customer location.

            var match = gastroOfferLocations.find((id) => {
              let locId = new ObjectId(id);
              for (var i = 0; i < userLocIds.length; i++) {
                if (userLocIds[i].equals(locId)) return true;
              }
            });
            if (match) {
              cb(null, doc);
            } else {
              var err = new Error(
                "Access to gastroOffer location is not allowed"
              );
              err.statusCode = 400;
              return cb(err);
            }
          });
        } else {
          let err = new Error("ObjectId not valid");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        //Update previous active version to not active
        doc.versions.forEach(function (version) {
          if (version.active == true) version.active = false;
        });

        //Update version to active
        doc.versions.forEach(function (version) {
          let id = new ObjectId(version._id);
          if (id.equals(versionId)) {
            version.active = true;
            activeGastroVersion = version;
          }
        });

        cb(null, doc);
      },
      (doc, cb) => {
        async.eachSeries(
          activeGastroVersion.composition,
          function (compElement, cb_async) {
            if (compElement.element.kind == "dish") {
              Model = Dish;
            } else if (compElement.element.kind == "product") {
              Model = Product;
            } else if (compElement.element.kind == "drink") {
              Model = Drink;
            }

            Model.populate(
              compElement,
              { path: "element.item" },
              (err, compElement) => {
                if (err) return cb(err);
                //Filter active version
                let activeVersion = compElement.element.item.versions.filter(
                  (version) => {
                    return version.active == true;
                  }
                );

                compElement.element.item.versions = activeVersion;

                cb_async();
              }
            );
          },
          (err) => {
            //finished async loop
            cb(null, doc);
            //console.log(doc,'docGOgetVersion')
          }
        );
      },
      (doc, cb) => {
        activeGastroVersion.composition.forEach((compElement) => {
          compElement.element.item = compElement.element.item._id;
        });
        cb(null, doc);
      },
      (doc, cb) => {
        gastroCostHelper.calculateGastroOfferLocCost(
          activeGastroVersion,
          menuType,
          gastroOfferLocations,
          (err, res) => {
            if (err) return cb(err);
            switch (menuType) {
              case "menu":
              case "dailyMenuCarte":
              case "buffet":
              case "fixedPriceCarte":
                activeGastroVersion.locationCost = res.locationCost;

                if (menuType == "menu" || menuType == "buffet")
                  activeGastroVersion.totalCost = res.cost;
                else activeGastroVersion.meanCost = res.cost;
                break;
              case "catalog":
              case "carte":
                //Nothing to do. In this case the function calculateGastroOfferLocCost is just used to save the location cost
                //of the gastro elements (dishes, drinks or products) in each gastro element of the composition array.
                break;
            }

            cb(null, doc);
          }
        );
      },
      (doc, cb) => {
        //save doc

        doc.save(function (err) {
          if (err) return cb(err);
          cb(null, doc);
        });
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

/**
 * @api {get} /gastro-offer Get all gastroOffers within the user's locations with pagination and filter
 * @apiGroup {gastroOffer}
 * @apiName Get All
 *
 * @apiDescription Get all families in a category with pagination, ordering and filters
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *  @apiParam {int} perPage  Records per page.
 *  @apiParam {int} page  Page number.
 *  @apiParam {string} orderBy  Ordering column (minus for inverse ordering).
 *  @apiParam {string} menuType  Type of gastroOffer.
 *  @apiParam {string} filterText  Text to filter (in name field).
 *  @apiParam {string} location  Array of location id to filter.
 *  @apiParam {string} family  Family id to filter.
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getAll = (req, res) => {
  //Gets the active version of all gastroOffers that are in the user's zone.
  let userProfile = req.userData;
  let params = req.query;
  var filterText = params.filterText || "";
  var sortField = params.sortField || "lang.description";
  var sortOrder = Number(params.sortOrder) || 1;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var filterLocation;
  var menuType;
  var filterLocationPipeline = {};
  var filterGastroOfferTypePipeline = {};
  var filterFamilyTypePipeline = {};
  var filterSeasonPipeline = {};
  var GastroOffer = require("../models/gastroOffer");
  var activePipeline;

  waterfall(
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

        activePipeline = {};
        if (params.active) {
          if (params.active == "true") activePipeline = { active: true };
          else if (params.active == "false") activePipeline = { active: false };
        }

        //If an array of filter locations if provided, build the filter location pipeline
        if (filterLocation.length > 0) {
          filterLocationPipeline = { location: { $in: filterLocation } };
        }

        //If a gastroOffer type is provided, build the filter gastroOffer pipeline.
        if (params.menuType) {
          filterGastroOfferTypePipeline = { type: params.menuType };
        }

        //If an id is provided for filtering gastroOffer family, build the filter type pipeline.
        if (mongoose.Types.ObjectId.isValid(params.family)) {
          filterFamilyTypePipeline = {
            "versions.type": new ObjectId(params.family),
          };
        }

        //If a season id is provided for filtering, build the season type pipeline.
        if (mongoose.Types.ObjectId.isValid(params.filterSeason)) {
          filterSeasonPipeline = {
            "versions.season": new ObjectId(params.filterSeason),
          };
        }

        cb(null, true);
      },
      (ok, cb) => {
        GastroOffer.aggregate(
          [
            {
              $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$versions.lang",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              // Alternative to populate to use filters on aggregate
              $lookup: {
                from: "families",
                localField: "versions.type",
                foreignField: "_id",
                as: "versions.type",
              },
            },
            { $unwind: "$versions.type" },
            { $unwind: "$versions.type.lang" },
            {
              // Alternative to populate to use filters on aggregate
              $lookup: {
                from: "families",
                localField: "versions.season",
                foreignField: "_id",
                as: "versions.season",
              },
            },
            { $unwind: "$versions.season" },
            { $unwind: "$versions.season.lang" },
            { $match: activePipeline },
            { $match: filterGastroOfferTypePipeline },
            { $match: { "versions.active": true } },
            { $match: { location: { $in: userLocIds } } },
            { $match: filterLocationPipeline },
            { $match: filterFamilyTypePipeline },
            { $match: filterSeasonPipeline },
            { $match: { "versions.lang.langCode": userProfile.user.language } },
            { $match: { "versions.type.lang.langCode": userProfile.user.language } },
            { $match: { "versions.season.lang.langCode": userProfile.user.language } },            
            {
              $match: {
                $or: [
                  {
                    "versions.lang.name": { $regex: filterText, $options: "i" },
                  },
                  {
                    "versions.type.lang.name": {
                      $regex: filterText,
                      $options: "i",
                    },
                  },
                  {
                    "versions.season.lang.name": {
                      $regex: filterText,
                      $options: "i",
                    },
                  },
                ],
              },
            },
            { $sort: { [sortField]: sortOrder } },
            { $skip: Number(params.perPage) * Number(params.page) },
            { $limit: Number(params.perPage) },
          ],
          (err, docs) => {
            if (err) return cb(err);

            GastroOffer.populate(docs, { path: "location" }, (err, docs) => {
              if (err) return cb(err);
              cb(null, docs);
            });
          }
        );
      },
      (docs, cb) => {
        //Create location text list

        let locationList;

        docs.forEach((gastro) => {
          locationList = "";

          gastro.location.forEach((loc, index) => {
            if (index < gastro.location.length - 1)
              locationList = locationList + loc.name + ", ";
            else locationList = locationList + loc.name;
          });
          gastro.locationList = locationList;
        });

        cb(null, docs);
      },
      (docs, cb) => {
        //Map location array back to _ids

        docs.forEach((gastro) => {
          gastro.location = gastro.location.map((loc) => {
            return loc._id;
          });
        });

        cb(null, docs);
      },
      (docs, cb) => {
        //Update average location cost based on filterLocation

        gastroCostHelper.calculateAvgGastroLocCost(docs);
        cb(null, docs);
      },
      (docs, cb) => {
        //Get total number of elements for pagination. Must run another request without sort, skip and limit.
        GastroOffer.aggregate(
          [
            {
              $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$versions.lang",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              // Alternative to populate to use filters on aggregate
              $lookup: {
                from: "families",
                localField: "versions.type",
                foreignField: "_id",
                as: "versions.type",
              },
            },
            { $unwind: "$versions.type" },
            { $unwind: "$versions.type.lang" },
            {
              // Alternative to populate to use filters on aggregate
              $lookup: {
                from: "families",
                localField: "versions.season",
                foreignField: "_id",
                as: "versions.season",
              },
            },
            { $unwind: "$versions.season" },
            { $unwind: "$versions.season.lang" },
            { $match: activePipeline },
            { $match: filterGastroOfferTypePipeline },
            { $match: { "versions.active": true } },
            { $match: { "versions.lang.langCode": userProfile.user.language } },
            { $match: { location: { $in: userLocIds } } },
            { $match: filterLocationPipeline },
            { $match: filterFamilyTypePipeline },
            { $match: filterSeasonPipeline },
            {
              $match: {
                $or: [
                  {
                    "versions.lang.name": { $regex: filterText, $options: "i" },
                  },
                  {
                    "versions.type.lang.name": {
                      $regex: filterText,
                      $options: "i",
                    },
                  },
                  {
                    "versions.season.lang.name": {
                      $regex: filterText,
                      $options: "i",
                    },
                  },
                ],
              },
            },
            { $project: { _id: 1 } },
          ],
          (err, docCount) => {
            if (err) return cb(err);

            let gastroOffers = {
              gastroOffers: docs,
              totalElements: docCount.length,
            };
            cb(null, gastroOffers);
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

/**
 * @api {get} /gastro-offer/lang Get user lang field of gastroOffer version
 * @apiGroup {gastroOffer}
 * @apiName Get GastroOffer user lang
 *
 * @apiDescription Get user lang of product version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  GastroOffer id
 * @apiParam {string} versionId  Product version id
 *
 * @apiSuccess {Object} GastroOffer user lang
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getUserLang = (req, res) => {
  //Todo: update all composition elements name in case name has changed
  let userProfile = req.userData;
  let params = req.query;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var gastroOfferLocations;
  var gastroOfferId = new ObjectId(params._id);
  var versionId = new ObjectId(params._versionId); //params.location is a string

  waterfall(
    [
      (cb) => {
        //location check. Verify that at least one user location is within the gastroOffer's locations

        if (
          mongoose.Types.ObjectId.isValid(gastroOfferId) &&
          mongoose.Types.ObjectId.isValid(versionId)
        ) {
          GastroOffer.findById(gastroOfferId, (err, doc) => {
            if (err) cb(err);
            if (!doc) {
              let err = new Error("Document not found");
              err.statusCode = 404;
              return cb(err);
            }
            gastroOfferLocations = doc.location;
            //Check whether list of gastroOffer locations includes at least one customer location.

            var match = gastroOfferLocations.find((id) => {
              let locId = new ObjectId(id);
              for (var i = 0; i < userLocIds.length; i++) {
                if (userLocIds[i].equals(locId)) return true;
              }
            });
            if (match) {
              cb(null, match);
            } else {
              var err = new Error(
                "Access to gastroOffer location is not allowed"
              );
              err.statusCode = 400;
              return cb(err);
            }
          });
        } else {
          let err = new Error("ObjectId not valid");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        GastroOffer.aggregate(
          [
            {
              $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$versions.lang",
                preserveNullAndEmptyArrays: true,
              },
            },
            { $match: { _id: gastroOfferId } },
            { $match: { "versions._id": versionId } },
            { $match: { "versions.lang.langCode": userProfile.user.language } },
          ],
          (err, doc) => {
            if (err) {
              return cb(err);
            }

            let userLangObj = {
              userLang: doc[0].versions.lang,
            };
            cb(null, userLangObj);
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

/**
 * @api {get} /gastro-offer/version Get gastroOffer version
 * @apiGroup {gastroOffer}
 * @apiName Get GastroOffer
 *
 * @apiDescription Get a gastroOffer version
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  GastroOffer id
 * @apiParam {string} versionId  GastroOffer version id
 *
 * @apiSuccess {Object} GastroOffer version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getVersion = (req, res) => {
  //Todo: update all composition elements name in case name has changed
  let userProfile = req.userData;
  let params = req.query;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var gastroOfferLocations;
  var gastroOfferId = new ObjectId(params._id);
  var versionId = new ObjectId(params._versionId); //params.location is a string
  var Model;
  var Dish = require("../models/dish");
  var Drink = require("../models/drinks");
  var Product = require("../models/product");
  var Family = require("../models/family");
  var filterLocation;

  if (params.filterLocation) {
    filterLocation = JSON.parse(params.filterLocation).map(function (doc) {
      return new ObjectId(doc);
    });
  } else {
    filterLocation = [];
  }

  waterfall(
    [
      (cb) => {
        //location check. Verify that at least one user location is within the gastroOffer's locations

        if (
          mongoose.Types.ObjectId.isValid(gastroOfferId) &&
          mongoose.Types.ObjectId.isValid(versionId)
        ) {
          GastroOffer.findById(gastroOfferId, (err, doc) => {
            if (err) cb(err);
            if (!doc) {
              let err = new Error("Document not found");
              err.statusCode = 404;
              return cb(err);
            }
            gastroOfferLocations = doc.location;
            //Check whether list of gastroOffer locations includes at least one customer location.

            var match = gastroOfferLocations.find((id) => {
              let locId = new ObjectId(id);
              for (var i = 0; i < userLocIds.length; i++) {
                if (userLocIds[i].equals(locId)) return true;
              }
            });
            if (match) {
              cb(null, match);
            } else {
              var err = new Error(
                "Access to gastroOffer location is not allowed"
              );
              err.statusCode = 400;
              return cb(err);
            }
          });
        } else {
          let err = new Error("ObjectId not valid");
          err.statusCode = 400;
          return cb(err);
        }
      },
      (doc, cb) => {
        GastroOffer.aggregate(
          [
            {
              $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true,
              },
            },
            { $match: { _id: gastroOfferId } },
            { $match: { "versions._id": versionId } },
          ],
          (err, doc) => {
            if (err) return cb(err);
            cb(null, doc);
          }
        );
      },
      (doc, cb) => {
        //Populate type and season
        GastroOffer.populate(
          doc,
          {
            path:
              "versions.type versions.season versions.composition.element.item",
          },
          (err, doc) => {
            if (err) return cb(err);
            cb(null, doc);
          }
        );
      },
      (doc, cb) => {
        //Filter dish or product or drink lang field based on user language
        async.eachSeries(
          doc[0].versions.composition,
          function (compElement, cb_async) {
            if (compElement.element.kind == "dish") {
              Model = Dish;
            } else if (compElement.element.kind == "product") {
              Model = Product;
            } else if (compElement.element.kind == "drink") {
              Model = Drink;
            }

            Model.populate(
              compElement,
              { path: "element.item" },
              (err, compElement) => {
                if (err) return cb(err);

                if (compElement.element.item != null) {
                  //Filter active version
                  let activeVersion = compElement.element.item.versions.filter(
                    (version) => {
                      return version.active == true;
                    }
                  );

                  if (activeVersion.length) {
                    compElement.element.item.versions = activeVersion;
                    compElement.allergens = activeVersion.allergens || [];
                    compElement.locationAllergens =
                      activeVersion.locationAllergens || [];

                    compElement.active = compElement.element.item.active;
                    if (compElement.element.kind == "product") {
                      compElement.cost =
                        compElement.element.item.versions[0].unitCost;
                      if (compElement.element.item.versions[0].netWeight)
                        compElement.netWeight =
                          compElement.element.item.versions[0].netWeight;
                      else compElement.netWeight = 0;

                      if (compElement.element.item.versions[0].totalLocCost) {
                        compElement.locationCost =
                          compElement.element.item.versions[0].totalLocCost;
                      } else {
                        compElement.locationCost = [];
                      }
                    } else {
                      //drink or dish
                      compElement.cost =
                        compElement.element.item.versions[0].costPerServing;
                      if (compElement.element.item.versions[0].locationCost) {
                        compElement.locationCost =
                          compElement.element.item.versions[0].locationCost;
                      } else {
                        compElement.locationCost = [];
                      }
                    }

                    //Update composition element unitCost with average location cost based on filterLocation
                    gastroCostHelper.calculateGastroElementAvgLocCostAndAllergens(
                      compElement,
                      doc[0].location
                    );

                    //Filter user language
                    let userLang = [];

                    userLang = compElement.element.item.versions[0].lang.filter(
                      (langItem) => {
                        return langItem.langCode == userProfile.user.language;
                      }
                    );

                    if (userLang.length) {
                      compElement.element.item.versions[0].lang = userLang[0];
                      compElement.name = userLang[0].name;
                    }

                    cb_async();
                  } else {
                    logger.error(
                      "Could not retrive active version of recipe in gastro offer composition."
                    );
                    let err = new Error(
                      "Could not retrive active version of recipe in gastro offer composition."
                    );
                    return cb_async(err);
                  }
                } else {
                  compElement.itemNull = true;
                  logger.error("Could not populate recipe in gastro offer");
                  let err = new Error(
                    "Could not populate recipe in gastro offer"
                  );
                  return cb_async(err);
                }
              }
            );
          },
          (err) => {
            //finished async loop
            cb(null, doc);
            //console.log(doc,'docGOgetVersion')
          }
        );
      },
      (doc, cb) => {
        //Check all composition element's location include the gastro offer location

        doc[0].versions.composition.forEach((compElement) => {
          let included = doc[0].location.every((l1) => {
            let loc1 = new ObjectId(l1);
            if (compElement.element.item) {
              return compElement.element.item.location.some((l2) => {
                let loc2 = new ObjectId(l2);
                return loc2.equals(loc1);
              });
            } else {
              return true;
            }
          });

          if (!included) compElement.locationWarning = true;
          else compElement.locationWarning = false;
        });

        cb(null, doc);
      },
    ],
    (err, doc) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      //console.log(ok[0].versions.composition, 'gastro offer version')
      res.status(200).json(doc).end();
    }
  );
};

/**
 * @api {get} /gastro-offer/versions Get all gastroOffer's versions
 * @apiGroup {gastroOffer}
 * @apiName Get GastroOffer Versions
 *
 * @apiDescription Get all gastroOffer's versions
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  GastroOffer id
 *
 * @apiSuccess {Object} GastroOffer version
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getAllVersions = (req, res) => {
  //Gets the active version of all gastroOffers that are in the user's zone.
  let userProfile = req.userData;
  let params = req.query;
  var gastroOfferId = new ObjectId(params._id);
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  var filterLocation;

  waterfall(
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

        params.sort = { "versions.updatedAt": -1 };

        GastroOffer.aggregate(
          [
            {
              $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$versions.lang",
                preserveNullAndEmptyArrays: true,
              },
            },
            { $match: { _id: gastroOfferId } },
            { $match: { "versions.lang.langCode": userProfile.user.language } },
            { $sort: params.sort },
            { $skip: Number(params.perPage) * Number(params.page) },
            { $limit: Number(params.perPage) },
          ],
          (err, docs) => {
            if (err) {
              return cb(err);
            }
            GastroOffer.populate(
              docs,
              { path: "versions.type versions.season versions.last_account" },
              (err, docs) => {
                if (err) {
                  return cb(err);
                }
                cb(null, docs);
              }
            );
          }
        );
      },
      (docs, cb) => {
        //Populate user in last_account

        User.populate(
          docs,
          { path: "versions.last_account.user" },
          (err, docs) => {
            if (err) return cb(err);
            cb(null, docs);
          }
        );
      },
      (docs, cb) => {
        //Update average location cost based on filterLocation

        if (params.filterLocation) {
          gastroCostHelper.calculateAvgGastroLocCost(docs);
        }

        cb(null, docs);
      },
      (docs, cb) => {
        //Get total number of elements for pagination
        GastroOffer.aggregate(
          [
            {
              $unwind: {
                path: "$versions",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$versions.lang",
                preserveNullAndEmptyArrays: true,
              },
            },
            { $match: { _id: gastroOfferId } },
            { $match: { "versions.lang.langCode": userProfile.user.language } },
          ],
          (err, docsCount) => {
            if (err) {
              return cb(err);
            }

            let length = docsCount.length;

            let versions = {
              versions: docs,
              totalElements: length,
            };

            cb(null, versions);
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

/**
 * @api {get} /gastro-offer/activeversion Gets active version of gastroOffer
 * @apiGroup {gastroOffer}
 * @apiName Get GastroOffer's Active Version
 *
 * @apiDescription Gets our active Version of GastroOffer
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  GastroOffer id
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getActiveVersion = (req, res) => {
  let userProfile = req.userData;
  let params = req.query;
  params.filterText = params.filterText || "";
  var gastroOfferId = new ObjectId(params._id);
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  }); //Array of ObjectId
  waterfall(
    [
      (cb) => {
        GastroOffer.aggregate(
          [
            { $unwind: { path: "$versions" } },
            { $match: { location: { $in: userLocIds } } },
            { $match: { _id: gastroOfferId } },
            { $match: { "versions.active": true } },
          ],
          (err, doc) => {
            if (err) return cb(err);
            cb(null, doc);
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

/**
 * @api {get} /gastroOffer/duplicate Duplicates gastro-offer
 * @apiGroup {dish}
 * @apiName Duplicates active version of gastro-offer
 *
 * @apiDescription Duplicates active version of gastro-offer
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  gastro-offer id to be duplicated
 * @apiParam {string} name  New gastro-offer name (in user's language)
 * @apiParam {string} location  Location for new gastro-offer
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.duplicate = (req, res) => {
  let userProfile = req.userData;
  let params = req.query;
  var gastroOfferId = new ObjectId(params._id);
  var account = req.userData;
  var activeVersion;

  waterfall(
    [
      (cb) => {
        //Get active version of dish to be duplicated, without _id

        if (mongoose.Types.ObjectId.isValid(gastroOfferId)) {
          GastroOffer.findOne(
            {
              _id: gastroOfferId,
            },
            {
              _id: 0,
              active: 1,
              ref: 1,
              type: 1,
              referenceNumber: 1,
              location: 1,
              versions: { $elemMatch: { active: true } },
            }
          ).exec((err, doc) => {
            if (err) return cb(err);
            cb(null, doc);
          });
        } else {
          let err = new Error("Must provide a valid GastroOffer id");
          err.statusCode = 402;
          return cb(err);
        }
      },
      (doc, cb) => {
        //Must convert doc to JSON otherwise mongo throws error
        doc = doc.toJSON();

        activeVersion = doc.versions[0];

        if (params.name) {
          //Set lang to [] before re-setting it
          activeVersion.lang = [];

          let langObj = {
            langCode: userProfile.user.language,
            name: params.name,
          };

          activeVersion.lang.push(langObj);
        } else {
          //Filter lang by user language
          let userLang = activeVersion.lang.filter((lang) => {
            return lang.langCode == userProfile.user.language;
          });

          let name = "copy of " + userLang[0].name;

          activeVersion.lang = [];

          let langObj = {
            langCode: userProfile.user.language,
            name: name.toUpperCase(),
          };

          activeVersion.lang.push(langObj);
        }

        doc.versions = [];
        doc.versions.push(activeVersion);

        //If params.location provided, set the new location of the duplicate document
        if (params.location) {
          let location = JSON.parse(params.location).map(function (doc) {
            return new ObjectId(doc);
          });
          doc.location = location;
        }

        cb(null, doc);
      },
      (doc, cb) => {
        //Calculate drink composition reference and location cost for gastro offer locations in composition list
        gastroCostHelper.calculateGastroOfferLocCost(
          activeVersion,
          doc.type[0],
          doc.location,
          (err, res) => {
            if (err) return cb(err);

            switch (doc.type[0]) {
              case "menu":
              case "dailyMenuCarte":
              case "buffet":
              case "fixedPriceCarte":
                doc.versions[0].locationCost = res.locationCost;
                if (doc.type[0] == "menu" || doc.type[0] == "buffet") {
                  doc.versions[0].totalCost = res.cost;
                } else {
                  doc.versions[0].meanCost = res.cost;
                }

                break;

              case "catalog":
              case "carte":
                //Nothing to do. In this case the function calculateGastroOfferLocCost is just used to save the location cost
                //of the gastro elements (dishes, drinks or products) in each gastro element of the composition array.
                break;
            }

            cb(null, doc);
          }
        );
      },
      (doc, cb) => {
        switch (doc.type) {
          case "menu":
            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.menu
            );
            break;
          case "dailyMenuCarte":
            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.dailyMenuCarte
            );
            break;
          case "buffet":
            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.buffet
            );
            break;
          case "carte":
            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.carte
            );
            break;
          case "fixedPriceCarte":
            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.fixedPriceCarte
            );
            break;
          case "catalog":
            doc.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
              config.refNumberPrefixes.catalog
            );
            break;
        }

        let duplicate = new GastroOffer(doc);
        duplicate.save((err, dup) => {
          if (err) return cb(err);
          cb(null, dup);
        });
      },
    ],
    (err, dup) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      res.status(200).json(dup).end();
    }
  );
};

/**
 * @api {get} /gastro-offer/locationcost Get gastro offer cost by location
 * @apiGroup {gastro-offer}
 * @apiName Get gastro-offer location costs
 *
 * @apiDescription Get gastro-offer location costs. First cost in the array is the reference costPerServing.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Gastro Offer id
 * @apiParam {string} menuType  Type of gastroOffer.
 *
 * @apiVersion 0.1.0
 *
 */

exports.getLocationCost = (req, res) => {
  var gastroOfferId = new ObjectId(req.query._id);
  var versionId = new ObjectId(req.query.versionId);
  var userData = req.userData;
  var locationCostArray = [];
  let params = req.query;
  var menuType = params.menuType;
  var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function (doc) {
    return new ObjectId(doc._id);
  });
  var gastroOffer;

  waterfall(
    [
      (cb) => {
        GastroOffer.findOne(
          {
            _id: gastroOfferId,
          },
          {
            _id: 0,
            active: 1,
            versions: { $elemMatch: { _id: versionId } },
          }
        ).exec((err, doc) => {
          if (err) return cb(err);
          if (!doc) {
            var err = new Error("Document not found or empty");
            err.statusCode = 400;
            return cb(err);
          }
          gastroOffer = JSON.parse(JSON.stringify(doc));
          let activeVersion = gastroOffer.versions[0];
          activeVersion.locationCost = [];
          gastroOffer.versions = activeVersion;
          //console.log(gastroOffer, 'gastroOffer')
          cb(null, doc);
        });
      },
      (doc, cb) => {
        //If a gastroOffer type is provided, build the filter gastroOffer pipeline.
        let filterGastroOfferTypePipeline = {};
        if (params.menuType) {
          filterGastroOfferTypePipeline = { type: menuType };
        }

        let unwindCost = {};

        switch (menuType) {
          case "menu":
          case "buffet":
            unwindCost = { path: "$totalCost" };
            break;

          case "dailyMenuCarte":
          case "fixedPriceCarte":
            unwindCost = { path: "$meanCost" };
            break;
        }

        GastroOffer.aggregate(
          [
            { $match: { _id: gastroOfferId } },
            { $unwind: { path: "$versions" } },
            { $match: { "versions._id": versionId } },
            {
              $unwind: {
                path: "$versions.locationCost",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $match: { "versions.locationCost.location": { $in: userLocIds } },
            },
            {
              // Alternative to populate
              $lookup: {
                from: "locations",
                localField: "versions.locationCost.location",
                foreignField: "_id",
                as: "versions.locationCost.location",
              },
            },
            {
              $unwind: {
                path: "$versions.locationCost.location",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $group: {
                _id: "$_id",
                locationCost: { $push: "$versions.locationCost" },
                meanCost: { $addToSet: "$versions.meanCost" },
                totalCost: { $addToSet: "$versions.totalCost" },
              },
            },
            { $unwind: unwindCost },
          ],
          (err, doc) => {
            if (err) return cb(err);

            if (!doc) {
              var err = new Error("Document not found or empty");
              err.statusCode = 400;
              return cb(err);
            }

            if (!doc.length) {
              cb(null, gastroOffer);
            } else {
              let res = {
                _id: doc[0]._id,
                versions: {
                  locationCost: doc[0].locationCost,
                  meanCost: doc[0].meanCost,
                  totalCost: doc[0].totalCost,
                },
              };
              cb(null, res);
            }
          }
        );
      },
      (doc, cb) => {
        if (doc.versions.locationCost && doc.versions.locationCost.length)
          locationCostArray = locationCostArray.concat(
            doc.versions.locationCost
          ); //add location prices to array

        locationCostArray = locationCostArray.filter((item) => {
          //remove items with cost zero
          return item.unitCost != 0;
        });

        let value = 0;

        switch (menuType) {
          case "menu":
          case "buffet":
            value = doc.versions.totalCost;
            break;

          case "dailyMenuCarte":
          case "fixedPriceCarte":
            value = doc.versions.meanCost;
            break;

          default:
            //nothing to do
            break;
        }

        //Add unit cost as first element in the array
        let unitCostObject = {
          location: { name: "Reference Cost" },
          unitCost: value,
        };

        locationCostArray.unshift(unitCostObject); //add ref unitcost to array

        cb(null, locationCostArray);
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

//Endpoint created to generate a reference number for each ingredient
//For each Ingredient we generate a field referenceNumber to generate a reference number with helper referenceNumberGenerator
//prefix parameter of helper function only uses to know to which type of element we have generated a reference number, in ingredients prefix will be 'ING-'

exports.generateReferenceNumber = (req, res) => {
  var referenceNumberGeneratorHelper = require("../helpers/referenceNumberGenerator");

  waterfall(
    [
      (cb) => {
        GastroOffer.find({}, (err, docs) => {
          //console.log(docs,'DOCS')
          if (err) {
            cb(err);
          }
          cb(null, docs);
        });
      },
      (docs, cb) => {
        //console.log('entering GET',docs.length)
        async.eachSeries(
          docs,
          function (gastro, cb_async) {
            function generateReferenceNumber() {
              return function () {
                switch (gastro.type[0]) {
                  case "menu":
                    gastro.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
                      config.refNumberPrefixes.menu
                    );
                    break;

                  case "dailyMenuCarte":
                    gastro.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
                      config.refNumberPrefixes.dailyMenuCarte
                    );
                    break;

                  case "buffet":
                    gastro.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
                      config.refNumberPrefixes.buffet
                    );
                    break;

                  case "carte":
                    gastro.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
                      config.refNumberPrefixes.carte
                    );
                    break;

                  case "fixedPriceCarte":
                    gastro.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
                      config.refNumberPrefixes.fixedPriceCarte
                    );
                    break;

                  case "catalog":
                    gastro.referenceNumber = referenceNumberGeneratorHelper.generateReferenceNumber(
                      config.refNumberPrefixes.catalog
                    );
                    break;
                }

                if (gastro.referenceNumber) {
                  //console.log(gastro.referenceNumber,'Reference Number of Gastro-Offer',gastro._id, 'with type:',gastro.type[0])

                  gastro.save((err) => {
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

/**
 * @api {get} /gastro-offer/checkItemsLocation Check composition items valid location
 * @apiGroup {gastro-offer}
 * @apiName Check composition items valid location
 *
 * @apiDescription Ensure that all composition items in a gastro offer have as locations all locations of the parent gastro offer
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Gastro Offer id
 * @apiParam {string} menuType  Type of gastroOffer.
 *
 * @apiVersion 0.1.0
 *
 */

exports.checkItemsLocation = (req, res) => {
  var gastroOfferCount = 0;
  var totalNumGastroOffers;
  var Dish = require("../models/dish");
  var Drink = require("../models/drinks");
  var Product = require("../models/product");
  var gastroOffersWithWarning = [];
  var Model;
  var gastroLocation;

  logger.info("checkItemsLocation - Entering method...");

  async.waterfall(
    [
      (cb) => {
        GastroOffer.count({}, (err, count) => {
          if (err) return cb(err);
          totalNumGastroOffers = count;
          logger.info(
            "checkItemsLocation - There are %s gastro offers to validate",
            totalNumGastroOffers
          );
          cb(null, true);
        });
      },
      (doc, cb) => {
        logger.info("checkItemsLocation - Starting location validation...");

        async.during(
          (callback) => {
            //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
            return callback(null, gastroOfferCount < totalNumGastroOffers);
          },
          (callback) => {
            GastroOffer.findOne(
              {},
              {
                location: 1,
                versions: { $elemMatch: { active: true } },
                type: 1,
              }
            )
              .skip(gastroOfferCount)
              .limit(1)
              .exec((err, doc) => {
                gastroLocation = doc.location;
                logger.info(
                  "checkItemsLocation - Gastro location %j...",
                  gastroLocation
                );

                if (err) callback(err);

                gastroOfferCount++;

                logger.info(
                  "checkItemsLocation - Evaluating gastro %s...",
                  gastroOfferCount
                );

                async.waterfall(
                  [
                    (cb_2) => {
                      //Filter dish or product or drink lang field based on user language
                      async.eachSeries(
                        doc.versions[0].composition,
                        function (compElement, cb_async) {
                          if (compElement.element.kind == "dish") {
                            Model = Dish;
                          } else if (compElement.element.kind == "product") {
                            Model = Product;
                          } else if (compElement.element.kind == "drink") {
                            Model = Drink;
                          }

                          Model.populate(
                            compElement,
                            { path: "element.item" },
                            (err, compElement) => {
                              if (err) return cb_async(err);
                              cb_async();
                            }
                          );
                        },
                        (err) => {
                          //finished async loop
                          if (err) return cb_2(err);
                          logger.info(
                            "Finished populating composition element items"
                          );
                          cb_2(null, doc);
                          //console.log(doc,'docGOgetVersion')
                        }
                      );
                    },
                    (doc, cb_2) => {
                      //Check all composition element's location include the gastro offer location

                      let locationWarning = false;

                      doc.versions[0].composition.forEach((compElement) => {
                        let included = gastroLocation.every((l1) => {
                          let loc1 = new ObjectId(l1);
                          return compElement.element.item.location.some(
                            (l2) => {
                              let loc2 = new ObjectId(l2);
                              return loc2.equals(loc1);
                            }
                          );
                        });

                        if (!included) locationWarning = true;
                      });

                      if (locationWarning) {
                        logger.info(
                          "Push gastro offer %s to location warning array.",
                          doc._id
                        );
                        let obj = {
                          name: doc.versions[0].lang[0].name,
                          type: doc.type,
                        };
                        gastroOffersWithWarning.push(obj);
                      }

                      cb_2(null, true);
                    },
                  ],
                  (err, doc) => {
                    if (err) return callback(err);
                    process.nextTick(() => callback()); //Process next gastro offer
                  }
                );
              });
          },
          (err) => {
            // Finished looping through all gastro offers
            if (err) return cb(err);
            logger.info(
              "checkItemsLocation - Finished looping through all gastro offers"
            );
            logger.info(
              "Identified %s offers of %s with erroneous locations in composition items",
              gastroOffersWithWarning.length,
              totalNumGastroOffers
            );
            cb(null, gastroOffersWithWarning);
          }
        );
      },
    ],
    (err, docs) => {
      if (err)
        return res
          .status(500)
          .json(err.message || "Error")
          .end();
      res.status(200).json(docs).end();
    }
  );
};
