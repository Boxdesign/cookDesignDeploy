
var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '30 21 * * 1-4' : '0 4 * * *' //Prod at 21:30 UTC / 23:30 CET and dev evert 5 min
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.selentaSubpWebService;
var schedule;

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '30 21 * * 1-4'  //Prod at 21:30 UTC / 23:30 CET
	break;

	case 'staging':
			schedule = '30 21 * 12 1-4'
	break;

	default:
		schedule = '0 4 * * *'
	break
}

exports.subproductTask = cron.schedule(schedule, () => {

 	let locCenter;
 	let lastExportDate = new Date();
 	let subproductsToExport;
 	var async = require('async');
 	var request = require('request');
 	var Location = require('../models/location')
	var SelentaLog = require('../models/selentaLog')
  var Subproduct = require('../models/subproduct')
  var Ingredient = require('../models/ingredient')
  var MeasurementUnit = require('../models/measurementUnit')
  var Process = require('../models/process')
  var Family = require('../models/family')  
  var Utensil = require('../models/utensil')
  var CheckPoint = require('../models/checkpoint')
  var Location = require('../models/location')
	var {ObjectId} = require('mongodb');
	var config = require('../config/config');
	var subproducts = { "DATA": [] }
	var transactionOk = false;
	var subproductCode = '5'
	var noFamilyCode = '99'
  var costHelper= require ('../helpers/cost');
  var costLocationFilter = [];
  var locationFilter = [];
  var locationHotelSofia;
  var moment = require('moment')

	logger.info('Subproduct Web Service - Starting job...');

	async.waterfall([

		(cb) => {

			Location.findOne(
					{
						"referenceNumber": "D600"  //Reference number of Hotel Sofia location
					} 
				)  
				.exec((err,doc)=> {
					if(err) return cb(err)

					if(!doc) {
						let err = new Error('Could not find location!')
						return cb(err)
					}
					logger.info('Found Hotel Sofia location for the subproduct web service!');

					locationHotelSofia = doc;
					costLocationFilter.push(locationHotelSofia); //Add just one location to location filter
					locationFilter.push(locationHotelSofia);
					cb(null,doc)
				})

		},(doc,cb) => { //Find locations hanging from Hotel Sofia

			Location.find(
					{
						parent_company: locationHotelSofia._id  
					} 
				)  
				.exec((err,doc)=> {
					if(err) return cb(err)

					if(!doc) {
						let err = new Error('Could not find location!')
						return cb(err)
					}
					locationFilter = locationFilter.concat(doc);
					logger.info('Found %s locations hanging from Hotel Sofia location.', doc.length);
					cb(null,doc)
				})

		},(doc,cb) => { //Map location arrays to ids

				locationFilter = locationFilter.map((loc) => {
					return new ObjectId(loc._id)
				})

				costLocationFilter = costLocationFilter.map((loc) => {
					return new ObjectId(loc._id)
				})

				//logger.info('locationFilter: %j',locationFilter)
				//logger.info('costLocationFilter: %j',costLocationFilter )				

				cb(null,doc)

		},(doc,cb) => {

			SelentaLog.find(
				{ 
					$and : [
						{"success":true},
						{"type":"subproduct"}
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
						logger.info('Found last successful web service log for the subproduct web service! %s', lastExportDate);
			 		
			 		} else {

			 			lastExportDate = new Date(2000,1,1)
						logger.info('Could not find a successful log or simply any log. Using date %s', lastExportDate);

			 		}
			 		cb(null,doc)
				})

		},(doc,cb) => {

			//Finding Subproducts that have been updated, we need make an aggregate of path versions and then find with updatedAt
			Subproduct.aggregate([
					{
	   				$unwind: {
	   					path: "$versions",
	   					preserveNullAndEmptyArrays: true
	   				}
	   			},
   				{$match:{"versions.active": true}},
   				{$match:{"versions.lang.langCode": 'es'}},
  	      {$match: {'location': {$in: locationFilter}}},	   			
   				{$match:{"versions.updatedAt": {$gte: lastExportDate}}}

	   		],(err,doc)=>{

					if(err) return cb(err)

					logger.info('There are %s subproducts to be exported.', doc.length);
				
					Subproduct.populate(doc,{path: "measurementUnit family family.subfamilies versions.gallery location"}, (err, docs) => {
            if (err) return cb(err)
              
            subproductsToExport = docs;

            cb(null, true)
          });
				})

		},(doc,cb)=>{

				async.eachSeries(subproductsToExport, (subproduct, cb_async1 )=>{

					if(subproduct.versions.composition.length){

							async.eachSeries(subproduct.versions.composition, function(compElement,cb_async2){

								if(compElement.element.kind == 'ingredient'){

									Ingredient.populate(compElement,{path:"element.item"},(err,doc)=>{
										if(err) return cb_async2(err)

										if(compElement.element.item != null) {

											//Udpdate unit cost and locationCost of ingredient
				              compElement.unitCost = compElement.element.item.referencePrice;

				              if(compElement.element.item.locationCost) { 
				                compElement.locationCost = compElement.element.item.locationCost; 
				              } else {
				                compElement.locationCost = [];
				              }

				              //Update composition element unitCost with average location cost based on filterLocation
				              //costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, costLocationFilter, Ingredient);

			                let userLang=[];

			                userLang = compElement.element.item.lang.filter((langItem) => {
			                  return langItem.langCode=='es';
			                })

			                if(userLang.length) {
			                  //The client assumes item is not populated. Must de-populate it.
			                  compElement.name = userLang[0].name;
			                }

			              } else {
			              	logger.error('Could not populate ingredient in subproduct recipe')
			              }

										cb_async2();
									})
									

								} else if(compElement.element.kind == 'subproduct') {

									let id = compElement.element.item;

									Subproduct.populate(compElement,{path:"element.item"},(err,doc)=>{
										if(err) return cb_async2(err)

										if(!compElement.element.item) {
											
											logger.error('Error populating composition element of type subproduct');
											cb_async2();
										
										} else {

											//Filter active version
											let activeVersion = compElement.element.item.versions.filter((version) => {
			                  return version.active;
			                })

			                if(activeVersion.length) {

			                	compElement.element.item.versions = activeVersion; //Save active version

				                //Udpdate unit cost and locationCost of subproduct
				                compElement.unitCost = compElement.element.item.versions[0].unitCost;
				                if(compElement.element.item.versions[0].locationCost) { 
				                  compElement.locationCost = compElement.element.item.versions[0].locationCost;
				                } else  {
				                  compElement.locationCost = [];
				                }

				                //Update composition element unitCost with average location cost based on filterLocation
		                		//costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, costLocationFilter, Subproduct);

				                //Filter user language
				                let userLang=[];

				                userLang = compElement.element.item.versions[0].lang.filter((langItem) => {
				                  return langItem.langCode=='es';
				                })

				                if(userLang.length) {
				                  compElement.name = userLang[0].name;
				                }

												cb_async2();

											} else {
												logger.error('Error obtaining active version of subproduct');
												cb_async2();											
										  }												

										}
									})

								}

							},function (err){ //finished async_2
								if(err) return cb_async1(err)
								cb_async1(null,doc)
							})
						} else {
							process.nextTick(() => cb_async1(null,doc))
						}

				}, (err) => { //Finished cb_async1
					 if(err) return cb(err)
					 cb(null, doc)
				})

		}, (doc, cb) => {

						MeasurementUnit.populate(subproductsToExport,{path:"versions.composition.measuringUnit"},(err,docs)=>{
							if(err) return cb(err)
							cb(null, doc)
						})

		},(doc,cb)=>{ // populate Process of.cookingSteps for generate cookingStepsTable (information of process of each cookingStep)

						Process.populate(subproductsToExport,{path:"versions.cookingSteps.process"},(err,docs)=>{
							if(err) return cb(err)
							cb(null, doc)
						})

		},(doc,cb)=>{ // populate utensil of cookingStep for generate cookingStepsTable (information of utensil of each cookingStep)

						Utensil.populate(subproductsToExport,{path:"versions.cookingSteps.utensil"},(err,docs)=>{
							if(err) return cb(err)
							cb(null, doc)
						})

		},(doc,cb)=>{ // populate utensil of cookingStep for generate cookingStepsTable (information of utensil of each cookingStep)

						Family.populate(subproductsToExport,{path:"versions.cookingSteps.utensil.externalFamily"},(err,docs)=>{
							if(err) return cb(err)
							cb(null, doc)
						})						

		}, (doc,cb)=>{ // populate checkpoint of cookingStep for generate cookingStepTable (information of checkpoints of each cookingStep)

						CheckPoint.populate(subproductsToExport,{path:"versions.cookingSteps.criticalCheckpoint versions.cookingSteps.gastroCheckpoint"}, (err,docs)=>{
							if(err) return cb(err)
							cb(null, doc)
						})

		},(doc,cb)=> { //Update cost for Hotel Sofia Location

				costHelper.calculateAvgRecipeLocCostAndAllergens(subproductsToExport, Subproduct);
				cb(null, doc)

		},(doc,cb)=> {
			
					let subproductObj;

					subproductsToExport.forEach((subproduct)=>{
						let name, image , cost;
						let measuringUnitCode;
						let family
						let subfamily
						let numServings = 0;
						let optimumWeight;
						let conversionTable;
						let subfamilyId = null;
						let compositionTable = []
						let cookingStepsTable = []
						let compositionObj = {}
 						let cookingStepObj = {}
						let status;
						let checkpoint;
						let caducityFresh;
						let caducityFreeze;
						let daysToUse;

						if(subproduct.versions.lang && subproduct.versions.lang.length) name = subproduct.versions.lang[0].name; else name='<NO DISPONIBLE>'
						if(subproduct.versions.gallery && subproduct.versions.gallery.sizes && subproduct.versions.gallery.sizes.length ) image = subproduct.versions.gallery.sizes[1].url; else image='<NO DISPONIBLE>'
						if(subproduct.measurementUnit && subproduct.measurementUnit.referenceCode) measuringUnitCode = subproduct.measurementUnit.referenceCode; else measuringUnitCode='<NO DISPONIBLE>';
						if(subproduct.family && subproduct.family.externalCode) {family = subproductCode + subproduct.family.externalCode.toString()	} else {	family = subproductCode + noFamilyCode;}

						cost = subproduct.versions.unitCost;
						
						if(subproduct.caducityFresh && subproduct.caducityFresh.value != 0) {

							if(subproduct.caducityFresh.timeUnit == 'd.')	caducityFresh = subproduct.caducityFresh.value;
							else caducityFresh = subproduct.caducityFresh.value * 30;

						} else {
							caducityFresh = 0;
						}
						
						if(subproduct.caducityFreeze && subproduct.caducityFreeze.value != 0) {

							if(subproduct.caducityFreeze.timeUnit == 'd.') caducityFreeze = subproduct.caducityFreeze.value;
							else caducityFreeze = subproduct.caducityFreeze.value * 30;

						} else {
							caducityFreeze = 0;
						}

						if(subproduct.daysToUse && subproduct.daysToUse.value != 0) {

							if(subproduct.daysToUse.timeUnit == 'd.')	daysToUse = subproduct.daysToUse.value;
							else daysToUse = subproduct.daysToUse.value * 30;

						} else {
							daysToUse = 0;
						}

						if(subproduct.versions.batchWeight) optimumWeight=subproduct.versions.batchWeight; 
						else if(subproduct.versions.netWeight) optimumWeight=subproduct.versions.netWeight; 
						else optimumWeight=0;

						if(subproduct.subfamily){	

							subfamilyId = new ObjectId(subproduct.subfamily) 

							subproduct.family.subfamilies.forEach((subfam)=>{
								let subId = new ObjectId(subfam._id)							

								if(subfamilyId.equals(subId)){
									let subfamExternalCode = subfam.externalCode || '99001000'
									subfamily = subproductCode + subfamExternalCode.toString();
								} 								
							})

						} else {	
							subfamily = family + '001000'; 
						}

						/* ----------------  Build composition table -----------------*/
						if(subproduct.versions.composition.length){

							//let name;
							subproduct.versions.composition.forEach((compElement,index)=>{

								let referenceNumber;
								let compElementName;

								if(compElement.element.item && compElement.element.item.referenceNumber) referenceNumber = compElement.element.item.referenceNumber; else referenceNumber = '000000000000000000000';
								compElementName = compElement.name;
								if(compElement.grossWeight) compElementGrossWeight = compElement.grossWeight.toFixed(3); else  compElementGrossWeight=0;
								if(compElement.measuringUnit && compElement.measuringUnit.referenceCode) compElementMeasUnit = compElement.measuringUnit.referenceCode; else compElementMeasUnit='<N/A>';

								 compositionObj = {
								 	"COMP_REFERENCIA" : referenceNumber,
								 	"NOMBRE" : compElementName,  //For subproducts, we have removed the versions key and added the active version in the previous step
								 	"PESO": compElementGrossWeight,
								 	"UM": compElementMeasUnit
								 }
								 compositionTable.push(compositionObj)
							})
						
						} else {
							compositionTable = []
						}

						/* ----------------  Build cooking steps table -----------------*/

						if(subproduct.versions.cookingSteps.length){

							subproduct.versions.cookingSteps.forEach((cookingStep, index)=>{

								let checkpoint;
								let utensil = [];
								let resource = [];
								let tableware=[];

								if(cookingStep.gastroCheckpoint) checkpoint = cookingStep.gastroCheckpoint.lang[0].name; else checkpoint='N/A';
								if(cookingStep.criticalCheckpoint) checkpoint = checkpoint + ' / ' + cookingStep.criticalCheckpoint.lang[0].name;
							
								//Send utensil data based on type: utensil (code 1), resource (code 2), tableware (code 3)
								if (cookingStep.utensil.externalLink && cookingStep.utensil.externalFamily && cookingStep.utensil.externalSubfamily) {

									let externalSubfamilyId = new ObjectId(cookingStep.utensil.externalSubfamily)

									cookingStep.utensil.externalFamily.subfamilies.forEach((subfamily) => {
										let subfamilyId = new ObjectId(subfamily._id)
										if(subfamilyId.equals(externalSubfamilyId)) {
											cookingStep.utensil.extSubfamily = subfamily;
										}
									})

									let utensilName;

									if(cookingStep.utensil.lang && cookingStep.utensil.lang.length) utensilName = cookingStep.utensil.lang[0].name; else utensilName='N/A' 

									switch(cookingStep.utensil.extSubfamily.externalCode) {

									 case '1': 
										 	utensil = [
											 	{
													"REFERENCIA_COOKD": cookingStep.utensil.referenceNumber,
													"NOMBRE_UTENSILIO": utensilName
												}
											]	
											logger.info('Utensil %j', utensil)									 	
									 break;

									 case '2':
									 		resource = [
										 		{
													"REFERENCIA_COOKD": cookingStep.utensil.referenceNumber,
													"NOMBRE_RECURSO": utensilName
												}
											]
											logger.info('Resource %j', resource)									 	
									 break;

									 case '3':
									 		tableware = [
										 		{
													"REFERENCIA_COOKD": cookingStep.utensil.referenceNumber,
													"NOMBRE_RECURSO": utensilName
												}
											]
											logger.info('tableware %j', tableware)									 	
									 break;

									 }
								}

								cookingStepObj = {
									"ORDEN": (index+1).toString(),
									"DESCRIPCION": cookingStep.lang[0].description,
									"PUNTO_CONTROL": checkpoint,
									"UTENSILIO": utensil,
									"TIEMPO": cookingStep.time || 0,
									"RECURSO": resource,									
									"OBRADOR":'',
									"TIEMPO_OBRADOR": 0
								}
								cookingStepsTable.push(cookingStepObj)
							})

						} else {
							cookingStepsTable = [];
						}

  					/* ----------------  Generate subproduct object -----------------*/
					  subproductObj = {
							"CENTRO" : locationHotelSofia.referenceNumber.substring(0, 4),
							"NOMBRE_SEMIELABORADO": name.substring(0, 40).toUpperCase(),
							"REFERENCIA": subproduct.referenceNumber,
							"TIPO_MATERIAL": "ZSEM",
							"ESTADO": "",
							"UNIDAD_MEDIDA": measuringUnitCode.toUpperCase(),
							"IMAGEN": image,
							"COSTE_UNIDAD": cost.toFixed(2),
							"FAMILIA": family,
							"SUBFAMILIA": subfamily,
							"NUMBERO_RACIONES": numServings,  //INT 10 (0 decimals)
							"PESO_UNIDAD": optimumWeight.toFixed(2),
							"COCINA": '',
							"SALA_TRABAJO": '',
							"CADUCIDAD_FRESCO": caducityFresh,   //INT 10
							"CADUCIDAD_CONGELACION": caducityFreeze, //INT 10
							"DIAS_USO": daysToUse, //INT 10
							"COMPOSICION": compositionTable,
							"ELABORACION": cookingStepsTable,
							"UMA": [],
							"PPVV": [],
						}
						subproducts.DATA.push(subproductObj)
						//logger.info('SubproductsObj : %j', subproductObj)

					})
					
					logger.info('Generated array on subproduct objects to export with %s elements.', subproducts.DATA.length);
					cb(null,doc)

		}, (doc,cb) => { //Send data in chunks of 250 objects

					let page = 0;
					let perPage = 250;

					async.during(
					    (callback) => { //asynchronous truth test to perform before each execution of fn. Invoked with (callback).
					        return callback(null, page * perPage < subproducts.DATA.length);
					    },
					    (callback) => { //An async function which is called each time test passes. Invoked with (callback).
					        let dataPage = { "DATA": [] }
					        dataPage.DATA = subproducts.DATA.slice(page * perPage, (page + 1) * perPage); //end position is not included in slice. Slice extracts up to but not including end.
					        page++;

									if(dataPage.DATA.length) {

										request.post({url: config.selenta.wsSubproductUrl, json: true, body: dataPage}, (err, res, body) => {
											
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

									} else { //No subproducts to send
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

				if(subproducts.DATA.length) {

						let date = new Date();
						
						let logEntry = {
							type : 'subproduct',
							elementsToExport: subproducts.DATA.length,
							date: date.toISOString(),
							success: transactionOk
						}

						var log = new SelentaLog(logEntry);

						log.save((err, doc) => {
							if(err) return cb(err)
		 					logger.info('Saved log entry in SelentaLog collection. %j', logEntry);

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
				 logger.info('cron process completed successfully.');
			}

		})

})