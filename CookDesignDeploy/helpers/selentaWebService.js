'use strict';
var async = require('async');
var request = require('request');
var {ObjectId} = require('mongodb');
var config = require('../config/config');
var qs = require('querystring')

var Article = require('../models/article')
var Provider = require ('../models/provider')
var _ = require('underscore')

var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.getSeletentaMPWebService;


// {
//     "MATERIALS": [
//         {
//             "MATNR": "000000000200004158", → Codi sap
//             "MAKTX": "CEBOLLA AROS REBOZADOS CONG KG", → 
//             "MTART": "ZINV", → tipo de material
//             "LVORM": "", → petición de borrado
//             "MSEH3": "KG", → unidad base
//             "MATKL": "118001001", → grupo artículos
//             "PROVIDER": [
//                 {
//                     "IDNLF": "10182", → Número material proveïdor
//                     "LIFNR": "0001000036", → Número cuenta proveïdor
//                     "NAME1": "DAVIGEL ESPAÑA, SA",
//                     "DMBTR": "25.50", → Preu
//                     "BLDAT": "2015-04-08", → Fecha documento (data compra=
//                     "ERFMG": "2.000", → Cantidad en unitat base
//                     "ERFME": "CJ", → Unitat de mesura del proveïdor 
//                     "LOEVM": "" → Indicador de borrado
//                 }
//            ],
//						"UMA": [  → Unidades de medida alternativa. Conversió entre unitat de mesura proveïdor i unitat base
//                {
//                    "UMREN": "1",
//                    "MEINH": "CJ",
//                    "UMREZ": "3",
//                    "MEINS": "KG"
//                }
//            ]


exports.updateSelentaArticles = (readLocalFile, callback) => {

	var async = require('async');
 	var request = require('request');
	var {ObjectId} = require('mongodb');
	var config = require('../config/config');
	var qs = require('querystring')
	var selentaArticles = []
	var filteredSelentaArticles = { MATERIALS: [] }
	var artReferenceNumbers = []
	var provReferenceNumbers = []
	var Article = require('../models/article')
	var Location = require('../models/location')
	var Provider = require ('../models/provider')
	var Selenta = require ('../models/selenta')
	var Ingredient = require ('../models/ingredient')
	var Allergen = require ('../models/allergen')
	var MeasurementUnit = require ('../models/measurementUnit')
	var allergenHelper = require('../helpers/allergen')
	var moment = require('moment')
	var existingArticles = []
	var existingProviders = []
	var checkExistingArticle;
	var notFoundArticles = []
	var existingArticles = []
	var notFoundProviders = []
	var existingProviders = []
	var cookDesignExistingArticles = []
	var addNewArticleWithNewProvider = []
	var addNewArticleWithExistingProvider = []
	var editArticleWithNewProvider = []
	var editArticleWithExistingProvider = []
	var deleteArticle = []
	var selentaProviders = []
	var selentaBulkWrite;
	var unwindedSelentaArticles = [];
	var articlesToCompare = [];
	var articlesToLinked = [];
	let locationFilter = [];
	var deletedArticles = [];
	var discardedArticles = [];
	var deletedProviders = [];
	var forReviewArticles = [];
	var articlesToUpdate = [];
	var mismatchUnitArticles = [];
  var mismatchUnitArticles = [];
 	var costVariationWarningArticles = [];
 	var noConvUnitArticles = [];
	var originalFilteredSelentaArticles;
	var locationHotelSofia;
	var allergens;
	var selentaAllergens = config.selenta.allergenCodes;
	var fs = require('fs')
	var path = require('path')
	var localFileLocation = '../data/selentaWebResponse.json';
	const logger = loggerHelper.selentaMPWebService;


	logger.error('Starting job...');

	async.waterfall ([

		(cb)=>{ //Find location id of location with reference D600

				Location.findOne({referenceNumber: "D600"}, (err, doc) => {
					if(err) return cb(err)
					if(!doc) {
						let err = new Error("Could not find location")
						return cb(err)
					}
					locationHotelSofia = doc;
					locationFilter.push(new ObjectId(doc._id))
					logger.info("Found location D600 in the Location collection: %s", doc._id)
					cb(null)
				})

		},(cb) => { //Find locations hanging from Hotel Sofia

			Location.find(
					{
						parent_company: locationHotelSofia._id  
					} 
				)  
				.exec((err,docs)=> {
					if(err) return cb(err)

					if(!docs || !docs.length) {
						let err = new Error('Could not find location!')
						return cb(err)
					}
					docs = docs.map((doc) => { return doc._id})
					locationFilter = locationFilter.concat(docs);
					logger.info('Found %s locations hanging from Hotel Sofia location.', docs.length);
					cb(null)
				})	

		},(cb) => { //Find allergen ids for Selenta allergens

			Allergen.find()
			.exec((err, docs) => {
				if(err) return cb(err)
				
				allergens = docs
				let matches = 0;

				selentaAllergens.forEach((selentaAllergen) => {
					let allergenMatch = allergens.find((allergen) => {
						return selentaAllergen.code == allergen.code;
					})
					if(allergenMatch) {
						matches++;
						selentaAllergen.allergenId = allergenMatch._id;
					}
				})
				logger.info('Found cookDesign allergen ids for Selenta allergen codes.')
				//logger.info('selentaAllergens : %j', selentaAllergens)
				if(matches != allergens.length) logger.error('There is a mismatch between number of cookdesign allergens and selenta allergens...to verify!')

				cb(null)
			})

		},(cb)=>{  //Make request to Selenta web service to get updated list of articles

			if(readLocalFile == true || readLocalFile == false ) readLocalFile=false;
			else {
				readLocalFile = (readLocalFile == 'true');
			}

			logger.info('readLocalFile: %s', readLocalFile)

			if(readLocalFile) {

				logger.info('Reading local file with sample Selenta web service response.')

				fs.readFile(path.join(__dirname, localFileLocation), (err, data) => {
				    if (err) return cb(err)
				    selentaArticles = JSON.parse(data);
						cb(null, true)
				})			

			}
			else
			{

				logger.error('Making request to Selenta MP web service.')

				var qs  = {"Centro" : "D600" }
				request.get({url: config.selenta.wsMPUrl, qs:qs, json: true }, (err, res, body) => {
					
					if(err) {
						logger.error('Error retrieving Selenta articles')
						logger.error(err)
						return cb(err)
					}
					
					logger.error('Successfully executed request to Selenta web service.');

					if(body) {

						if(body.MATERIALS && body.MATERIALS.length){
							logger.error('Obtained %s Selenta articles', body.MATERIALS.length);

							//console.log(body.MATERIALS.length,'lengthBODY')
							selentaArticles = body;

							//Save data
							fs.writeFile('/tmp/latestSelentaWebResponse.json', JSON.stringify(body), (err) => {
								if(err) return cb(err)
								cb(null, true)									
							})

							// selentaArticles.MATERIALS.forEach((article) => {
							// 	article.PROVIDER.forEach((provider) => {
							// 		console.log(provider)
							// 	})
							// })

						} else {
							let err = new Error ("Invalid web service response is empty.")
							logger.error('Invalid web service response is empty.');
							return cb(err)
						}
				  
				  } else {
				  	let err= new Error("Invalid web service response.")
						logger.error("Invalid web service response.");
				  	return cb(err)
				  }

				});
			}

		},(doc,cb)=>{ //Filter Selenta list and save it in filteredSelentaArticles array

			let articlesWithAllergens = [];

			selentaArticles.MATERIALS.forEach((article) => {

				if(article.ALERGENOS.length) {

					if (!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZCEREALES_GLUT) || 
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZCRUSTACEOS) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZHUEVOS) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZPESCADOS) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZCACAHUETES) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZSOJA) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZLACTEOS) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZFRUTOS_SEC) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZAPIO) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZMOSTAZA) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZSESAMO) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZSULFITOS)  ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZALTRAMUCES) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].ZMOLUSCOS) ||
							!_.contains(['SI', 'NO', 'PUEDE'], article.ALERGENOS[0].Z0MG)) 
					{
						logger.error('Allergen definition issue with article: %s', JSON.stringify(article));
						article.ALERGENOS = [];

					} else {
						articlesWithAllergens.push(article);						
					}
				}
				
				if(article.MSEH3!="" && article.MATNR!="") {
					
					let filteredArticle = JSON.parse(JSON.stringify(article));
					delete filteredArticle.PROVIDER;
					filteredArticle.PROVIDER = [];

					article.PROVIDER.forEach((provider) => {

						if(
								provider.DMBTR != "" && provider.DMBTR !="0.00" && 
								provider.BLDAT != "" && provider.BLDAT !="0000-00-00" && 
								provider.ERFMG != "" && provider.ERFMG !="0.000" &&
								provider.ERFME != "" 
						) {

							//Filter by purchase date. Get only those providers with a purchase date within the last year.
							let purchaseDate = new Date(provider.BLDAT);
							let limitDate = new Date();
							limitDate.setFullYear( limitDate.getFullYear() - 1 )

							if( purchaseDate > limitDate) filteredArticle.PROVIDER.push(provider)

						}								
					})
					if(filteredArticle.PROVIDER.length) 
					{
						filteredSelentaArticles.MATERIALS.push(filteredArticle)
					}
					else 
					{
						logger.warn('Discarded article: %j', article)
						discardedArticles.push(JSON.parse(JSON.stringify(article)))
					}
				}
				else
				{
					logger.warn('Discarded article: %j', article)
					discardedArticles.push(JSON.parse(JSON.stringify(article)))
				}
			})
			logger.error('There are %s articles with allergens', articlesWithAllergens.length)
			logger.error("Cleaned up Selenta articles list (including its providers), from ", selentaArticles.MATERIALS.length, "articles to ", filteredSelentaArticles.MATERIALS.length, "articles");
			logger.error("There are %s articles with allergens array not empty", articlesWithAllergens.length)
			originalFilteredSelentaArticles = JSON.parse(JSON.stringify(filteredSelentaArticles));
			cb(null, doc)

		},(doc,cb)=>{ //Get list of article and provider reference numbers

  			// Get reference numbers of Selenta articles. The first 9 initial digits are always 0 and can be discorded.
				artReferenceNumbers = filteredSelentaArticles.MATERIALS.map(function (article) { return article.MATNR.substring(9,18) }) 
			  
			  //Generate an array with list of Selenta providers reference numbers and another array with list of providers.
			  exports.getProvidersExternalReference(filteredSelentaArticles,(err,data)=>{
			  	if(err) return cb(err)
		  		provReferenceNumbers = data.providersExternalReferences;
		  		selentaProviders = data.providers;
		  		logger.error("Obtained list of Selenta providers, ", selentaProviders.length)
		  		//console.log(provReferenceNumbers.length,'provReferenceNumbersMP',selentaProviders.length,'selentaProviders')
		  		cb(null, true)
			  })


		},(doc,cb)=>{ //Find articles in CookDesign with external references (SAP codes) and location D600 not included in Selenta's article list

			//Get list of provider articles
			Article.find({
				$and: [ {location: {$in: locationFilter}}, {externalReference : {$exists: true}}]
			})
			.populate("provider document packFormat")
			.exec((err,docs)=>{
				if(err) return cb(err)
				logger.error("Found ", docs.length, " CookDesign articles in location D600 with SAP codes.")

				docs.forEach((doc) => {
					let match = artReferenceNumbers.some((ref) => { return ref == doc.externalReference })
					if (!match) deletedArticles.push(doc)
				})

				logger.error("Found ", deletedArticles.length, " CookDesign articles in location D600 with SAP codes NOT FOUND in Selenta\'s article list which are candidates for deletion.")
				cb(null, doc)
			})

		},(doc,cb)=>{ //Find providers in CookDesign with external references (SAP codes) and location D600 not included in Selenta's article list

			//Get list of providers
			Provider.find({
				$and: [ {location: {$in: locationFilter}}, {externalReference : {$exists: true}}]
			})
			.exec((err,docs)=>{
				if(err) return cb(err)
				logger.error("Found ", docs.length, " CookDesign providers in location D600 with SAP codes.")

				docs.forEach((doc) => {
					let match = provReferenceNumbers.some((ref) => { return ref == doc.externalReference })
					if (!match) deletedProviders.push(doc)
				})

				logger.error("Found ", deletedProviders.length, " CookDesign providers in location D600 with SAP codes NOT FOUND in Selenta\'s article list which are candidates for deletion.")
				cb(null, doc)
			})

		},(doc,cb)=>{ //Find articles in CookDesign with external references (SAP codes) that match those of the list sent by the Selenta web service

			Article.find({
				$and: [ {location: {$in: locationFilter}}, {"externalReference": { $in: artReferenceNumbers}}]
			})
			.populate("provider document packFormat")
			.exec((err,docs)=>{
				if(err) return cb(err)

				if(docs.length){
					logger.error('obtained list of received Selenta articles already in CookDesign, %s', docs.length);
					cookDesignExistingArticles = docs;
					//console.log('existingArticles',existingArticles.length)
					cb(null,doc)
				} else {
					logger.error('No received Selenta articles were found in CookDesign');
					cb(null,doc)
				}
				
			})

		},(doc,cb)=>{ // Populate linked ingredient of previous result. We are assuming that all Selenta articles are linked to ingredients and not packagings.

			if(cookDesignExistingArticles.length){

				Ingredient.populate(cookDesignExistingArticles,{path:"category.item"},(err,docs)=>{
					if(err) return cb(err)
					//console.log(docs.length,'docs')
					cb(null, doc)
				})

			}

		},(doc,cb)=>{ // populate measurementUnit of each article's linked Ingredient to get measurementUnitISO Code

			if(cookDesignExistingArticles.length){

				MeasurementUnit.populate(cookDesignExistingArticles,{path:"category.item.measurementUnit"},(err,docs)=>{
					if(err) return cb(err)
						//console.log(docs[0].category,'docs')
					cb(null, doc)
				})
			}

		},(doc,cb)=>{ //Now we break out the Selenta article list sent by the web service between those articles that have been found in CookDesign's database and which ones have not been found.

				exports.classifySelentaArticles(filteredSelentaArticles,cookDesignExistingArticles, (err,data)=>{
					if(err) return cb(err)
						notFoundArticles = data.notFound;
						existingArticles = data.existing;
						logger.error('classified list of received Selenta articles between nout found: %s',  notFoundArticles.length, ' and existing: ', existingArticles.length);
						//console.log(notFoundArticles.length,'notFound', existingArticles.length,'existing')
						cb(null,doc)
				})
				
			
		},(doc,cb)=>{ //Get list of providers in the Selenta list that exist in CookDesign's database

				Provider.find({
					"externalReference": { $in: provReferenceNumbers}
				})
				.populate("location")
				.exec((err,docs)=>{

					if(err) return cb(err)

					if(docs && docs.length){
						logger.error('Obtained list of Selenta providers already included in CookDesign, ',docs.length);
						existingProviders = docs
						//console.log('existingProviders',existingProviders.length)
						cb(null,doc)
					} else {
						logger.error('There are no Selenta providers created in CookDesign');
						cb(null,doc)
					}

				})

		},(doc,cb)=>{ //Separate list of Selenta providers between those that are in the CookDesign database and those that aren't

				exports.classifySelentaProviders(selentaProviders,existingProviders, (err,data)=>{
					if(err) return cb(err)
						notFoundProviders = data.notFound;
						existingProviders = data.existing;
  					logger.error('classified list of received Selenta providers between nout found: %s',  notFoundProviders.length, ' and existing: ', existingProviders.length);
						cb(null,doc)
				})

		},(doc,cb)=>{ //'Unwind' the provider array from each article object in the Selenta list.

			//console.log(cookDesignExisting.length,'cookDesignExisting',existingArticles.length,'existingArticles')
			existingArticles.forEach((articleSelenta)=>{
					
					if(articleSelenta.PROVIDER && articleSelenta.PROVIDER.length > 0){

						articleSelenta.PROVIDER.forEach((provider)=>{

							let articleObj = {
								MATNR: articleSelenta.MATNR.substring(9,18),
								MAKTX: articleSelenta.MAKTX,
								MSEH3: articleSelenta.MSEH3,
								MATKL: articleSelenta.MATKL,
								PROVIDER : [provider],
								UMA: articleSelenta.UMA,
								ALERGENOS: articleSelenta.ALERGENOS
							}
							unwindedSelentaArticles.push(articleObj)
						})
					} 
			})

			logger.error('\'Unwinded\' the provider array in each article object from the Selenta existing article list, ', unwindedSelentaArticles.length, '.');

			cb(null,doc)

		},(doc,cb)=>{ //Create a new array, articlesToCompare, of pair objects consisting of the Selenta article and its matching Cook Design article to make comparison easier and more efficient.
			//In case a combination pair of article and provider from the Selenta list is not found in CookDesign, push it in a separate array, articlesToLinked to later store it 
			//in the Selenta collection for manual process.

			unwindedSelentaArticles.forEach((articleSelenta)=>{

					let articleInCDMatch = cookDesignExistingArticles.find((articleInCD)=>{
						return (articleSelenta.MATNR == articleInCD.externalReference && articleSelenta.PROVIDER[0].LIFNR == articleInCD.provider.externalReference)
					})
					//console.log(match,'match')
					if(articleInCDMatch){

						let compareObj = {
							selenta : articleSelenta,
							cookDesign : JSON.parse(JSON.stringify(articleInCDMatch))
						}
						//console.log(articleSelenta,'articleSelenta',articleInCDMatch,'MATCHinCD')
						articlesToCompare.push(compareObj)

					} else { //Could not find an exact match of article and provider combination in CookDesign. Must be reviewed manually to create article or provider and link them.

						articlesToLinked.push(articleSelenta)

					}

			})

			logger.error('Created array of articles to be compared (automatically) ', articlesToCompare.length, ' and articles to be dealed manually.', articlesToLinked.length);

			cb(null,doc)	

		// }, (doc, cb) => { //Compare allergens ===> Deactivated by request of Oilmotion on 29/6/2019

		// 		async.eachSeries(articlesToCompare, (pairArticle, cb_async) => {

 		// 			pairArticle.cookDesign.provider = pairArticle.selenta.PROVIDER;

		// 			if(pairArticle.cookDesign.category.kind == 'ingredient') {			

		// 					//Check whether allergens have changed between articleSelenta and articleInCDMatch[0]
		// 		      allergenHelper.compareSelentaAndCDAllergens(pairArticle.cookDesign, pairArticle.selenta, selentaAllergens, (err, updatedAllergens, hasChanged) => {
		// 		        if(err) return cb_async(err)
		// 		        if (hasChanged) {
		// 		          //Article's allergens have changed, update them.
		// 		          pairArticle.cookDesign.allergens = updatedAllergens;
		// 		          articlesToUpdate.push({type: 'allergen', article: pairArticle.cookDesign})
		// 		        }
		// 		        process.nextTick(()=>cb_async()) 
		// 		      })
		// 		   }
		// 		   else
		// 		   {
		// 		   	process.nextTick(()=>cb_async())
		// 		   }

		// 		}, (err) => {
		// 			if(err) return cb(err)
		// 			logger.error('There are %s articles which allergens have changed ', articlesToUpdate.length);
		// 			cb(null,doc)
		// 		})

		},(doc,cb)=>{ //Compare pair objects from Selenta list and CookDesign in articlesToCompare array. Start with cost.

				logger.error('Comparing costs of matching CookDesign and Selenta articles...')
				let costNotChanged = 0;
				let noProvider = 0;
				let diffMeasUnit = 0;
				let nullItem = 0;
				let qty, cost, costPerUnit, conv;
				let conversionIssue=false;

				articlesToCompare.forEach((pairArticle) => {

					// logger.info('Evaluating SAP article %s of provider %s', pairArticle.selenta.MATNR, pairArticle.selenta.PROVIDER[0].LIFNR)
 					pairArticle.cookDesign.provider = pairArticle.selenta.PROVIDER;

					//1. Check whether category.item is not null
					if(pairArticle.cookDesign.category.item) {

							//2. Check whether selenta article has providers defined
						 if(pairArticle.selenta.PROVIDER.length){

									//3. Check whether the delivery unit and the base unit of the selenta article are the same or, if not, whether there is a 'conversion path'
									//   using UMA (alternative measuring unit)					 	
							 		if(pairArticle.selenta.MSEH3 == pairArticle.selenta.PROVIDER[0].ERFME) { //Same base unit and delivery unit.

							 			  // logger.info('Base unit %s is the same as delivery unit %s for article %s', pairArticle.selenta.MSEH3, pairArticle.selenta.PROVIDER[0].ERFME, pairArticle.selenta.MATNR)
							 				qty = Number(pairArticle.selenta.PROVIDER[0].ERFMG);
							 				cost = Number(pairArticle.selenta.PROVIDER[0].DMBTR);
							 				costPerUnit = cost / qty;
							 			  // logger.info('qty: %s for article %s', qty, pairArticle.selenta.MATNR)
							 			  // logger.info('cost: %s for article %s', cost, pairArticle.selenta.MATNR)
							 			  // logger.info('costPerUnit: %s for article %s', costPerUnit, pairArticle.selenta.MATNR)
							 		}
							 		else
							 		{

							 			diffMeasUnit++;

						 			  // logger.info('Base unit %s is different than the delivery unit %s for article %s', pairArticle.selenta.MSEH3, pairArticle.selenta.PROVIDER[0].ERFME, pairArticle.selenta.MATNR)

							 			if(pairArticle.selenta.UMA && pairArticle.selenta.UMA.length) {

							 				let convObj = pairArticle.selenta.UMA.filter( (conv) => {
							 					return conv.MEINS == pairArticle.selenta.MSEH3 && conv.MEINH == pairArticle.selenta.PROVIDER[0].ERFME;
							 				})

							 				if (convObj && convObj.length && (convObj[0].UMREN != "") && (convObj[0].UMREZ != "") && (convObj[0].UMREZ != "0")) {

							 						// logger.info("There is a convertion in UMA between measuring units for article %s", pairArticle.selenta.MATNR)
							 						// logger.info("convObj: %j for article", convObj, pairArticle.selenta.MATNR)

							 						conv = Number(convObj[0].UMREN) / Number(convObj[0].UMREZ);
									 				qty = Number(pairArticle.selenta.PROVIDER[0].ERFMG);
									 				cost = Number(pairArticle.selenta.PROVIDER[0].DMBTR);
						 							costPerUnit = (cost / qty ) * conv;

									 			  // logger.info('conv: %s for article %s', conv, pairArticle.selenta.MATNR)
									 			  // logger.info('qty: %s for article %s', qty, pairArticle.selenta.MATNR)
									 			  // logger.info('cost: %s for article %s', cost, pairArticle.selenta.MATNR)
									 			  // logger.info('costPerUnit: %s for article %s', costPerUnit, pairArticle.selenta.MATNR)

						 					} else {
							 					// logger.info("Could not find conversion in UMA between base and delivery units for %s", pairArticle.selenta.MATNR)
  						 					pairArticle.cookDesign.provider = pairArticle.selenta.PROVIDER;
							 					noConvUnitArticles.push(pairArticle.cookDesign);
							 					//Skip to next iteration
							 					return;
							 				}

							 			} else {
							 					// logger.info("UMA is empty. Could not find conversion in UMA between base and delivery units for %s", pairArticle.selenta.MATNR)
  						 					pairArticle.cookDesign.provider = pairArticle.selenta.PROVIDER;
												noConvUnitArticles.push(pairArticle.cookDesign);
							 					//Skip to next iteration
												return;
							 			}

							 		}

									//4. Compare the base unit of the selenta article and cookdesign article. If they are the same, we are done, otherwise check whether it's
									//   possible to convert from the selenta base unit to the cookdesign base unit using the netWeightPerUnit or nuber of units.
									if(pairArticle.selenta.MSEH3 != pairArticle.cookDesign.category.item.measurementUnit.referenceCode){

										//Check wether selenta base unit is base unit in CookDesign (KG,LT or UD)
										if(pairArticle.selenta.MSEH3=="KG" || pairArticle.selenta.MSEH3=="L" || pairArticle.selenta.MSEH3=="UD") {

											if(pairArticle.selenta.MSEH3=="UD") {

								 					if(pairArticle.cookDesign.netWeightPerUnit && pairArticle.cookDesign.netWeightPerUnit != "" && pairArticle.cookDesign.netWeightPerUnit != "0") {
								 						costPerUnit = costPerUnit / pairArticle.cookDesign.netWeightPerUnit;
								 					}
								 					else
								 					{
					 									// logger.info("CookDesign article does not have netWeightPerUnit. Add %s article to mismatchUnitArticles list", pairArticle.selenta.MATNR)
								 						mismatchUnitArticles.push(pairArticle.cookDesign);
									 					//Skip to next iteration
														return;								 						
								 					}

											}
											else
											{
												//Assume that €/KG or €/LT is the same as €/UD. Nothing to do...

											}

										}
										else //Selenta base unit is not a CookDesign base unit, eg, 'BT', 'PQ', 'LAT'...
										{

											if(pairArticle.cookDesign.category.item.measurementUnit.referenceCode=='L' || pairArticle.cookDesign.category.item.measurementUnit.referenceCode=='KG') {

								 					if(pairArticle.cookDesign.netWeightPerUnit && pairArticle.cookDesign.netWeightPerUnit != "" && pairArticle.cookDesign.netWeightPerUnit != "0") {
								 						costPerUnit = costPerUnit / pairArticle.cookDesign.netWeightPerUnit;
								 					}
								 					else
								 					{
					 									// logger.info("CookDesign article does not have netWeightPerUnit. Add %s article to mismatchUnitArticles list", pairArticle.selenta.MATNR)
								 						mismatchUnitArticles.push(pairArticle.cookDesign);
									 					//Skip to next iteration
														return;								 						
								 					}

											}
											else if(pairArticle.cookDesign.category.item.measurementUnit.referenceCode=='UD')
											{
							 					if(pairArticle.cookDesign.packUnits && pairArticle.cookDesign.packUnits != "" && pairArticle.cookDesign.packUnits != "0") {
							 						costPerUnit = costPerUnit / pairArticle.cookDesign.packUnits;
							 					}
							 					else
							 					{
				 									// logger.info("CookDesign article does not have netWeightPerUnit. Add %s article to mismatchUnitArticles list", pairArticle.selenta.MATNR)
							 						mismatchUnitArticles.push(pairArticle.cookDesign);
								 					//Skip to next iteration
													return;								 						
							 					}			
											}
										}
									}

					 				if(costPerUnit != pairArticle.cookDesign.netPrice) { //Cost has changed, must be updated

			 							// logger.info("Cost has changed from %s to %s, must be updated for %s", pairArticle.cookDesign.netPrice, costPerUnit, pairArticle.selenta.MATNR)
					 					let variation = Math.abs(costPerUnit - pairArticle.cookDesign.netPrice);
					 					let percentVariation = variation / pairArticle.cookDesign.netPrice;

					 					if(percentVariation>0.5) pairArticle.cookDesign.costWarning=true;
					 					else pairArticle.cookDesign.costWarning=false;

					 					pairArticle.cookDesign.previousNetPrice = pairArticle.cookDesign.netPrice; //save previous netPrice for reference
					 					pairArticle.cookDesign.netPrice = costPerUnit;
					 					if(pairArticle.cookDesign.costWarning) costVariationWarningArticles.push(pairArticle.cookDesign);
					 					else articlesToUpdate.push({type: 'price', article: pairArticle.cookDesign});

					 				} else {
			 								// logger.info("Cost has not changed for %s", pairArticle.selenta.MATNR)
						 					costNotChanged++;
					 				}

						 } else {
						 	  // logger.info("There is no provider for %s", pairArticle.selenta.MATNR)
								noProvider++;
						 }

					} else {
						// logger.info('Category.item in cookdesign article is null, skipping.')
						nullItem++;
	 					//Skip to next iteration
						return;				 					
					}

				})
 				logger.error('Found ', articlesToUpdate.length, ' articles which cost or allergens must be automatically updated in CookDesign.');
 				if(noConvUnitArticles.length) logger.error('Found %s Selenta articles without conversion between delivery and base units.', noConvUnitArticles.length)
				logger.error('Found %s Selenta articles which cost has not changed.', costNotChanged);
  			if(noProvider>0) logger.error('Found %s Selenta articles without provider.', noProvider)
  			if(diffMeasUnit>0) logger.error('Found %s Selenta articles with different base and delivery units which required unit conversion.', diffMeasUnit)
				if(nullItem>0) logger.error('Found %s CookDesign articles with category item null.', nullItem)
				if(mismatchUnitArticles.length) logger.error('Found %s articles which measuring unit did not match in CookDesign and in Selenta and must be manually reviwed.', mismatchUnitArticles.length);
				
				cb(null, doc)

		},(doc,cb)=>{ //Compare provider reference
				//1. Compare Selenta article field, IDNLF, with CookDesign article's reference field.
				//2. If the are equal, move on to the next article
				//3. If they have changed, update the reference field in the CookDesign article. Flag the article as updated in case it's not already flagged.

				cb(null, doc)

		},(doc,cb)=>{ //Remove all document in Selenta collection which are not of the type 'updatedArticle'

				Selenta.remove({"issue.type":{$nin:['updatedArticle']}}, (err, doc) => {
					if(err) return cb(err)
 					logger.error('Removed all documents from Selenta collection that are not of type \'updatedArticle\'.');
					cb(null, doc)
				})

		},(doc,cb)=>{ //Remove alls document in Selenta collection of type 'updatedArticle' older than 3 months

				let thresholdDate = moment().subtract(3, 'months');

				Selenta.remove(
					{
						"issue.type": "updatedArticle",
						"article.updatedDate" : {$lt: thresholdDate}
				}, (err, doc) => {
					if(err) return cb(err)
 					logger.error('Removed all documents from Selenta collection of type \'updatedArticle\' older than 3 months.');
					cb(null, doc)
				})

		},(doc,cb)=>{ //Save articlesToLinked array object to Selenta collection

				let discardedArticleBulkWrite = [];

				if(discardedArticles.length) {

					discardedArticleBulkWrite = discardedArticles.map((article) => {

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "discardedArticle",
	                  	description: "Article discarded because data is missing."
	                  }, 
	                  article : article
	               }
	            }
						}
					})
				}

				selentaBulkWrite = discardedArticleBulkWrite;

				let deletedArticleBulkWrite = [];

				if(deletedArticles.length) {

					deletedArticleBulkWrite = deletedArticles.map((article) => {

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "deletedArticle",
	                  	description: "Article not found in Selenta"
	                  }, 
	                  article : {
            					MATNR: article.externalReference,
            					cookDesignId: article._id
	                  }
	               }
	            }
						}
					})
				}

				selentaBulkWrite = selentaBulkWrite.concat(deletedArticleBulkWrite);

				let deletedProviderBulkWrite = [];

				if(deletedProviders.length) {

					deletedProviderBulkWrite = deletedProviders.map((provider) => {

						return {
							insertOne :
		            {
		               "document" :
		               {
		                  issue : {
		                  	type: "deletedProvider",
		                  	description: "Provider not found in Selenta"
		                  }, 
		                  provider : provider
		               }
		            }
							}
					})
				}

				selentaBulkWrite = selentaBulkWrite.concat(deletedProviderBulkWrite);

				let articleBulkWrite = [];

				if(notFoundArticles.length) {

					articleBulkWrite = notFoundArticles.map((article) => {

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "article",
	                  	description: "Not found in CookDesign"
	                  }, 
	                  article : article
	               }
	            }
						}
					})
				}

				selentaBulkWrite = selentaBulkWrite.concat(articleBulkWrite);

				let providerBulkWrite = [];

				if(notFoundProviders.length) {

					providerBulkWrite = notFoundProviders.map((provider) => {

						return {
							insertOne :
		            {
		               "document" :
		               {
		                  issue : {
		                  	type: "provider",
		                  	description: "Not found in CookDesign"
		                  }, 
		                  provider : provider
		               }
		            }
							}
					})
				}

				selentaBulkWrite = selentaBulkWrite.concat(providerBulkWrite);

				let articleToLinkBulkWrite = [];

				if(articlesToLinked.length) {

					articleToLinkBulkWrite = articlesToLinked.map((article) => {

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "article",
	                  	description: "Not found in CookDesign"
	                  }, 
	                  article : article
	               }
	            }
						}
					})
				}

				selentaBulkWrite = selentaBulkWrite.concat(articleToLinkBulkWrite);

				let originalArticlekBulkWrite = [];

				if(originalFilteredSelentaArticles.MATERIALS.length) {

					originalArticlekBulkWrite = originalFilteredSelentaArticles.MATERIALS.map((article) => {

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "originalArticle",
	                  	description: "Selenta article"
	                  }, 
	                  article : article,
	                  provider: article.PROVIDER
	               }
	            }
						}
					})
				}

				selentaBulkWrite = selentaBulkWrite.concat(originalArticlekBulkWrite);	

				let articlesToUpdatekBulkWrite = [];

				if(articlesToUpdate.length) {

					articlesToUpdatekBulkWrite = articlesToUpdate.map((obj) => {

					let article = obj.article;
					let type = obj.type;
					logger.info("type: %s", type)

					let description;
					let updatedDate = new Date();
					if(article.lang && article.lang.length) description = article.lang[0].description; else description = "<NOT AVAILABLE>"

					if(type == 'price') {

							return {
								insertOne :
			            {
			               "document" :
			               {
			                  issue : {
			                  	type: "updatedArticle",
			                  	description: "Article cost has changed from " + article.previousNetPrice.toFixed(4) + " to " + article.netPrice.toFixed(4) + " for provider " + article.provider[0].NAME1
			                  }, 
			                  article : {
			                  	MAKTX: description,
			                  	MATNR: article.externalReference,
			                  	cookDesignId: article._id,
			                  	updatedDate: updatedDate,
			                  	costWarning: article.costWarning
			                  },
			                  provider: article.provider
			               }
			            }
								}
						}
						else if(type=='allergen')
						{

							return {
								insertOne :
			            {
			               "document" :
			               {
			                  issue : {
			                  	type: "updatedAllergens",
			                  	description: "Article allergens have changed"
			                  }, 
			                  article : {
			                  	MAKTX: description,
			                  	MATNR: article.externalReference,
			                  	cookDesignId: article._id,
			                  	updatedDate: updatedDate,
			                  },
			                  provider: article.provider
			               }
			            }
								}
						}
					})
				}

				selentaBulkWrite = selentaBulkWrite.concat(articlesToUpdatekBulkWrite);	

				let nonConvUnitsArticlesBulkWrite = [];

				if(noConvUnitArticles.length) {

					nonConvUnitsArticlesBulkWrite = noConvUnitArticles.map((article) => {

					let description;
					if(article.lang && article.lang.length) description = article.lang[0].description; else description = "<NOT AVAILABLE>"

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "noConvArticle",
	                  	description: "There is no conversion available between base unit and delivery unit in Selenta list."
	                  }, 
	                  article : {
	                  	MAKTX: description,
	                  	MATNR: article.externalReference,
	                  	cookDesignId: article._id
	                  },
	                  provider: article.provider
	               }
	            }
						}
					})
				}  

				selentaBulkWrite = selentaBulkWrite.concat(nonConvUnitsArticlesBulkWrite);	

				let costWarningArticlesBulkWrite = [];

				if(costVariationWarningArticles.length) {

					costWarningArticlesBulkWrite = costVariationWarningArticles.map((article) => {

					let description;
					if(article.lang && article.lang.length) description = article.lang[0].description; else description = "<NOT AVAILABLE>"

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "costVariationWarning",
	                  	description: "Article cost has changed by more than 50% from " + article.previousNetPrice.toFixed(4) + " to " + article.netPrice.toFixed(4) + " for provider " + article.provider[0].NAME1
	                  }, 
	                  article : {
	                  	MAKTX: description,
	                  	MATNR: article.externalReference,
	                  	cookDesignId: article._id
	                  },
	                  provider: article.provider
	               }
	            }
						}
					})
				} 

				selentaBulkWrite = selentaBulkWrite.concat(costWarningArticlesBulkWrite);	

				let mismatchUnitArticlesBulkWrite = [];

				if(mismatchUnitArticles.length) {

					mismatchUnitArticlesBulkWrite = mismatchUnitArticles.map((article) => {

					let description;
					if(article.lang && article.lang.length) description = article.lang[0].description; else description = "<NOT AVAILABLE>"

					return {
						insertOne :
	            {
	               "document" :
	               {
	                  issue : {
	                  	type: "mismatchUnitArticle",
	                  	description: "There is a mismatch between the measuring unit of the Selenta article and the measuring unit of the ingredient associated with the CookDesign article."
	                  }, 
	                  article : {
	                  	MAKTX: description,
	                  	MATNR: article.externalReference,
	                  	cookDesignId: article._id
	                  },
	                  provider: article.provider
	               }
	            }
						}
					})
				}  

				selentaBulkWrite = selentaBulkWrite.concat(mismatchUnitArticlesBulkWrite);	

				Selenta.bulkWrite(selentaBulkWrite, (err, res) => {
					if(err) return cb(err)
 					logger.info('Bulk saved articles and providers in Selenta not found in CookDesign and viceversa, and ...');
 					logger.info('...bulk saved Selenta articles for which there is not a pair combination of article/provider in CookDesign and must be dealt manually, and...');
 					logger.info('...bulk saved original articles (after filtering) sent by the Selenta web service. Total count: ',res.nInserted);
					cb(null, doc)
				})

		},(doc,cb)=>{ //Bulk save the CookDesign articles that have been modified using the updated flag to determine whether it has been updated or not.
		
				logger.info('Save: update CookDesign articles which cost has changed');

				if(articlesToUpdate.length) {

					logger.error('Save: update CookDesign articles which cost has changed. Total articles to update: ',articlesToUpdate.length);

					async.eachSeries(articlesToUpdate, function(obj, cb_async) {

						let article = obj.article;
						let type = obj.type;
						let articleId = new ObjectId(article._id);

						Article.findById(articleId, (err, doc) => {
		          if(err) return cb_async(err);
          		if(!doc) {  
          			logger.error('Article not found!')
          			return cb_async();
          		}

          		if(type == 'price') doc.netPrice = Number(article.netPrice);
          		else if(type == 'allergen') doc.allergens = article.allergens;
          		
          		// Calc pack price
          		if(doc.packUnits && doc.netWeightPerUnit) doc.packPrice = Number(article.netPrice) * Number(doc.packUnits) * Number(doc.netWeightPerUnit);

	            doc.save((err, doc) => {
	              if(err) return cb_async(err);
	              logger.error("Successfully saved updated article")
	              cb_async();
	            })
		        })

		      },(err)=>{
		        if(err) return cb(err);
		        logger.error('Save: updated CookDesign articles that have changed.');
		        cb(null, doc);
		      });
				
				}else{
					cb(null,doc);
				}

		}],(err,doc)=>{
				if(err) return callback(err)
			 	callback()
		})
}


//Classifies list of received selenta articles between those that are already in the database and those that either are not created or not linked.
exports.classifySelentaArticles = (selentaArticles, cookDesignExistingArticles, callback) =>{
	
	var existing = []
	var notFound = []
	
	async.waterfall([
		(cb)=>{
			//console.log(cookDesignExistingArticles,'cookDesignExistingArticlesHELPER')
			cookDesignExistingArticles.forEach((articleInBBDD)=>{
					
				let index = selentaArticles.MATERIALS.findIndex((articleToImport)=>{
					return articleToImport.MATNR == articleInBBDD.externalReference	// provider.externalReference??
				});

				if(index){	

					let existingObj = selentaArticles.MATERIALS.splice(index,1)
					//console.log(existingObj,'exist')
					existing.push(existingObj[0])						
				} 

			})

			let res = {
				notFound : selentaArticles.MATERIALS, //Any remaining objects in the array selentaArticles.MATERIALS were not found in CookDesign database
				existing : existing
			}
			cb(null,res)

		}],(err,doc)=>{

			if (err) return callback(err);	     
	    callback(null, doc);
	})

}

exports.getProvidersExternalReference = (selentaArticles,callback) => { // 

	var provReferenceNumbers = [];
	var existingArticlesProviders = []
	var providers = [];
	var uniqueProviderArray;

	async.waterfall([

		(cb)=>{

			selentaArticles.MATERIALS.forEach((article)=>{
				//console.log(article,'article')
				if(article.PROVIDER && article.PROVIDER.length){

					article.PROVIDER.forEach((provider)=>{
						//console.log(prov,'prov')

						let providerObj = {
							LIFNR: provider.LIFNR,
							NAME1: provider.NAME1
						}
						
						providers.push(providerObj)

					})
					
				}	
				
			})

			//console.log(providers.length, 'providers length')

			//Remove duplicates
			uniqueProviderArray = _.uniq(providers, function(provider){ //the function uses the objects code in order to determine uniqueness
			    return provider.LIFNR;
			});

			//console.log(uniqueProviderArray.length, 'unique provider array length')

			provReferenceNumbers = uniqueProviderArray.map((provider) => {return provider.LIFNR;})

			//console.log(provReferenceNumbers.length, 'provReferenceNumbers array length')

		  let provObj = {
				providers: uniqueProviderArray,
				providersExternalReferences: provReferenceNumbers
			}
			
			cb(null,provObj);

	}],(err,doc)=>{
		if(err) return callback(err)
		callback(null,doc)
	})
}


//Classifies list of received selenta providers between those that are already in the database and those that either are not created or not linked.
exports.classifySelentaProviders = (selentaProviders, existingProviders, callback) =>{
	
	var existing = []

	async.waterfall([
		(cb)=>{

			existingProviders.forEach((providerInBBDD)=>{
					
				let index = selentaProviders.findIndex((providerToImport)=>{
					return providerToImport.LIFNR == providerInBBDD.externalReference	// provider.externalReference??
				});

				if(index){	

					let existingObj = selentaProviders.splice(index,1) //Remove found provider from Selenta's list
					//console.log(existingObj,'exist')
					existing.push(existingObj[0])						
				
				} 
			})

			let res = {
				notFound : selentaProviders, //Any remaining objects in the array selentaProviders were not found in CookDesign database
				existing : existing
			}

			cb(null,res)
			
		}],(err,doc)=>{

			if (err) return callback(err);	     
	    callback(null, doc);
	})

}
