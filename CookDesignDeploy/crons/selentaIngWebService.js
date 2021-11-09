//var exportGastro = require('../controllers/export')
var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '0 21 * * 1-4' : '0 4 * * *' //Prod at 21:00 UTC / 23:00 CET, dev every 5 min
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.selentaIngWebService;
var schedule;

//production cron: every hour
//development cron: every minute
switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '0 21 * * 1-4'  //Prod at 21:00 UTC / 23:00 CET
	break;

	case 'staging':
			schedule = '0 21 * 12 1-4'
	break;

	default:
		schedule = '0 4 * * *'
	break
}


exports.ingredientTask = cron.schedule(schedule, () => {

 	let locCenter;
 	let lastExportDate;
 	let ingredientsToExport;
 	var async = require('async');
 	var request = require('request');
 	var Location = require('../models/location')
	var WebServiceLog = require('../models/selentaLog')
  var Ingredient = require('../models/ingredient')
  var Article = require('../models/article')
	var {ObjectId} = require('mongodb');
	var config = require('../config/config');
	var ingredients = { "DATA": [] }
	var transactionOk = false;

	logger.debug('Ingredient Web Service - Starting job...');

	async.waterfall([

		(cb) => { //Get location doc for Hotel Sofia. Reference number of Hotel Sofia is D600.

			Location.findOne(
					{"referenceNumber": "D600"}
				) 	
				.exec((err,doc)=> {
					if(err) return cb(err)

					if(!doc) {
						let err = new Error('Could not find Hotel Sofia location!')
						logger.error('Could not find Hotel Sofia location!');
						return cb(err)
					}
					
					locCenter = doc
					cb(null,doc)
				})

		},(doc,cb) => { // find in selentaLog success exports and then filtered by last date

			WebServiceLog.find(
				{ 
					$and : [
						{"success":true},
						{"type":"ingredient"}
					]
				},
				{
					"success":1,
					"type":1,
					"date":1,
					"elementsToExport":1
				})
				.sort({"date":-1})
				.exec((err,logs) => {

				 	if(err) return cb(err)
			 		
			 		if(logs && logs.length){ 

			 			lastExportDate = logs[0].date //Found last successful log for ingredient web service
						logger.debug('Found last successful web service log for the ingredient web service! %s', lastExportDate);
			 		
			 		} else {

			 			lastExportDate = new Date(2000,1,1)
						logger.debug('Could not find a successful log or simply any log. Using date %s', lastExportDate);

			 		}
			 		cb(null,doc)
				})

		},(doc,cb) => { //Find ingredients that have been udpated since the last successful data transfer. Filter locationCost by Hotel Sofia location.

			Ingredient.find({
				"updatedAt" : 
					{$gte: lastExportDate} 
				},{
 					last_account: 1,
          active: 1,
          updatedAt: 1,
          gallery: 1,
          family: 1,
          subfamily: 1,
          ingredientPercentage: 1,
          netPercentage: 1,
          quartering: 1,
          measurementUnit: 1,
          referencePrice: 1,
          referenceNumber:1,
          averagePrice: 1,
          allergens: 1,
 					lang: {$elemMatch: {langCode: 'es'}},
 					locationCost:{ $elemMatch:{"location": locCenter._id} }

 				})
 					.populate("measurementUnit gallery family")
 					.exec((err,docs)=>{
 						if(err) return cb(err)
 						ingredientsToExport = docs;
						logger.debug('There are %s ingredients to be exported.', docs.length);
 						cb(null,doc)
 					})

		},(doc,cb) => {

				let ingredientObj;

				async.eachSeries(ingredientsToExport, (ingredient, cb_async) => {

					let name, image, cost, measuringUnitCode, status, referenceNumber;
					let providerArticles = [];

					if(ingredient.lang && ingredient.lang.length) name = ingredient.lang[0].name; else name='<No disponible>'
					if(ingredient.gallery && ingredient.gallery.sizes && ingredient.gallery.sizes.length ) image = ingredient.gallery.sizes[1].url; else image='<No disponible>'
					if(ingredient.locationCost && ingredient.locationCost.length) cost = ingredient.locationCost[0].unitCost; else cost = ingredient.referencePrice;
					if(ingredient.measurementUnit && ingredient.measurementUnit.referenceCode) measuringUnitCode = ingredient.measurementUnit.referenceCode; else measuringUnitCode='<No disponible>';
					if(ingredient.referenceNumber) referenceNumber = ingredient.referenceNumber; else referenceNumber='<No disponible>';					

					//Find provider articles linked to this ingredient

					Article.find({
						"category.kind": "ingredient",
						"category.item": ingredient._id
						}, (err, articles) => {

								if(err) return cb_async(err);

								articles.forEach((article) => {
									//logger.debug('Linked article of %s: %j', name, article)
									if(article.externalReference) providerArticles.push({"MATNR": article.externalReference })
								})

								let ingredientObj = {
									"CENTRO" : locCenter.referenceNumber.substring(0, 4),
									"NOMBRE_INGREDIENTE": name.substring(0, 40).toUpperCase(),
									"REFERENCIA": referenceNumber.substring(0, 21),
									"TIPO_MATERIAL": "ZINV",
									"ESTADO": "",  //X indicates ingredient is in pipeline to be deleted
									"UNIDAD_MEDIDA": measuringUnitCode.toUpperCase(),
									"SUBFAMILIA" : "",
									"IMAGEN": image,
									"COSTE_UNIDAD": cost.toFixed(2),
									"MAT_PRIMAS" : providerArticles
								}

								ingredients.DATA.push(ingredientObj)
								//logger.debug('%j', ingredientObj)

								cb_async();
						})

				}, (err) => { //Finished ingredientsToExport async series
						if(err) return cb(err)
						cb(null,doc)
					})			

		}, (doc,cb) => { //Send data in chunks of 250 objects

					let page = 0;
					let perPage = 250;

					async.during(
					    (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
					        return callback(null, page * perPage < ingredients.DATA.length);
					    },
					    (callback) => { //An async function which is called each time test passes. Invoked with (callback).
					        let dataPage = { "DATA": [] }
					        dataPage.DATA = ingredients.DATA.slice(page * perPage, (page + 1) * perPage); //end position is not included in slice. Slice extracts up to but not including end.
					        page++;

									if(dataPage.DATA.length) {

										request.post({url: config.selenta.wsIngUrl, json: true, body: dataPage}, (err, res, body) => {
											
											if(err) return cb(err)

											if(body && body.RESPONSE) {

												logger.info('Selenta web service response: %j', body);

												if (body.RESPONSE.MSGTYPE == "E") {
													
														logger.error('Error sending data to Selenta %s', body.RESPONSE.BAPIMSG || '');
														let err = new Error('Error sending data to Selenta %s', body.RESPONSE.BAPIMSG || '')
														transactionOk = false;
														return callback(err)

												} else {
							  					logger.info('Chunk #%s of data from %s to %s sent correctly to Selenta.', page, (page-1)*perPage, (page*perPage)-1);
													transactionOk = true;
													setTimeout(callback, 30000);																				
												}												
										  
										  } else {
										  	let err= new Error("Invalid web service response.")
										  	return callback(err)
										  }

					  				});

									} else { //No ingredients to send
										transactionOk=true;
										callback();
									}    		
					        
					    },
					    (err) => { //A callback which is called after the test function has failed and repeated execution of fn has stopped. callback will be passed an error, if one occurred, otherwise null
					       if(err) return cb(err)
					       cb(null, true)
					    }
					);


		},(doc,cb) => { //Generate log

			if(ingredients.DATA.length) {

					let date = new Date();

					let logEntry = {
						type : 'ingredient',
						elementsToExport: ingredients.DATA.length,
						date: date.toISOString(),
						success: transactionOk
					}

					var log = new WebServiceLog(logEntry);

					log.save((err, doc) => {
						if(err) return cb(err)
	 					logger.debug('Saved log entry in WebServiceLog collection.');

						cb(null, doc)
					})
			}
			else
			{
				cb(null,doc)
			}
		
		}],(err,doc) => {
			
			if(err) { 
				 logger.error('Error during cron process: %s', err.message);
			} else {
				 logger.debug('cron process completed successfully.');
			}

		})

})