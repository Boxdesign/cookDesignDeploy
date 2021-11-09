
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var async = require('async');
var Process = require ('../models/process');
var Utensil = require ('../models/utensil');
var Gallery = require ('../models/gallery');
var Checkpoint = require ('../models/checkpoint');
var CookingStep = require('../models/cookingSteps');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.controllers;

exports.getCookSteps = (id, versionId, Model, userProfile ,cb) => {

	logger.info('CookingSteps helper :: getCookSteps => Entering method');
	logger.info('CookingSteps helper :: getCookSteps => id: '+ id);		
	logger.info('CookingSteps helper :: getCookSteps => versionId: '+ versionId);		

	var cookSteps=[];

	waterfall([
		(cb) => {
		        Model.aggregate([
					{$match: {'_id' : id}},
			        {
			            $unwind: {
			                path: "$versions",
			                preserveNullAndEmptyArrays: true
			            }
			        },
					{$match: {'versions._id' : versionId}},
			        {	
			            $unwind: {
			                path: "$versions.cookingSteps",
			                preserveNullAndEmptyArrays: true
			            }
			        },
			        {
			            $unwind: {
			                path: "$versions.cookingSteps.lang",
			                preserveNullAndEmptyArrays: true
			            }
			        },
					{$match: {'versions.cookingSteps.lang.langCode': userProfile.user.language}},
			         //{$match: {'versions.lang.langCode': userProfile.user.language}},
			         // {
			         //     $group: {
			         //         "_id": "$versions.cookingSteps"
			         //     }
			         // },
			         {
			             $group: {
			                 "_id": "$_id",
			                 "cookingSteps": {$push: "$versions.cookingSteps"}
			             }
			         }
			         ], (err, doc) => {
						 
						 if(err) return cb(err) 
						 logger.info('CookingSteps helper :: getCookSteps => document: ' + JSON.stringify(doc));
						//console.log(doc,'agreggate')
						if (doc.length > 0) cookSteps=doc[0].cookingSteps;
						cb(null,doc);
				     })

		   }, (doc, cb) => { //Populate images

		   		if (doc.length > 0) {
		   			Gallery.populate(cookSteps, {path: 'images'}, (err, doc) => {
		   				if(err) return cb(err)
		   				cb(null, doc);
		   			})		   		

			   	} else { //no cooking steps
				  	cb(null, doc);
					}

		   }, (doc, cb) => { //Populate process

		   	if (doc.length > 0) {

		   		async.eachSeries(cookSteps, (cookStep, cb_async)=> {
		   			
		   			if (cookStep.process !=null) {
	                Process.find(
	                    {  
	                        _id: cookStep.process
	                    },
	                    {
	                        images: 1,
	                        videos: 1,
	                        lang: {$elemMatch: {langCode: userProfile.user.language}
	                    }
	                }) 
	                .exec((err, doc)=>{
	                    if (err) return cb(err)
	                    cookStep.process=doc[0];
	                    cb_async();
	                }) 
	            } else {
	            	cb_async();
	            }
		   		}, (err, res) => {
		   			if(err) return cb(err)
						cb(null, doc);
					})	
		   	
		   	} else {
				  	cb(null, doc);
				}	

			}, (doc, cb) => { //Populate utensil

		   	if (doc.length > 0) {
		   		
		   		async.eachSeries(cookSteps, (cookStep, cb_async)=> {
		   			
		   			if (cookStep.utensil !=null) {
	                
	                Utensil.find(
	                    {  
	                        _id: cookStep.utensil
	                    },
	                    {
	                        family: 1,
	                        subfamily: 1,
	                        gallery: 1,
	                        lang: {$elemMatch: {langCode: userProfile.user.language}
	                    }
	                }) 
	                .exec((err, doc)=>{
	                    if(err) return cb(err)
	                    cookStep.utensil=doc[0];
	                    cb_async();
	                }) 
	            } else {
	            	cb_async()
	            }
		   		}, (err, res) => {
		   			if(err) return cb(err)
						cb(null, doc);
					})	
		   	} else {
				  	cb(null, doc);
				}		

			}, (doc, cb) => { //Populate criticalCheckpoint

		   	if (doc.length > 0) {
		   		async.eachSeries(cookSteps, (cookStep, cb_async)=> {
		   			if (cookStep.criticalCheckpoint !=null) {
	                Checkpoint.find(
	                    {  
	                        _id: cookStep.criticalCheckpoint
	                    },
	                    {
	                        type: 1,
	                        lang: {$elemMatch: {langCode: userProfile.user.language}
	                    }
	                }) 
	                .exec((err, doc)=>{
	                    if (err) return cb(err)
	                    cookStep.criticalCheckpoint=doc[0];
	                    cb_async();
	                }) 
	            } else {
	            	cb_async()
	            }
		   		}, (err, res) => {
		   			if(err) return cb(err)
						cb(null, doc);
					})	
		   	} else {
				  	cb(null, doc);
				}  

			}, (doc, cb) => { //Populate gastroCheckpoint

		   	if (doc.length > 0) {
		   		async.eachSeries(cookSteps, (cookStep, cb_async)=> {
		   			if (cookStep.gastroCheckpoint !=null) {
	                Checkpoint.find(
	                    {  
	                        _id: cookStep.gastroCheckpoint
	                    },
	                    {
	                        type: 1,
	                        lang: {$elemMatch: {langCode: userProfile.user.language}
	                    }
	                }) 
	                .exec((err, doc)=>{
	                    if (err) return cb(err)
	                    cookStep.gastroCheckpoint=doc[0];
	                    cb_async();
	                }) 
	            } else {
	            	cb_async();
	            }
		   		}, (err, res) => {
		   			if(err) return cb(err)
						cb(null, doc);
					})	
		   	} else {
				  	cb(null, doc);
				}   	

			
			 }], (err, doc) => {
				     if (err) return cb(err);
				     //console.log(doc, 'cook steps')
				     cb(null, cookSteps);
			 }
)}


exports.deleteCheckpoints = (callback) => {

	var cookSteps = [];
	var Dish = require('../models/dish')
	var Drink = require('../models/drinks')
  var Subproduct = require('../models/subproduct')
  var Product = require('../models/product')
	var during = require('async/during')
	var dishes;
	var drinks;
	var page
	var perPage = 100;
  var loggerHelper = require('../helpers/logger');
	const logger = loggerHelper.removeCheckpoints;
  var resetCheckpoints = false;
  var dishCount = 0;
  var drinkCount = 0;
  var Models = [Subproduct, Product, Dish, Drink]
	
	async.eachSeries(Models, (Model, cb_async1) => {

		if(Model == Dish) logger.info('Starting process to remove checkpoints from dishes')
		if(Model == Drink) logger.info('Starting process to remove checkpoints from drinks')			
		if(Model == Product) logger.info('Starting process to remove checkpoints from products')
		if(Model == Subproduct) logger.info('Starting process to remove checkpoints from subproducts')			

		waterfall([

			(cb_1) => { 

				Model.find(
					{},
					{_id:1}
				).exec((err, docs) => {
					if(err) return cb_1(err)
					logger.info('Obtained %s recipes', docs.length)
					cb_1(null, docs)	
				})

			}, (docs, cb_1) => {

					logger.info('Starting update of retrieved recipes...')

					async.eachSeries(docs, (doc, cb_async2) => {

						waterfall([

						(cb_2) => {

							Model.findOne(doc._id, (err, doc) => { //Get recipe
								if(err) return cb_2(err)
								cb_2(null, doc)
							})

						}, (doc, cb_2) => {

							doc.versions.forEach((version) => {

								version.cookingSteps.forEach((cookingStep) => {

									cookingStep.criticalCheckpoint = null;
									cookingStep.gastroCheckpoint = null;
								})

							})

							cb_2(null, doc)

						}, (doc, cb_2) => {

							doc.save((err, doc) => {
								if(err) return cb_2(err)
								cb_2(null, true)								
							})


						}], (err, docs) => { //End of cb_2 waterfall
							if(err) return cb_async2(err)
							cb_async2(null, true)
						})


					}, (err) => { //End of cb_async2
						if(err) return cb_1(err)
						cb_1(null, true)
					})

			}], (err,doc) => { //End of cb_1 waterfall

				if(err) return cb_async1(err)
				if(Model == Dish) logger.info('Finished removing checkpoints from dishes')
				if(Model == Drink) logger.info('Finished removing checkpoints from drinks')			
				if(Model == Product) logger.info('Finished removing checkpoints from products')
				if(Model == Subproduct) logger.info('Finished removing checkpoints from subproducts')	
				cb_async1(null, true)
		})

	}, (err)=>{ //Finished Model async loop
		
		if(err) return callback(err)
		logger.info('Finished method to remove checkpoints.')
		callback(null, true)

	})
}