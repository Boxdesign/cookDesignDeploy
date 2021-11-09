//var exportGastro = require('../controllers/export')
var cron = require('node-cron')
//let schedule = process.env.NODE_ENV == 'production' ? '30 23 * * 1-4' : '0 4 * * *' //Prod at 23:30 UTC / 01:30 CET, dev every 5 min
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.selentaUtensilWebService;
var schedule;
//production cron: every hour
//development cron: every minute

switch(process.env.NODE_ENV) {
	case 'production':
			schedule = '0 23 * * 1-4'  //Prod at 23:00 UTC / 01:00 CET
	break;

	case 'staging':
			schedule = '0 23 * 12 1-4'
	break;

	default:
		schedule = '0 4 * * *'
	break
}

exports.utensilTask = cron.schedule(schedule, () => {

 	let lastExportDate;
 	let utensilsToExport;
 	var async = require('async');
 	var request = require('request');
	var WebServiceLog = require('../models/selentaLog')
  var Utensil = require('../models/utensil')
	var {ObjectId} = require('mongodb');
	var config = require('../config/config');
	var utensils = { "DATA": [] }
	var transactionOk = false;

	logger.debug('Utensil Web Service - Starting job...');

	async.waterfall([

		(cb) => { // find in selentaLog success exports and then filtered by last date

			WebServiceLog.find(
				{ 
					$and : [
						{"success":true},
						{"type":"utensil"}
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
						logger.debug('Found last successful web service log for the utensil web service! %s', lastExportDate);
			 		
			 		} else {

			 			lastExportDate = new Date(2017, 10, 01);
						logger.debug('Could not find a successful log or simply any log. Using date %s', lastExportDate);

			 		}
			 		cb(null,true)
				})

		},(doc,cb) => { //Find ingredients that have been udpated since the last successful data transfer. Filter locationCost by Hotel Sofia location.

			Utensil.find({
				"updatedAt" : {$gte: lastExportDate},
				"externalLink": true,
				"externalFamily": {$ne : null},
				"externalSubfamily": {$ne : null}
				},{
 					lang: {$elemMatch: {langCode: 'es'}},
          referenceNumber:1,
					family:1,
					subfamily: 1,
					externalFamily: 1,
					externalSubfamily: 1,          
 					last_account: 1,
          updatedAt: 1
 				})
 					.populate("externalFamily")
 					.exec((err,docs)=>{
 						if(err) return cb(err)
 						utensilsToExport = docs;
						logger.info('There are %s utensils to be exported.', docs.length);
 						cb(null,docs)
 					})

		},(docs,cb) => { //Populate external subfamily

				docs.forEach((doc) => { 

						let externalSubfamilyId = new ObjectId(doc.externalSubfamily)

						doc.externalFamily.subfamilies.forEach((subfamily) => {
							let subfamilyId = new ObjectId(subfamily._id)
							if(subfamilyId.equals(externalSubfamilyId)) {
								logger.info('Subfamily match! %j', subfamily)
								doc.extSubfamily = subfamily;
							}
						})
				})

				cb(null, docs)
						

		},(docs,cb) => { //Filter utensils that have been tagged with an external family that has an external code starting with the word "Selenta" (case insensitive)

				docs.forEach((doc) => {
					return doc.externalFamily.extenalCode && doc.externalFamily.extenalCode.match(/^Selenta/i)
				})

				logger.info('Filtered utensils with external family that have an external code starting with word Selenta.');
				logger.info('There are now %s utensils to be exported.', docs.length);

				cb(null, docs)

		},(docs,cb) => {

				 let utensilObject;
				 let name;
				 let type;

				 docs.forEach((doc) => {

				 	//logger.info('Utensil: %j', doc)

					 if(doc.lang && doc.lang[0].name) name = doc.lang[0].name; else name = "N/A";
					 if(doc.extSubfamily && doc.extSubfamily.externalCode && doc.extSubfamily.externalCode > 0 && doc.extSubfamily.externalCode < 4 ) type = doc.extSubfamily.externalCode; else type="1";

						utensilObject = {
							"CENTRO" : "D600",
							"NOMBRE_RECURSO": name.toUpperCase(),
							"REFERENCIA": doc.referenceNumber.substring(0, 21),
							"TIPO_RECURSO": type
						}

						utensils.DATA.push(utensilObject)
						logger.info('%j', utensilObject)

				 })

				 cb(null, true)

		}, (doc,cb) => {

				if(utensils.DATA.length) {

					request.post({url: config.selenta.wsUtensilUrl, json: true, body: utensils}, (err, res, body) => {
						
						if(err) return cb(err)

	  				if(body && body.RESPONSE) {

							logger.info('Selenta web service response: %j', body);

							if (body.RESPONSE.MSGTYPE == "E") {
								
									logger.error('Error sending data to Selenta %s', body.RESPONSE.BAPIMSG || '');
									transactionOk = false;

							} else {
		  					logger.info('Data sent correctly to Selenta.');
								transactionOk = true;								
							}
							cb(null, doc)
					  
					  } else {
					  	let err= new Error("Invalid web service response.")
					  	return cb(err)
					  }

					});

				} else { //No utensils to send
					transactionOk=true;
					cb(null, doc)
				}

		},(doc,cb) => { //Generate log

				let date = new Date();

				let logEntry = {
					type : 'utensil',
					elementsToExport: utensils.DATA.length,
					date: date.toISOString(),
					success: transactionOk
				}

				var log = new WebServiceLog(logEntry);

				log.save((err, doc) => {
					if(err) return cb(err)
 					logger.info('Saved log entry in WebServiceLog collection.');

					cb(null, doc)
				})
		
		}],(err,doc) => {
			
			if(err) { 
				 logger.error('Error during cron process: %s', err.message);
			} else {
				 logger.info('cron process completed successfully.');
			}

		})

})