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
 * @api {get} /print/article Print Active Version of ingredient or packaging
 * @apiGroup {print}
 * @apiName Print Article's Active Version
 *
 * @apiDescription Print our active Version of Ingredient or Packaging
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _articleId  Article id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} .  All results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printArticle=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var templateId = new ObjectId (params._templateId);
    var articleId = new ObjectId(params._articleId);
    var articleType=params._articleType;
    var tax = params._tax;
    var Model;
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var print = require('../helpers/printArticle');
    var filterLocation;

    if(articleType=='ingredient') Model=Ingredient; else Model=Packaging;
    
    req.connection.setTimeout(60 * 10 * 1000);

    waterfall([
        (cb) => {

            if (params.filterLocation) {
                filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
            } else {
                filterLocation = [];
            }

           print.article(Model, articleType, userLocIds, userProfile, articleId, templateId, tax, filterLocation, (err, stream) => {
                if(err) return cb(err);
                cb(null, stream)
           })

        }], (err, stream) => {

        		let statusCode;

        		if(err) return res.status(500).json(err.message || 'Error').end();

            res.setHeader('Content-Type', 'application/pdf');                
            res.setHeader('Content-Disposition', 'inline; filename=article');
            res.status(200)
            stream.pipe(res);
        })
 }


/**
 * @api {get} /print/subproduct Print Active Version of subproduct
 * @apiGroup {print}
 * @apiName Print Subproduct's Active Version
 *
 * @apiDescription Print our active Version of Subproduct
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _subproductId  Subproduct id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} .  All results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printSubproduct=(req,res)=>{
 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
 	var templateId = new ObjectId (params._templateId);
 	var subproductId = new ObjectId(params._subproductId);
 	var simulationNetWeight= params._simulationNetWeight;
 	var tax = JSON.parse(params._tax);
 	var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var print = require('../helpers/printRecipe');
  var filterLocation;

  //Set timeout because processing time can take several minutes
  req.connection.setTimeout(60 * 10 * 1000);

        waterfall([
        	(cb) => {

	        		if (params.filterLocation) {
	        			filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
	        		} else {
	        			filterLocation = [];
	        		}

	        		print.recipe(Subproduct, 'subproduct', userLocIds, userProfile, subproductId, templateId, simulationNetWeight || null, tax, filterLocation, (err, stream) => {
	        			if(err) cb(err);
	        			cb(null, stream)
	        		})

        	}], (err, stream) => {

        		if(err) return res.status(500).json(err.message || 'Error').end();

        		res.setHeader('Content-Type', 'application/pdf');                
        		res.setHeader('Content-Disposition', 'inline; filename=receta');
            res.status(200)
        		stream.pipe(res);
        	})
      }


 /**
 * @api {get} /print/product Print Active Version of product
 * @apiGroup {print}
 * @apiName Print Product's Active Version
 *
 * @apiDescription Print active Version of Product
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

 exports.printProduct=(req,res) => {
    
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var simulationNetWeight = params._simulationNetWeight;
    var tax =params._tax;
    var templateId = new ObjectId (params._templateId);
    var productId = new ObjectId(params._productId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var print = require('../helpers/printRecipe');
  	var filterLocation;

    //Set timeout because processing time can take several minutes
    req.connection.setTimeout(60 * 10 * 1000);
    

    waterfall([
        (cb) => {

      		if (params.filterLocation) {
      			filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
      		} else {
      			filterLocation = [];
      		}

           print.recipe(Product, 'product', userLocIds, userProfile, productId, templateId, simulationNetWeight || null, tax, filterLocation, (err, stream) => {
                if(err) cb(err); 
                cb(null, stream)
           })

        }], (err, stream) => {

        		if(err) return res.status(500).json(err.message || 'Error').end();

            res.setHeader('Content-Type', 'application/pdf');                
            res.setHeader('Content-Disposition', 'inline; filename=receta');
            res.status(200)
            stream.pipe(res);
        })
 }



 /**
 * @api {get} /print/dish Print Active Version of dish
 * @apiGroup {print}
 * @apiName Print Dish Active Version
 *
 * @apiDescription Print active version of dish
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _dishtId  Dish id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} .  Pdf file
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printDish=(req,res)=>{

 	let userProfile = req.userData;
 	let params = req.query;
 	params.filterText = params.filterText || '';
 	var templateId = new ObjectId (params._templateId);
 	var simulationNetWeight = params._simulationNetWeight;
 	var tax = params._tax;
 	var dishId = new ObjectId(params._dishId);
 	var userLocations = req.userData.location;
  var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
  var print = require('../helpers/printRecipe');
  var filterLocation;

  //Set timeout because processing time can take several minutes
  req.connection.setTimeout(60 * 10 * 1000);

    waterfall([
    	(cb) => {

    		if (params.filterLocation) {
    			filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
    		} else {
    			filterLocation = [];
    		}

    		print.recipe(Dish, 'dish', userLocIds, userProfile, dishId, templateId, simulationNetWeight || null,tax, filterLocation, (err, stream) => {
    			if(err) cb(err);
    			cb(null, stream)
    		})

    	}], (err, stream) => {

        if(err) return res.status(500).json(err.message || 'Error').end();

    		res.setHeader('Content-Type', 'application/pdf');                
    		res.setHeader('Content-Disposition', 'inline; filename=receta');
        res.status(200)
    		stream.pipe(res);
    	})
  }


/**
 * @api {get} /print/drink Print Active Version of drink
 * @apiGroup {print}
 * @apiName Print Drink Active Version
 *
 * @apiDescription Print active version of drink
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _drinkId  Drink id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} .  Pdf file
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printDrink=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var templateId = new ObjectId (params._templateId);
    var simulationNetWeight = params._simulationNetWeight;
    var tax = params._tax;
    var drinkId = new ObjectId(params._drinkId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var print = require('../helpers/printRecipe');
  	var filterLocation;

    //Set timeout because processing time can take several minutes
    req.connection.setTimeout(60 * 10 * 1000);

    waterfall([
        (cb) => {

	    		if (params.filterLocation) {
	    			filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
	    		} else {
	    			filterLocation = [];
	    		}

           print.recipe(Drink, 'drink', userLocIds, userProfile, drinkId, templateId, simulationNetWeight || null,tax, filterLocation, (err, stream) => {
                if(err) return cb(err);
                cb(null, stream)
           })

           // print.getSubproductsInPrintElement(drinkId,Drink,(err,cb)=>{
           //      if(err) return cb(err);
           //      cb(null,subproductList)
           // })

        }], (err, stream) => {

        		if(err) return res.status(500).json(err.message || 'Error').end();

            res.setHeader('Content-Type', 'application/pdf');                
            res.setHeader('Content-Disposition', 'inline; filename=receta');
            res.status(200)
            stream.pipe(res);
        })
 }


/**
 * @api {get} /print/gastro-offer Print Active Version of gastro-offer
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

 exports.printGastroOffer=(req,res)=>{
    let userProfile = req.userData;
    let params = req.query;
    params.filterText = params.filterText || '';
    var menuType = params._menuType;
    var tax = params._tax;
    var type = params._type;
    var showPrice = params._showPrice;
    var recipe = params._recipe;
    var templateId = new ObjectId (params._templateId);
    var gastroOfferId = new ObjectId(params._gastroOfferId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var print = require('../helpers/printGastroOffer');
    var printBook = require('../helpers/printBooks');
  	var filterLocation;

    //Set timeout because processing time can take several minutes
    req.connection.setTimeout(60 * 10 * 1000);

    waterfall([
        (cb) => {

		    		if (params.filterLocation) {
		    			filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
		    		} else {
		    			filterLocation = [];
		    		}

            if(type=='gastro'){
                print.gastroOffer(GastroOffer, menuType, userLocIds, userProfile, gastroOfferId, templateId, tax, filterLocation, showPrice, recipe, (err, stream) => {
                    if(err) return cb(err); 
                    cb(null, stream)
                })
            } else {
                printBook.books(GastroOffer, menuType, userLocIds, userProfile, gastroOfferId, templateId, tax, filterLocation, (err, stream) => {
                    if(err) return cb(err); 
                    cb(null, stream)
                })
            }
        }], (err, stream) => {

        		if(err) return res.status(500).json(err.message || 'Error').end();
       	
            res.setHeader('Content-Type', 'application/pdf');                
            res.setHeader('Content-Disposition', 'inline; filename=receta');
            res.status(200)
            stream.pipe(res);
        })
 }

 /**
 * @api {get} /print/article Print Active Version of ingredient or packaging
 * @apiGroup {print}
 * @apiName Print Article's Active Version
 *
 * @apiDescription Print our active Version of Ingredient or Packaging
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _articleId  Article id 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} .  All results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printAllergenInGastroOffer=(req,res)=>{
    
    let userProfile = req.userData;
    //console.log(userProfile,'userProfile')
    let params = req.query;
    var templateId = new ObjectId (params._templateId);
    var gastroOfferId = new ObjectId(params._gastroOfferId);
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var print = require('../helpers/printAllergens');
		var GastroOffer = require('../models/gastroOffer');

    //Set timeout because processing time can take several minutes
    req.connection.setTimeout(60 * 10 * 1000);

    waterfall([
        (cb) => {
           print.printAllergensOfGastroOffer(GastroOffer, userLocIds, userProfile, gastroOfferId, templateId, (err, stream) => {
                if(err) return cb(err);
                cb(null, stream)
           })

        }], (err, stream) => {

        		if(err) return res.status(500).json(err.message || 'Error').end();
          
            res.setHeader('Content-Type', 'application/pdf');                
            res.setHeader('Content-Disposition', 'inline; filename=allergen');
            res.status(200)
            stream.pipe(res);
        })
 }


 /**
 * @api {get} /print/library Print library
 * @apiGroup {print}
 * @apiName Print library
 *
 * @apiDescription Print library objects 
 *
 * @ApiHeader (Security) {String}  Authorization Auth Token
 *
 * @apiParam {string} _type  type 
   @apiParam {string} _templateId  Template id
 *
 * @apiSuccess {Object} .  All results
 * @apiError Not Found Object field description
 *
 * @apiVersion 0.1.0
 *
 */

 exports.printLibrary=(req,res)=>{
    
    let userProfile = req.userData;
    let params = req.query;
    console.log(params,'params')
    var templateId = new ObjectId (params._templateId);
    var type = params._type;
    var familyType = params._familyType;
    var format = params._format;
    var user = req.userData
    var userLocations = req.userData.location;
    var userLocIds = userLocations.map(function(doc) { return new ObjectId(doc._id); }); //Array of ObjectId
    var print = require('../helpers/printLibrary');
    var filterFamily;
    //Set timeout because processing time can take several minutes
    req.connection.setTimeout(60 * 10 * 1000);

    waterfall([

        (cb) => {

          if (params.filterFamily) {

             filterFamily = JSON.parse(params.filterFamily).map(function(doc) { return new ObjectId(doc); });

          } else {

                filterFamily = [];

          }
          //console.log(familyType,'FAMILYTYPE')
          print.printLibrary(type, familyType, userLocIds, userProfile, templateId, user, filterFamily, format, (err, stream) => {
              if(err) return cb(err);
              cb(null, stream)
          })

        }], (err, stream) => {

        		if(err) return res.status(500).json(err.message || 'Error').end();

            res.setHeader('Content-Type', 'application/pdf');                
            res.setHeader('Content-Disposition', 'inline; filename=library');
            res.status(200)
            stream.pipe(res);
        })
 }
