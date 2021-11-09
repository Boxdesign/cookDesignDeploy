'use strict';

 var waterfall = require('async-waterfall');
 var locHelper = require('../helpers/locations');
 var Location = require('../models/location');
 var {ObjectId} = require('mongodb');
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.location;
 //if(process.env.NODE_ENV == 'production'){
// } else {
//  const logger = winston.loggers.get('location').remove(winston.transports.Console)
// }
 

/**
 * @api {POST} /location Create a new location
 * @apiGroup Locations
 * @apiName Create Location
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 * @apiParam (location) {object} location  Location Object.
 *
 *  @apiParamExample {json} Location-Example:
 *     {
 *       "name": "Restaurant Elavon",
 *       "location_type": "businessUnit"
 *       "parent_organization" : "578e04a6df598f322f0aa262",
 *       "parent_company" : "5792335d3ec1292b4740a3ae"
 *     }
 *
 * @apiSuccess {Object} OrganizationId name  short desc
 * @apiError Not Found Object field description
 *
 *
 * @apiVersion 0.1.0
 *
 */
 exports.createLocation = (req, res) => {
    logger.info(req.userData.email);

    waterfall([
        (cb) => {

                //Preparamos los datos

                let lc = {
                    name: req.body.name,
                    location_type: req.body.location_type,
                    creator: req.userData._id, //account
                    gallery: req.body.gallery,
                    lang: req.body.lang
                };

                switch (lc.location_type) {
                    case  'organization':
                        //An organization has no parent organization or parent company
                        //Check if one exists already
                        Location.findOne({'location_type': 'organization'}, '', (err, doc) => {
                            if (err)
                                return cb(err)
                            if (doc) {
                                //Error: there can only be one organization
                                return res.status(400).json(doc).end();
                            }
                        });
                        break;
                        case  'company':
                        lc.parent_organization = req.body.parent_organization;
                        break;
                        case  'businessUnit':
                        lc.parent_organization = req.body.parent_organization;
                        lc.parent_company = req.body.parent_company;
                        break;
                    }
                    let location = new Location(lc);

                    location.save((err) => {
                        if (err)
                            return cb(err);
                        cb(null, location);

                    });
                }
                ],
                (err, success) => {
                    if (err) {
                        logger.error(err);
        								return res.status(500).json(err.message || 'Error').end();
                    }
                    res.status(200).json(success)
                }
                )
};


/**
 * @api {PUT} /location Edit location
 * @apiGroup Locations
 * @apiName Edit Location
 *
 * @ApiHeader (Security) {String}  Authorization auth Token
 *
 * @apiParam (location) {object} location  Location Object.
 *
 *  @apiParamExample {json} Request-Example:
 *     {
 *       "name": "Restaurant Elavon",
 *       "location_type": "businessUnit"
         "parent_organitzation" : "578e04a6df598f322f0aa262",
         "parent_company" : "5792335d3ec1292b4740a3ae"
 *     }
 *
 * @apiSuccess {Object} OrganizationId name  short desc
 * @apiError Not Found Object field description
 *
 *
 * @apiVersion 0.1.0
 *
 */

 exports.editLocation = (req, res) => {

    var userData = req.userData;
    let updateObj = req.body;
    waterfall([
        (cb) => {
            Location.findById(updateObj, function (err, location) {
                if (err) return cb(err);
                if (!location) {
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);                
                } 
  
                location.gallery = updateObj.gallery;
                if(updateObj.name) location.name = updateObj.name; 
                if(updateObj.lang) location.lang = updateObj.lang; 
                location.last_account = userData._id;

                location.save((err, updatedIng) => {
                    if (err) return cb(err);
                    cb(null, updatedIng);
                });
            });
        }], (err, ok) => {
                if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok)
        })
};

/**
 * @api {delete} /location Delete location
 * @apiGroup {location}
 * @apiName Delete location
 *
 * @apiDescription Delete a location
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParamExample {text} Delete-Example:
 *
 *    ?_id=57973cca583324f56361e0f2
 *
 *
 *
 * @apiVersion 0.1.0
 *
 */

 exports.remove = (req, res) => {
    var locationId = new ObjectId(req.query._id);
    var userData = req.userData;

    waterfall([
        (cb) => {
            Location.findById(locationId, (err, doc) => {
                if (err) return cb(err) 
                if (!doc) { 
                    var err=new Error('Document not found');
                    err.statusCode=400;
                    return cb(err);
                }
                cb(null,doc);
            });
        }, (doc, cb) => {
                doc.remove(function (err, doc) {
                    if (err) return cb(err);
                    cb(null, doc);
                });
        }], (err, ok) => {
        		if(err) return res.status(500).json(err.message || 'Error').end();
            res.status(200).json(ok).end();
        })
};



/**
 * @api {get} /location Get User Zone 
 * @apiGroup {location}
 * @apiName Get Zone
 *
 * @apiDescription Get user zone (array of locations to which user can get access)
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  User zone
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getUserLocations = (req, res) => {
    var userLocations = req.userData.location;
    let params = req.query;
    var locations = [];

    waterfall([
        (cb) => {
            //Get locations
            Location.find({})
            .populate ('parent_organization parent_company')
            .exec((err,docs) => {
                if (err) return cb(err);
                cb(null,docs)
            })
        }, (allLocs, cb) => {
                //make location active for locations in user's zone
                allLocs.forEach((loc) => {
                    loc.active=userLocations.some((x) => { return x.equals(loc)});
                })
                //console.log(locs);
                cb(null, allLocs);
        }, (locs, cb) => {
                //format locations into hierarchical array
                let organizations= [];
                let companies = [];
                let businessUnits = []
                let locationsArray = [];

                //Sort out organizations, companies and business units
                locs.forEach((l) => {
                    if (!l.parent_organization){
                        organizations.push(l);
                    }
                    if (!l.parent_company&&l.parent_organization){
                        companies.push(l);
                    }
                    if (l.parent_company&&l.parent_organization){
                        businessUnits.push(l);
                    }
                })
                let indexOrg=0;
                organizations.forEach((org) => {
                    let objOrganization = {
                        "_id" : org._id,
                        "name" : org.name,
                        "referenceNumber": org.referenceNumber,
                        "active" : org.active,
                        "gallery" : org.gallery,
                        "companies": [],
                        "lang": org.lang
                    }
                    locationsArray.push(objOrganization);
                    //console.log(locationsArray);
                    //find companies in organization
                    let indexComp = 0;
                    companies.forEach((comp) => {
                        //console.log('evaluating company', comp.name);
                        if (comp.parent_organization._id.toString()==org._id.toString()){
                            //console.log('found company', comp.name, 'of organization', org.name);
                            let objCompany = {
                                "_id" : comp._id,
                                "name" : comp.name,
                                "referenceNumber": comp.referenceNumber,
                                "active" : comp.active,
                                "gallery" : comp.gallery,
                                "businessUnits": [],
                                "lang": comp.lang,
                                "activeBusinessUnits": true
                            }
                            //console.log('Adding company', comp.name, 'to Organization', org.name, 'in position', indexOrg);
                            locationsArray[indexOrg].companies.push(objCompany);
                            //console.log(locationsArray);
                            //find business units
                            businessUnits.forEach((bu) => {
                                //console.log('evaluating businessUnit', bu.name);
                                if (bu.parent_company._id.toString()==comp._id.toString()&&bu.parent_organization._id.toString()==org._id.toString()){
                                    let objBU = {
                                        "_id" : bu._id,
                                        "name" : bu.name,
                                        "referenceNumber": bu.referenceNumber,
                                        "active" : bu.active,
                                        "gallery" : bu.gallery,
                                        "lang": bu.lang
                                    };
                                    //console.log('Adding business unit', bu.name, 'to company', comp.name, 'in comp position', indexComp);
                                    locationsArray[indexOrg].companies[indexComp].businessUnits.push(objBU);
                                    //console.log(locationsArray);
                                }
                            })
                            indexComp=indexComp+1;
                        }
                    })
                    indexOrg++;
                })
                cb(null, locationsArray)

        		}, (locationsArray, cb) => { //Check whether there are inactive companies with all its business units inactive that can be hidden.

        				locationsArray.forEach((org) => {

        						org.companies.forEach((co) => {

	        							let inactive = co.businessUnits.every((bu) => {
	        								return !bu.active
	        							})

        								if(inactive) co.activeBusinessUnits = false; //It's an inactive company with all its business units inactive. Hide it!
        						})

        				})

        				cb(null, locationsArray)	

            }], (err, locs) => {
        				if(err) return res.status(500).json(err.message || 'Error').end();
                res.status(200).json(locs)
            })
};

/**
 * @api {get} /location Get All Locations 
 * @apiGroup {location}
 * @apiName Get All
 *
 * @apiDescription Get all locations available
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  All Locations
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.getAllLocations = (req, res) => {
    var userLocations = req.userData.location;
    let params = req.query;
    var locations = [];

    waterfall([
        (cb) => {
            //Get locations
            Location.find({})
            .populate ('parent_organization parent_company')
            .exec((err,docs) => {
                if (err) return cb(err);
                cb(null,docs)
            })
            
        }, (locs, cb) => {
                //format locations into hierarchical array
                let organizations= [];
                let companies = [];
                let businessUnits = []
                let locationsArray = [];

                //Sort out organizations, companies and business units
                locs.forEach((l) => {
                    if (!l.parent_organization){
                        organizations.push(l);
                    }
                    if (!l.parent_company&&l.parent_organization){
                        companies.push(l);
                    }
                    if (l.parent_company&&l.parent_organization){
                        businessUnits.push(l);
                    }
                })
                let indexOrg=0;
                organizations.forEach((org) => {
                    let objOrganization = {
                        "_id" : org._id,
                        "name" : org.name,
                        "referenceNumber": org.referenceNumber,
                        "gallery" : org.gallery,
                        "companies": [],
                        "lang": org.lang
                    }
                    locationsArray.push(objOrganization);
                    //console.log(locationsArray);
                    //find companies in organization
                    let indexComp = 0;
                    companies.forEach((comp) => {
                        //console.log('evaluating company', comp.name);
                        if (comp.parent_organization._id.toString()==org._id.toString()){
                            //console.log('found company', comp.name, 'of organization', org.name);
                            let objCompany = {
                                "_id" : comp._id,
                                "name" : comp.name,
                                "referenceNumber": comp.referenceNumber,
                                "gallery" : comp.gallery,
                                "businessUnits": [],
                                "lang": comp.lang
                            }
                            //console.log('Adding company', comp.name, 'to Organization', org.name, 'in position', indexOrg);
                            locationsArray[indexOrg].companies.push(objCompany);
                            //console.log(locationsArray);
                            //find business units
                            businessUnits.forEach((bu) => {
                                //console.log('evaluating businessUnit', bu.name);
                                if (bu.parent_company._id.toString()==comp._id.toString()&&bu.parent_organization._id.toString()==org._id.toString()){
                                    let objBU = {
                                        "_id" : bu._id,
                                        "name" : bu.name,
                                        "referenceNumber": bu.referenceNumber,
                                        "gallery" : bu.gallery,
                                        "lang": bu.lang
                                    };
                                    //console.log('Adding business unit', bu.name, 'to company', comp.name, 'in comp position', indexComp);
                                    locationsArray[indexOrg].companies[indexComp].businessUnits.push(objBU);
                                    //console.log(locationsArray);
                                }
                            })
                            indexComp=indexComp+1;
                        }
                    })
                    indexOrg++;
                })
                cb(null, locationsArray)
            }
            ], (err, locs) => {
        				if(err) return res.status(500).json(err.message || 'Error').end();
                res.status(200).json(locs)
            })
};

exports.getProviderLocations = (req, res) => {
    let params = req.query;
    var userLocations = req.userData.location;
    var Provider = require('../models/provider');
    var provider = params.provider;
    var providerLocations = [];

    var locations = [];

    waterfall([
        (cb) => {
            Provider.findById(provider, (err, doc) => {
                if (err) return cb(err)
                if (!doc) {
                    let err = new Error ('Could not find provider')
                    return cb(err)
                }
                cb(null, doc);
            });
        }, (provider, cb) => {
            //let userLocations = new ObjectId(userLocations);
            //let providerLocations = new ObjectId(provider.location);

            for(var i = 0; i < provider.location.length; i++){
                for(var k = 0; k < userLocations.length; k++){
                    if(provider.location[i].equals(userLocations[k]._id))
                    {
                        providerLocations.push(userLocations[k]);
                        break;
                    }
                }
            }
            //console.log(providerLocations, 'providerLocations')
            cb(null, true);


        }, (docs, cb) => {

            //Get locations
            Location.find({})
            .populate ('parent_organization parent_company')
            .exec((err,docs) => {
                if (err) return cb(err);
                cb(null,docs)
            })
            
        }, (allLocs, cb) => {
                //make location active for locations in user's zone
                allLocs.forEach((loc) => {
                    loc.active=providerLocations.some((x) => { return x.equals(loc)});
                    //console.log(loc.active, loc.name, 'allLocs')
                })
                //console.log(locs);
                cb(null, allLocs);
        }, (locs, cb) => {
                //format locations into hierarchical array
                let organizations= [];
                let companies = [];
                let businessUnits = []
                let locationsArray = [];

                //Sort out organizations, companies and business units
                locs.forEach((l) => {
                    if (!l.parent_organization){
                        organizations.push(l);
                    }
                    if (!l.parent_company&&l.parent_organization){
                        companies.push(l);
                    }
                    if (l.parent_company&&l.parent_organization){
                        businessUnits.push(l);
                    }
                })
                let indexOrg=0;
                organizations.forEach((org) => {
                    let objOrganization = {
                        "_id" : org._id,
                        "name" : org.name,
                        "referenceNumber": org.referenceNumber,
                        "active" : org.active,
                        "gallery" : org.gallery,
                        "companies": [],
                        "lang": org.lang
                    }
                    locationsArray.push(objOrganization);
                    //console.log(locationsArray);
                    //find companies in organization
                    let indexComp = 0;
                    companies.forEach((comp) => {
                        //console.log('evaluating company', comp.name);
                        if (comp.parent_organization._id.toString()==org._id.toString()){
                            //console.log('found company', comp.name, 'of organization', org.name);
                            let objCompany = {
                                "_id" : comp._id,
                                "name" : comp.name,
                                "referenceNumber": comp.referenceNumber,
                                "active" : comp.active,
                                "gallery" : comp.gallery,
                                "businessUnits": [],
                                "lang": comp.lang,
                                "activeBusinessUnits": true
                            }
                            //console.log('Adding company', comp.name, 'to Organization', org.name, 'in position', indexOrg);
                            locationsArray[indexOrg].companies.push(objCompany);
                            //console.log(locationsArray);
                            //find business units
                            businessUnits.forEach((bu) => {
                                //console.log('evaluating businessUnit', bu.name);
                                if (bu.parent_company._id.toString()==comp._id.toString()&&bu.parent_organization._id.toString()==org._id.toString()){
                                    let objBU = {
                                        "_id" : bu._id,
                                        "name" : bu.name,
                                        "referenceNumber": bu.referenceNumber,
                                        "active" : bu.active,
                                        "gallery" : bu.gallery,
                                        "lang": bu.lang
                                    };
                                    //console.log('Adding business unit', bu.name, 'to company', comp.name, 'in comp position', indexComp);
                                    locationsArray[indexOrg].companies[indexComp].businessUnits.push(objBU);
                                    //console.log(locationsArray);
                                }
                            })
                            indexComp=indexComp+1;
                        }
                    })
                    indexOrg++;
                })
                cb(null, locationsArray)

                }, (locationsArray, cb) => { //Check whether there are inactive companies with all its business units inactive that can be hidden.

                        locationsArray.forEach((org) => {

                                org.companies.forEach((co) => {

                                        let inactive = co.businessUnits.every((bu) => {
                                            return !bu.active
                                        })

                                        if(inactive) co.activeBusinessUnits = false; //It's an inactive company with all its business units inactive. Hide it!
                                })

                        })

                        cb(null, locationsArray)    

            }], (err, locs) => {
                        if(err) return res.status(500).json(err.message || 'Error').end();
                res.status(200).json(locs)
            })


};


/**
 * @api {get} /location/details Get all langs for a location
 * @apiGroup {location}
 * @apiName Get Langs
 *
 * @apiDescription Get all location langs
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
exports.getLocationLang = (req, res) => {

	waterfall([
		(cb) => {
			let userProfile = req.userData;
			let params = req.query;


			Location.findOne({'_id': params._id}, {
				lang: 1
			}).exec((err, docs) => {
				if (err) {
					return cb(err)
				}
				cb(null, docs)
			}
			)
		}
		], (err, data) => {
			if (err) {
				return res.status(500).json(err).end();
			} else if (!data) {
				return res.status(400).json(data).end();
			}
			res.status(200).json(data);

		});
};