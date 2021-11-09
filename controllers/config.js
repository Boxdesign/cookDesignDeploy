'use strict';
var config = require('../config/config');

/**
 * @api {get} /config/languages Get current list of all the available languages
 * @apiGroup {config}
 * @apiName Get languages
 *
 * @apiDescription Get the current list of avaiable languages for the creation and modification of elements
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getAllLanguages = (req, res) => {

    let data = [
        {
            'language': 'spanish',
            'langCode': 'es'
        },
        {
            'language': 'english',
            'langCode': 'en'
        }
    ];

    res.status(200).json({'languages': data});

};

/**
 * @api {get} /config/tax Gets applicable taxes
 * @apiGroup {config}
 * @apiName Gets applicable taxes
 *
 * @apiDescription Get the current list of all applicable taxes
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getTax = (req, res) => {

    let data = {
        'salesTax': config.salesTax //in %
    };
    res.status(200).json({'tax': data});

};


/**
 * @api {get} /config/entity Gets application entities (ie. controller paths)
 * @apiGroup {config}
 * @apiName Gets application entities
 *
 * @apiDescription Get the current list of all application entities (ie. controller paths)
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getEntity = (req, res) => {

    res.status(200).json(config.entities);

};


/**
 * @api {get} /config/organization Gets info about organization running the app
 * @apiGroup {config}
 * @apiName Gets application organization
 *
 * @apiDescription Get the name of the organization running the app. The name is obtained from an environment variable.
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiSuccess {Object} .  Organization name
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getOrganization = (req, res) => {

		let organization = process.env.ORGANIZATION || "Oilmotion";

    res.status(200).json(organization);

};

/**
 * @api {get} /config/entity Gets application entities (ie. controller paths)
 * @apiGroup {config}
 * @apiName Gets application entities
 *
 * @apiDescription Get the current list of all application entities (ie. controller paths)
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getEntity = (req, res) => {

    res.status(200).json(config.entities);

};


/**
 * @api {get} /config/entity Gets application ISO Codes (ie. controller paths)
 * @apiGroup {config}
 * @apiName Gets application Iso codes
 *
 * @apiDescription Get the current list of all application Iso Codes (ie. controller paths)
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getIsoCodes = (req, res) => {

    res.status(200).json(config.measurementUnitIsoCodes);

};

/**
 * @api {get} /config/entity Gets application Time Intervals (ie. controller paths)
 * @apiGroup {config}
 * @apiName Gets application time intervals
 *
 * @apiDescription Get time intervals options (ie. controller paths)
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getTimeIntervals = (req, res) => {

    res.status(200).json(config.timeIntervals);

};

/**
 * @api {get} /config/entity Gets application Time Intervals (ie. controller paths)
 * @apiGroup {config}
 * @apiName Gets application time intervals
 *
 * @apiDescription Get time intervals options (ie. controller paths)
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */
exports.getcookingStepsTimeUnits = (req, res) => {

    res.status(200).json(config.cookingStepsTimeUnits);

};
