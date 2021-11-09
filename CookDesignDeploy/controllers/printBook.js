'use strict';
 
 var waterfall = require('async-waterfall');
 var locHelper = require('../helpers/locations');
 var mongoose = require('../node_modules/mongoose');
 var fs = require('fs');
 var async = require('async');
 var Subproduct = require('../models/subproduct');
 var Template = require('../models/template');
 var Family = require('../models/family');
 var Ingredient = require('../models/ingredient');
 var Gallery = require('../models/gallery');
 var Location = require('../models/location');
 var {ObjectId} = require('mongodb');
 var config = require('../config/config');
 var assert = require('assert');
 var cookingSteps= require ('../helpers/cookingSteps');
 var locHelper= require ('../helpers/locations');
 var costHelper= require ('../helpers/cost');
 var request = require('request')
 var Dish = require('../models/dish');
 var Drink = require('../models/drinks');
 var Product = require('../models/product');
 var GastroOffer = require('../models/gastroOffer');
 var Location = require('../models/location');
 var Ingredient = require ('../models/ingredient');
 var Packaging = require('../models/packaging')

/**
 * @api {get} /print-books/gastro-offer Print Active Version of gastro-offer
 * @apiGroup {print}
 * @apiName Print Gastro Offer Active Version
 *
 * @apiDescription Print active Version of gastro offer
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 * @apiParam {string} _productId  Product id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} Pdf file
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printGastroOfferBook=(req,res) => {

    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
		var printBookQueue = require('../queues/printBook')
    var authToken = req.get('Authorization');

		var job = printBookQueue.printBook(
			{
				title: 'Print Book - Generate book pdf',
				params: params, 
				userProfile: userProfile,
				userLocIds: userLocIds,
				model: 'gastroOffer'
			}
		);

		res.status(200).json({message: 'Job started correctly'}).end()
 }
