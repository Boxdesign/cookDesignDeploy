'use strict';

 
 var waterfall = require('async-waterfall');
 var mongoose = require('../node_modules/mongoose');
 var fs = require('fs');
 var async = require('async');
 require('../models/dish');
 var Dish = require('../models/dish');
 var Drink = require('../models/drinks');
 var Product = require('../models/product');
 var Subproduct = require('../models/subproduct');
 var Ingredient = require('../models/ingredient');
 var Family = require('../models/family');
 var Location = require('../models/location');
 var GastroOffer = require('../models/gastroOffer');
 var {ObjectId} = require('mongodb');
 var config = require('../config/config');
 var json2csv = require('json2csv');
 var zip = require('express-zip');
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.dataExport;


 /**
 *
 * @api {get} /export/gastro-offer Export gastro offer
 * @apiGroup {export}
 * @apiName Export gastro offer
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} filterId  Gastro offer id. If null or not existent, all gastro offers will be downloaded.
 * @apiParam {string} gastroOfferType  Type of gastro offer: carte, menu, etc.
 * @apiParam {string} filterText  Text to filter (in name field).
 * @apiParam {string} filterLocation  Location id to filter.
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.gastroOffer = (req, res) => {
 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
  params.refreshNames = params.refreshNames || false;
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
	var exportGastroQueue = require('../queues/exportGastro')
  var io = req.app.io;
  var authToken = req.get('Authorization');
 	var waterfall = require('async-waterfall');

 	logger.info("Entering export of gastronomic offers...")
	//Set timeout because processing time can take several minutes
 	//req.connection.setTimeout(60 * 10 * 1000);

	var job = exportGastroQueue.exportGastro(
		{
			title: 'Gastro Export - Export gastro offers to csv files.',
			params: params, 
			userProfile: userProfile,
			model: 'gastroOffer',
			token: authToken
		}
	);

	res.status(200).json({message: 'Job started correclty'}).end();  	

 }


 /**
 *
 * @api {get} /export/recipe Export recipe
 * @apiGroup {export}
 * @apiName Export recipe
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} filterId  Recipe id. If null or not existent, all recipes will be downloaded.
 * @apiParam {string} recipeType  Type of recipe: Subproduct, product, dish or drink.
 * @apiParam {string} filterText  Text to filter (in name field).
 * @apiParam {string} filterLocation  Location id to filter.
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.recipe = (req, res) => {

 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
  params.refreshNames = params.refreshNames || false;
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId

	var exportRecipeQueue = require('../queues/exportRecipe')
  var io = req.app.io;
  var authToken = req.get('Authorization');
 	var waterfall = require('async-waterfall');

 	logger.info("Entering export of recipes...")
 	
 	//Set timeout because processing time can take several minutes

	var job = exportRecipeQueue.exportRecipe(
		{
			title: 'Recipe Export - Export recipes to csv files.',
			params: params, 
			userProfile: userProfile,
			token: authToken
		}
	);

	res.status(200).json({message: 'Job started correctly'}).end();            

 }

 /**
 *
 * @api {get} /export/article Export article
 * @apiGroup {export}
 * @apiName Export article
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} filterId  Article id. If null or not existent, all articles will be downloaded.
 * @apiParam {string} articleType  Type of article: ingredient or packaging.
 * @apiParam {string} filterText  Text to filter (in name field).
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.article = (req, res) => {

 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  params.refreshNames = params.refreshNames || false;
	var exportArticleQueue = require('../queues/exportArticle')
  var io = req.app.io;
  var authToken = req.get('Authorization');
 	var waterfall = require('async-waterfall');
 	  	
	var job = exportArticleQueue.exportArticle(
		{
			title: 'Article Export - Export articles to csv files.',
			params: params, 
			userProfile: userProfile,
			token: authToken
		}
	);

  res.status(200).json({message: 'Job started correctly'}).end();

 }

 /**
 *
 * @api {get} /export/family Export family
 * @apiGroup {export}
 * @apiName Export family
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} filterId  family id. If null or not existent, all families will be downloaded.
 * @apiParam {string} category  Type of family: ingredient or utensil or unit measurement or ....
 * @apiParam {string} filterText  Text to filter (in name field).
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.family = (req, res) => {

 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId

 	//Set timeout because processing time can take several minutes
 	req.connection.setTimeout(60 * 10 * 1000);
 	
 	waterfall([

 		(cb) => { //Get list of articles and generate csv file

 			Family.aggregate([ 
 				{$unwind:"$subfamilies"},
 			  {$project:
 			  	{
 			  		name:"$lang.name",
 			  		subfamilyName:"$subfamilies.lang.name",
 			  		referenceNumberSubfamily:"$subfamilies.referenceNumber",
 			  		referenceNumber:1,
 			  		category:1
 			  	}
 			  }],(err,subfamilies)=>{
 			  	if(err) return cb(err)
 			  	cb(null,subfamilies)
 			  })
 		},(docs,cb)=>{

 				var fields = ['_id', 'category', 'name', 'referenceNumber', 'subfamilyName', 'referenceNumberSubfamily'];

				var fieldNames = ['Family ID', 'Categoria', 'Nombre de la Familia', 'Código Referéncia Familia', 'Nombre SubFamilia', 'Código Referéncia Subfamília'];

				json2csv({ data: docs, fields: fields, fieldNames: fieldNames}, function(err, csv) {
				  if (err) cb(err);
				  fs.writeFile('/tmp/subfamily_export.csv', csv, function(err) {
					  if (err) return cb(err);
					  logger.info('Create csv file: /tmp/subfamily_export.csv')
					  cb(null, docs)
					});			  
				});
 		}], (err, docs) => {

        if (err) {
        	logger.error({err: err},'Error exporting families to csv.')
        	return res.status(500).json(err.message || 'Error').end();
        }
		    res.status(200).send(docs)
 		})

 }

 /**
 *
 * @api {get} /export/family Export Dishes
 * @apiGroup {export}
 * @apiName Export dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} filterId  dish id. If null or not existent, all dishes will be downloaded.
 * @apiParam {string} filterText  Text to filter (in name field).
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.dish = (req, res) => {

 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId

 	//Set timeout because processing time can take several minutes
 	req.connection.setTimeout(60 * 10 * 1000);
 	
 	waterfall([

 		(cb) => { //Get list of articles and generate csv file

 			Dish.aggregate([ 
 				{$unwind:"$versions"},
 				{$match: {'versions.active' : true}},
 			  {$project:
 			  	{
 			  		name:"$versions.lang.name",
 			  		referenceNumber:1
 			  	}
 			  }],(err,dishes)=>{
 			  	if(err) return cb(err)
 			  	//console.log(dishes,'dishes')
 			  	cb(null,dishes)
 			  })
 		},(docs,cb)=>{

 				var fields = ['_id','name', 'referenceNumber'];

				var fieldNames = ['Dish ID','Nombre del Plato', 'Código Referéncia'];

				json2csv({ data: docs, fields: fields, fieldNames: fieldNames}, function(err, csv) {
				  if (err) cb(err);
				  fs.writeFile('/tmp/dish_export.csv', csv, function(err) {
					  if (err) return cb(err);
					  logger.info('Create csv file: /tmp/dish_export.csv')
					  cb(null, docs)
					});			  
				});
 		}], (err, docs) => {

        if (err) {
        	logger.error({err: err},'Error exporting dishes to csv.')
        	return res.status(500).json(err.message || 'Error').end();
        }
		    res.status(200).send(docs)
 		})

 }

 /**
 *
 * @api {get} /export/family Export Dishes
 * @apiGroup {export}
 * @apiName Export dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} filterId  dish id. If null or not existent, all dishes will be downloaded.
 * @apiParam {string} filterText  Text to filter (in name field).
 *
 * @apiSuccess {json} Field name  short desc
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.gastro = (req, res) => {

 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
 	var userLocations = req.userData.location;
 	var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId

 	//Set timeout because processing time can take several minutes
 	req.connection.setTimeout(60 * 10 * 1000);
 	
 	waterfall([

 		(cb) => { //Get list of articles and generate csv file

 			GastroOffer.aggregate([ 
 				{$unwind:"$versions"},
 				{$match: {'versions.active' : true}},
 			  {$project:
 			  	{
 			  		name:"$versions.lang.name",
 			  		type: 1,
 			  		referenceNumber:1
 			  	}
 			  }],(err,gastroOffers)=>{
 			  	if(err) return cb(err)
 			  	cb(null,gastroOffers)
 			  })
 		},(docs,cb)=>{

 				var fields = ['_id','name', 'type', 'referenceNumber'];

				var fieldNames = ['Gastro ID','Nombre de la Oferta Gastronómica','Tipo de Oferta Gastroómica', 'Código Referéncia'];

				json2csv({ data: docs, fields: fields, fieldNames: fieldNames}, function(err, csv) {
				  if (err) cb(err);
				  fs.writeFile('/tmp/gastro_export.csv', csv, function(err) {
					  if (err) return cb(err);
					  logger.info('Create csv file: /tmp/gastro_export.csv')
					  cb(null, docs)
					});			  
				});
 		}], (err, docs) => {

        if (err) {
        	logger.error({err: err},'Error exporting gasstro offers to csv.')
        	return res.status(500).json(err.message || 'Error').end();
        }
		    res.status(200).send(docs)
 		})

 }