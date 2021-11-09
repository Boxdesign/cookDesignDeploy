var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '30 22 * * 1-4' : '0 4 * * *' //production at 22:30 UTC or 00:30 CET (Barcelona) and dev every 3 minutes
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.selentaMasterDataWebService;
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '30 22 * * 1-4'  //production at 22:30 UTC or 00:30 CET (Barcelona)
	break;

	case 'staging':
			schedule = '30 22 * 12 1-4'
	break;

	default:
		schedule = '0 4 * * *'
	break
}

exports.masterDataTask = cron.schedule(schedule, () => {

	var async = require('async');
 	var request = require('request');
	var {ObjectId} = require('mongodb');
	var config = require('../config/config');
	var qs = require('querystring')
	var families = []
	var selentaFamilies = [];
	var filteredFamilies = { MATERIALS: [] }
	var artReferenceNumbers = []
	var provReferenceNumbers = []
	var WebServiceLog = require('../models/selentaLog')
	var Article = require('../models/article')
	var Location = require('../models/location')
	var Provider = require ('../models/provider')
	var Selenta = require ('../models/selenta')
	var Family = require ('../models/family')
	var MeasurementUnit = require ('../models/measurementUnit')
	var selentaHelper = require('../helpers/selentaWebService')
  var selentaSE;
  var arrayFamiliesAndSubfamilies = []
  var selentaSEnotExistingInBBDD = [];
  var selentaSEexistingInBBDD = [];
  var selentaMasterData;
  var selentaBulkWrite;

	logger.info('Starting job...');

		async.waterfall([

			(cb)=>{

				var qs  = {}

        request.get({url: config.selenta.wsMasterDataUrl, qs:qs, json: true }, (err, res, body) => {
              
          if(err) return cb(err)
          
          logger.info('successfully executed request to Selenta web service.');

					if(body) {

						if(body.DADES_MESTRES && body.DADES_MESTRES.length){
							logger.info('Obtained %s Selenta MasterData GRUPS,UMB and PPVV');

							selentaFamilies = body.DADES_MESTRES;
							logger.info('selentaFamiliesLength: %s',selentaFamilies[0].GRUPS.length)

							if(selentaFamilies[0].GRUPS.length == 0){

								let err = new Error ("Array of Selenta Families is empty.")
								logger.error('Array of Selenta Families is empty.');
								return cb(err)

							}

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

				  cb(null, true)

				});

			},(doc,cb)=> { //Filter Selenta list and save it in filteredSelentaArticles array
				
			  selentaSE = selentaFamilies[0].GRUPS.filter((grupArticles)=>{
			  	
					return grupArticles.GRUP_ARTICLES.slice(0,1) == '5';

				})
				logger.info('filtered selenta MasterData.GRUPS with code of "recipeFamilys" == 5 to extract families and subfamilies of SE: Total lenght: %s',selentaSE.length)
		
				cb(null, doc)


			},(doc,cb)=>{

				Family.find({"category":"recipe"})  
				.exec((err,doc)=> {
					if(err) return cb(err)
									//console.log(doc,'doc')
					if(!doc) {
						let err = new Error('Could not find family!')
						return cb(err)
					}

					doc.forEach((family)=>{

						let familyExternalCode = family.externalCode || '';

						let familyObject = {
							familyId: family._id,
							externalCode : familyExternalCode,
							type:'family'
						}

						arrayFamiliesAndSubfamilies.push(familyObject);

						if(family.subfamilies.length > 0){

							family.subfamilies.forEach((subfamily)=>{

								let subfamilyExternalCode = subfamily.externalCode || '';

								let subfamilyObject = {
									externalCode: subfamilyExternalCode,
									subfamilyId: subfamily._id,
									type:'subfamily',
									familyId : family._id
								}

								arrayFamiliesAndSubfamilies.push(subfamilyObject)

							})

						}

					})

					logger.info('Extract All families and subfamilies of cookDesign BBDD into arrayFamiliesAndSubfamilies: %s',arrayFamiliesAndSubfamilies.length);
					//console.log('MAXLENGTH of FAMILIES AND SUBFAMILIES IN COOKDESIGN',arrayFamiliesAndSubfamilies.length)
					cb(null,doc)
				})

		},(doc,cb) => {

			WebServiceLog.find(
				{ 
					$and : [
						{"success":true},
						{"type":"masterData"}
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

			 			lastExportDate = logs[0].date //Found last successful log for subroduct web service
						logger.info('Found last successful web service log for the masterData web service! %s', lastExportDate);

			 		
			 		} else {

			 			let date = new Date();
			 			lastExportDate = date.toISOString();
						logger.info('Could not find a successful log or simply any log. Using actual date. %s', lastExportDate);

			 		}
			 		cb(null,doc)
				})

		},(doc,cb)=>{		// compare selentaSE ('recipeFamilys') with families in cookDesign BBDD
				
				logger.info('Compare each recipeFamily Objects %s with length of externalCode and then switch action where compare arrayFamiliesAndSubfamilies %s who contains each family and subfamily in BBDD with category = "recipe"', selentaSE.length, arrayFamiliesAndSubfamilies.length);

				selentaSE.forEach((recipeFamily, index)=>{

						switch(true){

							case recipeFamily.GRUP_ARTICLES.length == 1 : 
								
								logger.info('case where length in externalCode is 1 (type of family == recipe (in this case recipeFamily("5")))')
								break;

							case recipeFamily.GRUP_ARTICLES.length == 3 : 

								// let existFamilyName = arrayFamiliesAndSubfamilies.filter((family)=>{

								// 	return family.externalCode == recipeFamily.GRUP_ARTICLES.slice(1,3)
								// })
								let famIndex = arrayFamiliesAndSubfamilies.findIndex(family => family.externalCode == recipeFamily.GRUP_ARTICLES.slice(1,3))

								if(famIndex != -1){

			            arrayFamiliesAndSubfamilies.splice(famIndex,1)

									logger.info('case where lenght in externalCode is 3 (family code): This recipeFamily already exist in cookDesign BBDD: pushing into selentaSEexistingInBBDD and remove familyObject in arrayFamiliesAndSubfamilies')
								
								} else {

									let recipe = {
										GRUP_ARTICLES: recipeFamily.GRUP_ARTICLES,
										DESCRIPCIO: recipeFamily.DESCRIPCIO,
										familyId: null,
										type:'family'
									}

									selentaSEnotExistingInBBDD.push(recipe)
									logger.info('case where lenght in externalCode is 3 (family code): This recipeFamily not exist in cookDesign BBDD: pushing into selentaSEnotExistingInBBDD ')

								}

								break;
							
							case recipeFamily.GRUP_ARTICLES.length == 9 :

									let subfamIndex = arrayFamiliesAndSubfamilies.findIndex(existSubfamily => existSubfamily.externalCode === recipeFamily.GRUP_ARTICLES.slice(1,9))
									// let existSubfamily = arrayFamiliesAndSubfamilies.filter((subfamily)=>{

									// 	return ((subfamily.externalCode == recipeFamily.GRUP_ARTICLES.slice(1,9)) && (recipeFamily.GRUP_ARTICLES.slice(5,9) != '1000')) 

									// })

									if(subfamIndex != -1){

			              arrayFamiliesAndSubfamilies.splice(subfamIndex,1)

										logger.info('case where lenght in externalCode is 9 (subfamily code): This recipeFamily already exist in cookDesign BBDD: pushing into selentaSEexistingInBBDD and remove subfamilyObject in arrayFamiliesAndSubfamilies')

									} else {

										if(recipeFamily.GRUP_ARTICLES.slice(5,9) != '1000'){

											let subRecipeFamily = {
												GRUP_ARTICLES : recipeFamily.GRUP_ARTICLES,
												DESCRIPCIO : recipeFamily.DESCRIPCIO,
												familyId : null,
												type: 'subfamily'
											}

											selentaSEnotExistingInBBDD.push(subRecipeFamily)

										}
										
										logger.info('case where lenght in externalCode is 9 (subfamily code): This recipeFamily not exist in cookDesign BBDD: pushing into selentaSEnotExistingInBBDD ')

									}

								break;
							
							default:

								break;
						}						

				})

				logger.info('After filter: SelentaSEexistInBBDD.length --- %s , selentaSEnotExistingInBBDD.length --- %s and arrayFamiliesAndSubfamilies(families and subfamilies that exist in BBDD but not in Selenta) --- %s',selentaSEexistingInBBDD.length,selentaSEnotExistingInBBDD.length,arrayFamiliesAndSubfamilies.length)
				cb(null,doc)
 
		}, (doc,cb)=>{

				Selenta.remove({"issue.type":"family"}, (err, doc) => {
					if(err) return cb(err)
 					logger.info('Removed all documents from Selenta collection.');
					cb(null, doc)
				})

	  },(doc,cb)=> { //Save array object to Selenta collection

	  		let familySelentaNotInCookDesignBulkWrite = [];

	  		if(selentaSEnotExistingInBBDD.length){

	  			familySelentaNotInCookDesignBulkWrite = selentaSEnotExistingInBBDD.map((familyOrSubfamily)=>{

	  					return obj = {

	  						insertOne : 
	  							{
	  								"document":
	  								{
	  									issue: {
	  										type: "family",
	  										description: "Selenta recipeFamily not in DB"
	  									},
	  									family: familyOrSubfamily
	  								}

	  							}
	  					}

	  			})
	  		}
	  		//console.log(familySelentaNotInCookDesignBulkWrite.length,'familySelentaNotInCookDesignBulkWrite')
	  		selentaBulkWrite = familySelentaNotInCookDesignBulkWrite;

	  		let familyInCookDesignButNotInSelentaBulkWrite = [];

	  		if(arrayFamiliesAndSubfamilies.length){

	  			familyInCookDesignButNotInSelentaBulkWrite = arrayFamiliesAndSubfamilies.map((familyOrSubfamily)=>{

	  					return obj = {

	  						insertOne :
			             {
			                "document" :
			                {
			                   issue : {
			                   	type: "family",
			                   	description: "recipeFamily in DB not matching with Selenta families"
			                   }, 
			                   family : familyOrSubfamily
			                 }
			              }

	  					}

	  			})
	  		}

	  		//console.log(familyInCookDesignButNotInSelentaBulkWrite.length,'familyInCookDesignButNotInSelentaBulkWrite')
	  		selentaBulkWrite = selentaBulkWrite.concat(familyInCookDesignButNotInSelentaBulkWrite)
				//console.log(selentaBulkWrite.length,'selentaBulkWrite')

				if(selentaBulkWrite.length) {
					
					Selenta.bulkWrite(selentaBulkWrite, (err, res) => {
						if(err) return cb(err)
	 					logger.info('Bulk saved families and subfamilies in Selenta not found in CookDesign and viceversa, and ...');
	 					logger.info('...bulk saved Selenta families for which there is not in CookDesign and must be dealt manually, and...');
	 					logger.info('...bulk saved original families and subfamilies (after filtering) sent by the Selenta web service. Total count: ',res.nInserted);
						cb(null, doc)
					})
				
				}
				else
				{
 					logger.info('Bulk write array is empty, no operations to perform.');
					cb(null, doc)
				}

		}],(err,doc)=>{
				if(err) logger.error(err);
			 	logger.info('Finished job.');
		})
})
