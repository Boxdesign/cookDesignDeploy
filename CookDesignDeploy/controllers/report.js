
 var waterfall = require('async-waterfall');
 var mongoose = require('../node_modules/mongoose');
 var async = require('async');
 var Subproduct = require('../models/subproduct');
 var Product = require('../models/product');
 var GastroOffer = require('../models/gastroOffer');
 var Ingredient = require('../models/ingredient');
 var Template = require('../models/template')
 var Article = require('../models/article')
 var {ObjectId} = require('mongodb');
 var Dish = require('../models/dish');
 var report = require('./../helpers/report');
 var json2csv = require('json2csv');
 var fs = require('fs');
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.report;
  
 /**
 * @api {get} /report/gastroingredients Generates list of all ingredients included in a gastronomic offer
 * @apiGroup {report}
 * @apiName Generates list of all ingredients included in a gastronomic offer
 *
 * @apiDescription Generates list of all ingredients included in a gastronomic offer
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Gastronomic offer id
 *
 * @apiSuccess {Object} .  All the results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getGastroIngredients = (req , res) => {
  /* 
  	1. Get active version of gastro offer (composition elements could be dishes or products)
	2. Traverse composition list and save 
  */
   	let params = req.query;
    //var gastroOfferId = new ObjectId(params._gastroOfferId);
	  var io = req.app.io;
		var authToken = req.get('Authorization');
		var waterfall = require('async-waterfall');
		let userProfile = req.userData;
	  var queueReport = require('../queues/reportGastroIngredients')

	  waterfall([

 		(cb) => {

			var job = queueReport.reportGastroIngredients(
				{
					title: 'Report gastro ingredients - Export data to csv file.',
					params: params, 
					userProfile: userProfile,
					token: authToken
				}
			);

			cb(null, true)	

 		}], (err, doc) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
 			res.status(200).end();  	
 		})
	
};


/**
 * @api {get} /report/ingredientsbylocation Generates list of all ingredients (and provider articles to referenced ingredients and provider articles that have referenced ingredient in some location) included in a gastronomic offer filtered by location/s
 * @apiGroup {report}
 * @apiName Generates list of all ingredients and referenced provider articles included in a gastronomic offer filtered by location/s
 *
 * @apiDescription Generates list of all ingredients and referenced provider articles included in a gastronomic offer filtered by location/s
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _id  Gastronomic offer id filterLocations
 *
 * @apiSuccess {Object} .  All the results .csv
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.getIngredientsByLocation = (req , res) => {
  /* 
  	1. Get active version of gastro offer (composition elements could be dishes or products)
	2. Traverse composition list and save 
  */

  let params = req.query;
  var io = req.app.io;
	var authToken = req.get('Authorization');
	var waterfall = require('async-waterfall');
	let userProfile = req.userData;
  var queueReportByLocation = require('../queues/reportGastroIngredientsByLocation')

	waterfall([

 		(cb) => {

			var job = queueReportByLocation.reportGastroIngredientsByLocation(
				{
					title: 'Report gastro ingredients by location - Export data to csv file.',
					params: params, 
					userProfile: userProfile,
					token: authToken
				}
			);

			cb(null, true)	

 		}], (err, doc) => {
      if(err) return res.status(500).json(err.message || 'Error').end();
 			res.status(200).end();  	
 		})

}



 /**
 * @api {get} /print-books/subproducts-by-location Print all subproducts in location selected.
 * @apiGroup {print}
 * @apiName Print Subproducts Active Versions of some locations
 *
 * @apiDescription Print active Version of subproducts in location
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * @apiParam {string} _locId  location id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} Pdf file
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printSubproductsInLocationSimpleList=(req,res) => {

    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
		var subpsInLocQueue = require('../queues/subproductsInLocation')
    var authToken = req.get('Authorization');

		var job = subpsInLocQueue.subproductsInLocation(
			{
				title: 'Subproducts in location - Generate list pdf',
				params: params, 
				userProfile: userProfile,
				userLocIds: userLocIds,
				token: authToken,
				model: 'subproduct'
			}
		);

		res.status(200).json({message: 'Job started correctly'}).end()
 }


 /**
 * @api {get} /print-books/subproducts-by-location-detailed Print detailed list of all subproducts in location selected.
 * @apiGroup {print}
 * @apiName Print Subproducts Active Versions of some locations
 *
 * @apiDescription Print active Version of subproducts in location
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * @apiParam {string} _locId  location id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} Pdf file
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

exports.printSubproductsInLocationDetailedList=(req,res) => {

    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
	var subpsInLocQueue = require('../queues/subproductsInLocationDetailedList')
    var authToken = req.get('Authorization');

		var job = subpsInLocQueue.subproductsInLocationDetailed(
			{
				title: 'Subproducts in location - Generate detailed list pdf',
				params: params, 
				userProfile: userProfile,
				userLocIds: userLocIds,
				token: authToken,
				model: 'subproduct'
			}
		);

		res.status(200).json({message: 'Job started correctly'}).end()
 }


