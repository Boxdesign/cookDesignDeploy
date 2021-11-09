'use strict';

exports.updateTemplates = () => {

	var Template = require('../models/template');
	var Ingredient = require('../models/ingredient');
	var i18n = require('i18n');
	var waterfall = require('async-waterfall');
	var locHelper = require('../helpers/locations');
	var mongoose = require('../node_modules/mongoose');
	var fs = require('fs');
	var path = require('path');
	var async = require('async');
	var {ObjectId} = require('mongodb');
	var enums = require('../config/dbEnums');
	var htmlclean = require('htmlclean');
	var templateObjects
	var template
	var templates
	var newTemplate
	var newTemplates = []

	async-waterfall([

		(cb)=>{

			templateObjects = enums.templateCodes

			Template.find((err,doc)=>{
				if(err) return cb(err)
				if(doc) templates = doc
				else templates = []
					////console.log(templates.length,'templates')
					cb(null,doc)
			})

		},(doc,cb)=>{

					async.eachSeries(templateObjects, (template, cb_async) => {

						//Check whether template exists in the database
						let templateFile = templates.find((temp)=>{ return template.templateCode == temp.templateCode })

						//Template does not exist in the database. Create it.
						if(!templateFile) {

							//console.log('Template ',  template.lang[0].name, ' does not exist in database')
							newTemplate = new Template();
							newTemplate.category = template.category;
							newTemplate.subCategory = template.subCategory;
							newTemplate.lang  =  template.lang;
							newTemplate.templateCode = template.templateCode;
							newTemplate.template = ''

							let templatePath = path.join(__dirname, '../templates/' + template.htmlFile)
							//console.log(templatePath,'templatePath to add')
							readingHtmlFile(templatePath, (err, html) => {
								////console.log(html,'html')
									if(err) return cb_async(err)
									if(html) {
										html = htmlclean(html);
										//console.log('Cleaned html')
										newTemplate.template = html.toString()
										newTemplate.save((err,doc)=>{
											if(err) {
												//console.log('Error saving template!')
												//console.log(err)
												return cb_async(err)
											}
											console.log('Template %s added correctly', doc.lang[0].name)
											cb_async();
										})

									} else {
										console.error('Problem reading template file: %s', template.htmlFile)
										cb_async();
									}

							})

						} else {
							// if templaleFile exist we need to update this template

							//console.log('Template ', template.lang[0].name, ' exists in database. Update it.')

							let templatePath = path.join(__dirname, '../templates/' + template.htmlFile)
							
							readingHtmlFile(templatePath, (err, html) => {
								////console.log('read html')
								if(err) return cb_async(err)
								if(html) {
									html = htmlclean(html);
									template.template = html.toString()

									Template.update({"templateCode": template.templateCode},template,(err,doc)=>{
			        			  if(err) return cb_async(err)
											console.log('Template %s updated correctly', template.lang[0].name)
			          			return cb_async();
				         	})

								} else {
									//console.log('no html')
									cb_async();
								}
							})

						}

					},(err)=>{
						cb(null,true)
					})

		}],(err,ok)=>{
			////console.log('return',err)
			if(err) return err
				return true
	})

}

function readingHtmlFile(templatePath, cb){

	var fs = require('fs');
	var path = require('path');

	fs.readFile(templatePath, {encoding: 'utf-8'}, (err, html) => {
		////console.log(html,'html')
		if (err) {
			//console.log('Error reading html file')
			return cb(err)
		}
		//console.log('Html file read correctly')
    cb(null,html)
	});

}