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
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.dataExport;


 //Gets list of gastro offers
 exports.export = (params, userProfile, callback) => {

  var gastroOfferId = new ObjectId(params._id); 
  var filterLocation;
  var filterId;
  var filterIdPipeline;
  var filterTypePipeline;
  var filterLocationPipeline;
  var gastroOffers = [];
  var Model;
  var gastroCostHelper = require('./gastroCost');

	waterfall([

 		(cb) => { 

			if (params.filterId) {
          filterId = JSON.parse(params.filterId).map(function(doc) { return new ObjectId(doc); });
      } else {
          filterId = [];
      }

      filterIdPipeline = {}
			if (filterId.length > 0) {
          filterIdPipeline = {'_id': {$in: filterId}}
      }

			if (params.filterLocation) {
          filterLocation = JSON.parse(params.filterLocation).map(function(doc) { return new ObjectId(doc); });
      } else {
          filterLocation = [];
      }

      //If an array of filter locations if provided, build the filter location pipeline
      filterLocationPipeline = {};
      if (filterLocation.length > 0) {
          filterLocationPipeline = {'location': {$in: filterLocation}}
      }

      filterTypePipeline = {}  
      if(params.exportType) filterTypePipeline = { type: params.exportType } //'simpleMenu','dailyMenuCarte', 'buffet', 'carte', 'fixedPriceCarte', 'catalog'

      // console.log(filterLocationPipeline, 'filterLocationPipeline')
      // console.log(filterIdPipeline, 'filterIdPipeline')
      // console.log(filterTypePipeline, 'filterTypePipeline')
      // console.log(params.filterText, 'params.filterText')

			GastroOffer.aggregate([				
	 			{$match: {'active' : true}},
				{
	 				$unwind: {
	 					path: "$versions",
	 					preserveNullAndEmptyArrays: true
	 				}
	 			},
	 			{
	 				$unwind: {
	 					path: "$versions.lang",
	 					preserveNullAndEmptyArrays: true
	 				}
	 			},
	 			{$match: filterIdPipeline},
	 			{$match: filterTypePipeline},
	 			{$match: filterLocationPipeline},
	 			{$match: {'versions.active' : true}},
 				{$match: {'versions.lang.langCode': userProfile.user.language}},
 				{$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}}
    	], (err, docs) => {
    			if(err) return cb(err)
 		 			cb(null, docs)
    	})

 		}, (docs, cb) => {

 				//console.log(docs, 'gastro offers')
 				logger.info('Filtering gastro offers...Total count: %s', docs.length)

				GastroOffer.populate(docs, {path: "versions.type versions.season"}, (err, docs) => {
          if (err) return cb(err)
          cb(null, docs)
        });

 		}, (docs, cb) => {

			logger.info('Refreshing dish, drink or product names in composition list')

			async.eachSeries(docs, (doc, cb_async1) => {

	        //Filter dish or product or drink lang field of composition based on user language
	        async.eachSeries(doc.versions.composition, function(compElement, cb_async2) {

	          if(compElement.element.kind == 'dish') { Model=Dish }
	          else if (compElement.element.kind == 'product'){ Model = Product }
	            else if (compElement.element.kind == 'drink'){ Model = Drink}
	            
	          Model.populate(compElement, { path: "element.item" }, (err, compElement) => {
	            if (err) return cb(err)

	            if(compElement.element.item&&compElement.element.item.versions) {

		            //Filter active version
		            let activeVersion = compElement.element.item.versions.filter((version) => {
		              return version.active==true;
		            })

		            //Filter user language
		            let userLang=[];

		            userLang = activeVersion[0].lang.filter((langItem) => {
		              return langItem.langCode=userProfile.user.language;
		            })

		            if(userLang.length) compElement.name = userLang[0].name;

		            //Update composition element unitCost with average location cost based on filterLocation
		            gastroCostHelper.calculateGastroElementAvgLocCostAndAllergens(compElement, doc.location);
		          }

		          //reset element.item to an Object Id for consitency when refreshNames is false
		          if(compElement.element.item) compElement.element.item = compElement.element.item._id

	            cb_async2();
	          });

	        }, (err) => { //finished async2 loop
	        	if(err) return cb_async1(err)
	          cb_async1()
	        });

				}, (err) => { //finished async1 loop
						if(err) return cb(err)
	          cb(null, docs);
	        });	


		},(docs, cb) => { //Update average location cost based on filterLocation

        gastroCostHelper.calculateAvgGastroLocCost(docs);
        cb(null, docs)		      

 		}, (docs, cb) => {  //Populate families and subfamilies in composition list

 				logger.info('Populating families and subfamilies in gastro composition list.')
        Family.aggregate([
            {$unwind: "$lang"},
            {
                $unwind: {
                    path: "$subfamilies",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: {
                    path: "$subfamilies.lang",
                    preserveNullAndEmptyArrays: true
                }
            },
            {$match: {$or: [{'subfamilies.lang.langCode': userProfile.user.language}, {'subfamilies.lang.langCode': null}]}},
            {$match: {'lang.langCode': userProfile.user.language}},
            {$match: {'category': 'gastroOffering'}},
            {
                $group: {
                    "_id": "$_id",
                    "lang": {$first: "$lang"},
                    "category": {$first: "$category"},
                    "subfamilies": {$push: '$subfamilies'},
                }
            },
        ], (err, families) => {

					if(err) return cb(err)

					docs.forEach((doc) => {

						doc.versions.composition.forEach((compElement) => { 

							families.forEach((fam, index) => {
								let famId = new ObjectId(fam._id)
								let elementFamId = compElement.family
								if (famId.equals(elementFamId)){
									compElement.family = fam;
									families[index].subfamilies.forEach((subfam)=> {
										let subfamId = new ObjectId(subfam._id)
										let elementSubFamId = null;
										if(mongoose.Types.ObjectId.isValid(compElement.subfamily))
											elementSubFamId = new ObjectId(compElement.subfamily)
										if (subfamId.equals(elementSubFamId)) compElement.subfamily=subfam;
									})
								} 
							})
						})
					})

					cb(null, docs)
				})	      

 		}, (docs, cb) => { //Calculate total Cost

 				logger.info('Calculating total cost of gastro offers.')

 				docs.forEach((doc) => {

 					doc.versions.totalCost = 0;

 					doc.versions.composition.forEach((compElement) => {
 							doc.versions.totalCost+=compElement.totalCost;
 					})

 				})

 				cb(null, docs)

 		}, (docs, cb) => { //Create csv

 				logger.info('Starting gastro csv creation...')

 				docs.forEach((doc) => {
 					
 					let refId = doc._id.toString();
 					let gastroOfferLine = {
 						name: doc.versions.lang? doc.versions.lang.name : '---' ,
 						ref: 'go-' + refId.slice(-8), //get las 5 digits of _id
 						active: doc.active,
 						type: doc.type.toString(),
 						family: doc.versions.type? doc.versions.type.lang[0].name : '---' ,
 						season: doc.versions.season? doc.versions.season.lang[0].name : '---' ,
 						price: doc.versions.price || '--' ,
 						maxCostOverPrice: doc.versions.maxCostOverPrice || '--',
 						totalCost: doc.versions.totalCost || '--',
	 					compElementRef: '--', 	 						
 						compElementName:  '--',
 						compElementType: '--',
 						compElementPrice: '--',
 						compElementFamily: '--',
 						compElementSubfamily: '--',
						compElementNumServings: '--',
 						compElementCost: '--',
 						compElementTotalCost: '--' 					
 					}

 					gastroOffers.push(gastroOfferLine)

 					doc.versions.composition.forEach((compElement) => {

 						let compElementRef = '';
 						let compElementId;

 						if(compElement.element.item) {
  		        compElementId = compElement.element.item.toString();

 							switch(compElement.element.kind) {
							    case 'dish':
							        compElementRef = 'ds-' + compElementId.slice(-8)
							        break;
							    case 'product':
							        compElementRef = 'pt-' + compElementId.slice(-8)
							        break;
							    case 'drink':
							        compElementRef = 'dk-' + compElementId.slice(-8)
							        break;							        
							    default:							        
							}
 						}

 						let compElementSubfamily='';
 						if (compElement.subfamily && compElement.subfamily.lang.name) 
 							compElementSubfamily=compElement.subfamily.lang.name

 						let gastroOfferLine = {
							name: '--',
	 						ref: '--', 
	 						active: '--',
	 						type: '--',
	 						family: '--',
	 						season: '--',
	 						price: '--' ,
	 						maxCostOverPrice: '--',
	 						totalCost: '--',
	 						compElementRef: compElementRef, 	 						
	 						compElementName:  compElement.name,
 							compElementType: compElement.element.kind,
	 						compElementPrice: compElement.price * compElement.numServings * (1+config.salesTax/100),
	 						compElementPriceBeforeTax: compElement.price * compElement.numServings,
 							compElementFamily: compElement.family.lang.name || '',
	 						compElementSubfamily: compElementSubfamily,
 							compElementNumServings: compElement.numServings,
 							compElementCost: compElement.cost,
 							compElementTotalCost: compElement.cost*compElement.numServings

 						}

	 					gastroOffers.push(gastroOfferLine)

	 				})

	 			})

	 			cb(null, docs)

		}, (docs, cb) => { //convert to CSV
			var fields = ['name','ref','active', 'type', 'family', 
			'season', 'price', 'maxCostOverPrice', 'totalCost', 'compElementRef', 'compElementName', 'compElementType', 'compElementPrice', 'compElementPriceBeforeTax',
			'compElementFamily', 'compElementSubfamily', 'compElementNumServings', 'compElementCost', 'compElementTotalCost'];
			var fieldNames = ['Nombre', 'Referencia', 'Activo', 'Tipo de oferta', 'Família', 
			'Temporada', 'Precio', 'Coste Sobre Consumo', 'Coste Total', 'Referencia Elemento Comp','Elemento Composición', 'Tipo', 'Precio', 'Base Imponible',
			'Familia' , 'Subfamília', 'Nombre Raciones', 'Coste', 'Coste Total'];

			json2csv({ data: gastroOffers, fields: fields, fieldNames: fieldNames}, function(err, csv) {
			  if (err) return cb(err);
			  fs.writeFile('/tmp/gastro_export.csv', csv, function(err) {
				  if (err) return cb(err);
				  logger.info('Created csv file: /tmp/gastro_export.csv')
				  cb(null, docs)
				});			  
			});


 		}],(err, docs) => {
        if (err) return callback(err)
		    callback(null, docs)
 		})

}


 exports.extractRecipes = (gastroOffers, callback) => { //Used to get/extract list of recipes from array of gastro offers

 	  let recipesList = {
 	  	dishList: [],
 	  	productList: [],
 	  	drinkList: []
 	  }

		gastroOffers.forEach((gastroOffer) => {

			gastroOffer.versions.composition.forEach((compElement) => {

					switch (compElement.element.kind) {
						case 'dish':
							let dishObj = {
								_id: compElement.element.item,
								type: 'dish'
							}
							recipesList.dishList.push(dishObj)
							break;
						case 'product':
							let productObj = {
								_id: compElement.element.item,
								type: 'product'
							}
							recipesList.productList.push(productObj)
							break;
						case 'drink':
							let drinkObj = {
								_id: compElement.element.item,
								type: 'drink'
							}
							recipesList.drinkList.push(drinkObj)
							break;
					}					
			})

		})

		recipesList.dishList = removeDuplicates(recipesList.dishList);
		recipesList.productList = removeDuplicates(recipesList.productList);
		recipesList.drinkList = removeDuplicates(recipesList.drinkList);

	  logger.info('Extracted list of dishes, products and drinks from gastro offers. Total count: %s', recipesList.dishList.length + 
	  	recipesList.productList.length + recipesList.drinkList.length)

	  callback(recipesList)

 }


	var removeDuplicates = (arr) => {
	  //console.log(arr,'arr')
	  // console.log(arr.length,'arr2')
	  var i,j,cur,found;
	  for(i=arr.length-1;i>=0;i--){
	    cur = new ObjectId(arr[i].item);
	    found=false;
	    for(j=i-1; !found&&j>=0; j--){
	      let id= new ObjectId(arr[j].item);
	      if(cur.equals(id)){
	        if(i!=j){
	          arr.splice(i,1);
	        }
	        found=true;
	      }
	    }
	  }
	  return arr;
	}