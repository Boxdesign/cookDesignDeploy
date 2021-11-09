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
 var cookStepsHelper = require('../helpers/cookingSteps')
 var allergenHelper = require('../helpers/allergen')
 var articleExportHelper = require('../helpers/exportArticle')
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.dataExport;
 var costHelper = require('../helpers/cost');

 exports.export = (params, userProfile, callback) => {

  var recipeId = new ObjectId(params._id); 
  var filterLocation;
  var filterId;
  var filterIdPipeline;
  var filterTypePipeline;
  var filterLocationPipeline;
  var gastroOffers = [];
  var Model;

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

      if(params.exportType) {
      	switch(params.exportType) {
					case 'subproduct':
						Model = Subproduct;
						break;

					case 'product':
						Model = Product;
						break;

					case 'dish':
						Model = Dish;
						break;      	

					case 'drink':
						Model = Drink;
						break;
				}
      } else {
      	var err = new Error('Recipe type must be provided.')
        err.statusCode = 400;
      	return cb(err)
      }

      // console.log(filterLocationPipeline, 'filterLocationPipeline')
      // console.log(filterIdPipeline, 'filterIdPipeline')
      // console.log(filterTypePipeline, 'filterTypePipeline')
      // console.log(params.filterText, 'params.filterText')

			Model.aggregate([
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
	 			{$match: filterLocationPipeline},
	 			{$match: {'versions.active' : true}},
 				{$match: {'versions.lang.langCode': userProfile.user.language}},
 				{$match: {'versions.lang.name': {$regex: params.filterText, $options: 'i'}}}
    	], (err, docs) => {
	      	logger.info('Get list of recipes. Type: %s, total count: %s', params.exportType, docs.length)
	      	
	      	//Flag docs
	      	docs.map((doc) => {
	      		doc.type=params.exportType
	      	})

	        Model.populate(docs, {path: "measurementUnit versions.gallery"}, (err, docs) => {
	            if (err) return cb(err)
	            cb(null, docs)
	        });
    	})

 		}, (docs, cb) => {
		 	  
 				//docs is an array of objects that contains one of the recipe types (drinks, products, subproducts, dishes)
 				exportRecipes(docs, params, userProfile, false, (err) => {
 					if(err) return cb(err)
 					cb(null, docs)
 				})

 	  }, (docs, cb) => {

		 	  let recipesList={}

				switch(params.exportType) {
					case 'subproduct':
						recipesList.subproductList=docs
						break;

					case 'product':
						recipesList.productList=docs
						break;

					case 'dish':
						recipesList.dishList=docs
						break;      	

					case 'drink':
						recipesList.drinkList=docs
						break;
				}

				cb (null, recipesList)

 		}],(err, docs) => {
        if (err) return callback(err)
		    callback(null, docs)
 		})

 }


 //Generates csv file from a list of recipes. Method called from export Gastro.
 exports.exportFromList = (recipeList, userProfile, params, callback) => {

 	//Recipes list is a JSON object with a dishList, drinkList and productList key. 

  var filterLocation;
  var filterIdPipeline;
  var filterTypePipeline;
  var filterLocationPipeline;
  var recipes = [];

	waterfall([

 		(cb) => {

 			//console.log(recipeList.dishList,'dishList1')
 			//Get dish id list from Recipes List
 			let dishList = recipeList.dishList.map((dish) => {
 				return dish._id;
 			})

     	logger.info('Compiled array of dish ObjectIds. Total count: %s', dishList.length)


 			Dish.aggregate([   //Get dishes
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
	 			{$match: {'_id': {$in: dishList}}},
	 			{$match: {'versions.active' : true}},
	 			{$match: {'versions.lang.langCode': userProfile.user.language}}
      
      ], (err, docs) => {

      	logger.info('Found dishes from list of ObjectIds. Total count: %s', docs.length)

      	//Flag docs as dish
      	docs.map((doc) => {
      		doc.type='dish'
      	})

       	if (err) return cb(err) 
        Dish.populate(docs, {path: "measurementUnit versions.gallery"}, (err, docs) => {
            if (err) return cb(err)
      		  recipes = recipes.concat(docs)
            cb(null, docs)
        });
      })

 		}, (docs, cb) => {

 			//Get product id list from Recipes List
 			let productList = recipeList.productList.map((product) => {
 				return product._id;
 			})

     	logger.info('Compiled array of product ObjectIds. Total count: %s', productList.length)

 			Product.aggregate([ //Get products
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
	 			{$match: {'_id': {$in: productList}}},
	 			{$match: {'versions.active' : true}},
	 			{$match: {'versions.lang.langCode': userProfile.user.language}}
      
      ], (err, docs) => {

      	logger.info('Found products from list of ObjectIds. Total count: %s', docs.length)
      	
      	//Flag docs as product
      	docs.map((doc) => {
      		doc.type='product'
      	})

       	if (err) return cb(err) 
        Product.populate(docs, {path: "measurementUnit versions.gallery"}, (err, docs) => {
            if (err) return cb(err)
      		  recipes = recipes.concat(docs)
            cb(null, docs)
        });
      })

 		}, (docs, cb) => {

 			//Get drink id list from Recipes List
 			let drinkList = recipeList.drinkList.map((drink) => {
 				return drink._id;
 			})

    	logger.info('Compiled array of drink ObjectIds. Total count: %s', drinkList.length)

 			Drink.aggregate([ //Get drinks
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
	 			{$match: {'_id': {$in: drinkList}}},
	 			{$match: {'versions.active' : true}},
	 			{$match: {'versions.lang.langCode': userProfile.user.language}}
      
      ], (err, docs) => {

      	logger.info('Found drinks from list of ObjectIds. Total count: %s', docs.length)

      	//Flag docs as drink
      	docs.map((doc) => {
      		doc.type='drink'
      	})

       	if (err) return cb(err) 
        Drink.populate(docs, {path: "measurementUnit versions.gallery"}, (err, docs) => {
            if (err) return cb(err)
      		  recipes = recipes.concat(docs)
            cb(null, docs)
        });
      }) 

 		}, (docs, cb) => {

 				//recipes is an array of objects that contains all the recipes (drinks, products and dishes)
 				exportRecipes(recipes, params, userProfile, false, (err) => {
 					if(err) return cb(err)
 					cb(null, docs)
 				})

 		}],(err, docs) => {
        if (err) return callback(err)
		    callback(null, docs)
 		})

}


 //Generates csv file from list of subproducts.
 exports.exportSubproductsFromList = (subproductsList, userProfile, params, callback) => {

	waterfall([

 		(cb) => {

 			Subproduct.aggregate([   //Get subproducts
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
	 			{$match: {'_id': {$in: subproductsList}}},
	 			{$match: {'versions.active' : true}},
	 			{$match: {'versions.lang.langCode': userProfile.user.language}}
      
      ], (err, docs) => {

      	logger.info('Get subproducts from list of ObjectIds. Total count: %s', docs.length)

      	//Flag docs as subproduct
      	docs.map((doc) => {
      		doc.type='subproduct'
      	})

       	if (err) return cb(err) 
        Subproduct.populate(docs, {path: "measurementUnit versions.gallery"}, (err, docs) => {
            if (err) return cb(err)
            cb(null, docs)
        });
      })

 		}, (docs, cb) => {

 				exportRecipes(docs, params, userProfile, true, (err) => {
 					if(err) return cb(err)
 					cb(null, docs)
 				})

 		}],(err, docs) => {
        if (err) return callback(err)
		    callback(null, docs)
 		})

}

var exportRecipes = (docs, params, userProfile, subproductExport, callback) => {

	//docs is an array of recipes objects
	//ToDo: if it's a product, include product packaging.

  var recipes = [];
  var allergens;
  var allergenTextList = '';
  var conversionTable;

	logger.info('Entering exportRecipes method...')


	waterfall([

		(cb) => {  //populate cooking steps for each recipe

 			async.eachSeries(docs, function(doc, cb_async) {

 				doc.cookSteps=[];

 				let Model;

 				switch (doc.type) {
 					case 'drink':
 						Model=Drink;
 						break;

 					case 'dish':
 						Model=Dish;
 						break;

 					case 'product':
 						Model=Product;
 						break;
					
					case 'subproduct':
 						Model=Product;
 						break; 						
 				}
 				
 				cookStepsHelper.getCookSteps(doc._id, doc.versions._id, Model, userProfile , (err, cookSteps) => {
	 					doc.cookSteps = cookSteps; //store cook steps in doc
	 					cb_async();
 				})

 			}, function(err) { //Finished async loop
 					
 					logger.info('Populate cook steps in list of recipes.')
 					cb(null, docs)

 			})

 		}, (docs, cb) => { //If recipe is a product, get packagings

 			async.eachSeries(docs, function(doc, cb_async) {

 				doc.packagings=[];

 				if(doc.type == 'product') {

	 				articleExportHelper.getProductPackagings(doc.versions.packaging, userProfile , (err, packagings) => {

		 					doc.packagings = packagings; //store packagings in doc
		 					cb_async();
	 				})

	 			} else {
	 				cb_async();
	 			}

 			}, function(err) { //Finished async loop
 					
 					logger.info('Populate packagings in products.')
 					cb(null, docs)
 			})

 		}, (docs, cb) => { //Get list of allergens in user language

				allergenHelper.getAllergens(userProfile, (err, aller) => {
					if(err) cb(err)
					allergens = aller;
					cb(null, docs)
				})

    }, (docs, cb) => { //Get conversion table

					costHelper.getConversionTable((err, table) => {
						conversionTable = table;
						cb(null, docs);
					})				

 		}, (docs, cb) => { 

        docs.forEach((doc) => { 

        	//populate recipes allergens
					doc.versions.allergens.forEach((recipeAllergen) => { 

            let subAllerId = new ObjectId(recipeAllergen.allergen);

            allergens.forEach((allergen) => {                
              let allergenId = new ObjectId(allergen._id)

              if(subAllerId.equals(allergenId)) {
                recipeAllergen.allergen=allergen;
              }
            })
          })  

   	      allergenTextList = '';

          //Generate allergen text for csv
					doc.versions.allergens.forEach((recipeAllergen) => {
          	allergenTextList = allergenTextList.concat(recipeAllergen.allergen.lang[0].name)

          	switch (recipeAllergen.level) {
          		case 0:
          			allergenTextList = allergenTextList + '(No contiene), '
          			break;

          		case 1:
          			allergenTextList = allergenTextList + '(Contiene trazas), '
          			break;

          		case 2:
          			allergenTextList = allergenTextList + '(Contiene), '
          			break;
          	}

          }) 

          doc.allergenTextList = allergenTextList;
						        	
        })

        logger.info('Populate allergens in list of recipes.')
        cb(null, docs)

 		}, (docs, cb) => {

					async.eachSeries(docs, function(doc, cb_async1) {

		        //Filter ingredient or subproduct lang field based on user language
		        async.each(doc.versions.composition, function(compElement, cb_async2) {

		          if(compElement.element.kind == 'subproduct') { //composition element is a subproduct
		            
		            Subproduct.populate(compElement, { path: "element.item" }, (err, compElement) => {
		              if (err) return cb(err)

		              if(compElement.element.item != null) {

		                //Filter active version
		                let activeVersion = compElement.element.item.versions.filter((version) => {
		                  return version.active==true;
		                })

		                compElement.element.item.versions = activeVersion;

		                //Filter user language
		                let userLang=[];

	 		              if(compElement.element.item) {

			                userLang = compElement.element.item.versions[0].lang.filter((langItem) => {
			                  return langItem.langCode=userProfile.user.language;
			                })

			              }

		                if(userLang.length) {
		                  //The client assumes item is not populated. Must de-populate it.
		                  compElement.element.item = compElement.element.item._id;
		                  compElement.name = userLang[0].name;
		                }

		                //Update composition element unitCost with average location cost based on filterLocation
		                costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc.location, Subproduct);

		              }

		              cb_async2();
		            });

		          } else { //composition element is an ingredient

		            Ingredient.populate(compElement, { path: "element.item" }, (err, compElement) => {
		              if (err) return cb(err)

		              //Filter user language
		              let userLang=[];

		              if(compElement.element.item) {

		              	userLang = compElement.element.item.lang.filter((langItem) => {
		                	return langItem.langCode=userProfile.user.language;
		              	})

		              }

		              if(userLang.length) {
		                //The client assumes item is not populated. Must de-populate it.
		                compElement.element.item = compElement.element.item._id;
		                compElement.name = userLang[0].name;
		              }

	              	//Update composition element unitCost with average location cost based on filterLocation
	              	costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc.location, Ingredient);

		              cb_async2();
		            }); 
		          }       

		        }, (err) => { //finished async2 loop
		          cb_async1();
		        });

					}, (err) => { //finished async1 loop
		          cb(null, docs);
		      });	

		}, (docs, cb) => { //Recalculate composition costs based on updated composition element costs

				async.eachSeries(docs, function(doc, cb_async1) {

						//Calculate costs of all elements using conversion table
						doc.versions.composition.forEach((recipeElement) => {

			  			if(recipeElement.measuringUnit==null) { //measuring unit is an equivalence unit. Gross weight is already expressed in base unit.
		  					
		  					recipeElement.grossWeight = recipeElement.equivalenceUnit.quantity * recipeElement.quantity;
		  					recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;	
			  			
			  			} else {
			  			
			  				let measuringUnitId = new ObjectId(recipeElement.measuringUnit);
			  				let baseUnitId = new ObjectId(recipeElement.baseUnit);
				  			if(!measuringUnitId.equals(baseUnitId)) { //measuring unit is different than base unit, so we need conversion factor
				  				//Find conversion quantity in convertion table. Start by finding base unit...
				  				conversionTable.find((x) => { 
				  					if(x.baseUnit._id == recipeElement.baseUnit) {
					  					//Now find the conversion quantity in conversions object
					  					x.conversions.find((c) => {
					  						if(c.convUnit._id == recipeElement.measuringUnit) {
					  							let conversionQty = c.quantity;
					  							recipeElement.calculatedCost = recipeElement.grossWeight * conversionQty * recipeElement.unitCost;
					  						}  						
					  					})
					  				}
					  			})
				  			} else { //Measuring unit is equal to base unit, so there's no need for conversion
					  			//console.log('calculating calculatedCost: grossWeight= ' + recipeElement.grossWeight+ 'unit cost: '+recipeElement.unitCost)
					  			recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;
				  			}
				  		}

						})

						process.nextTick(()=> cb_async1())

			}, (err) => {
				if(err) return cb(err)
				cb(null, docs)
			})

 		}, (docs, cb) => {  //Populate families and subfamilies in composition list

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
            {$match: {'category': 'recipe'}},
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

						families.forEach((fam, index) => {
							let famId = new ObjectId(fam._id)
							let elementFamId = doc.family
							if (famId.equals(elementFamId)){
								doc.family = fam;
								families[index].subfamilies.forEach((subfam)=> {
									let subfamId = new ObjectId(subfam._id)
									let elementSubFamId = null;
									if(mongoose.Types.ObjectId.isValid(doc.subfamily))
										elementSubFamId = new ObjectId(doc.subfamily)
									if (subfamId.equals(elementSubFamId)) doc.subfamily=subfam;
								})
							} 
						})

					})

	      	logger.info('Populate families and subfamilies in recipes list.')
					cb(null, docs)
				})	

		}, (docs, cb) => { //Calculate composition totals
          
				docs.forEach((doc) => {

					let compTotal ={
            grossWeight:0,
            netWeight:0,
            cost:0
          };

	         doc.versions.composition.forEach((compElement,index) => {

	            compTotal.grossWeight+=compElement.grossWeight;
	            let netWeight = compElement.grossWeight*(1-(compElement.wastePercentage/100));
	            compElement.netWeight = netWeight;
	            compTotal.netWeight+=netWeight;
	            compTotal.cost+=compElement.calculatedCost;

	         }) 
	         doc.compTotal = compTotal;
        })
         
        logger.info('Calculate recipes composition totals.')
        cb(null,docs);

    }, (docs, cb) => {

 			async.eachSeries(docs, function(doc, cb_async) {

 				let Model;

 				switch (doc.type) {
 					case 'drink':
 						Model=Drink;
 						break;

 					case 'dish':
 						Model=Dish;
 						break;

 					case 'product':
 						Model=Product;
 						break;
					
					case 'subproduct':
 						Model=Product;
 						break; 						
 				}
 				
    		//Update recipes cost based on location
     		costHelper.calculateAvgRecipeLocCostAndAllergens(docs, Model);
     		process.nextTick(()=> cb_async() )
 			})  
 			cb(null, docs)      

		}, (docs, cb) => {

 				docs.forEach((doc) => { //add firt recipe line with general information

					let refId = doc._id.toString();

					let tag;
					let type;

					switch(doc.type) {
						case 'dish':
							tag = 'ds-';
							type = 'Plato';
							break;

						case 'product':
							tag = 'pt-';
							type = 'Producto'
							break;

						case 'drink':
							tag = 'dk-';
							type = 'Bebida';
							break;

						case 'subproduct':
							tag = 'sb-';
							type = 'Subproducto';
							break;
					}

					let family='' 
					if(doc.family) family = doc.family.lang.name;

					let subfamily=''
					if(doc.subfamily) subfamily = doc.subfamily.lang.name

				  let image = '';
					if(doc.versions.gallery) image = doc.versions.gallery.sizes[1].url;


					let recipeMainLine = {
						name: doc.versions.lang.name,
						ref: tag + refId.slice(-8), //get las 8 digits of _id
						active: doc.active,
						type: type,
						measurementUnit: doc.measurementUnit.lang[0].name,
						family: family,
						subfamily: subfamily,
						allergens: doc.allergenTextList,
						image: image,
						description: doc.versions.lang.description, 
						gastroComment: doc.versions.gastroComment,
						diet: doc.versions.diet,
						numServings: doc.versions.numServings,
						weightPerServing: doc.versions.weightPerServing,
						costPerServing: doc.versions.costPerServing,
						refPricePerServing: doc.versions.refPricePerServing,
						netWeight: doc.versions.netWeight,
						totalCost: doc.compTotal.cost,
						totalGrossWeight: doc.compTotal.grossWeight,
						totalNetWeight: doc.compTotal.netWeight
					}

					recipes.push(recipeMainLine)

 					doc.versions.composition.forEach((compElement) => { //add composition

 						let category;

 						switch (compElement.category) {
 							case 'mainProduct':
 								category = 'Producto principal'
 							  break;

 							case 'dressing':
 								category = 'Guarnición'
 							 	break;

 							case 'sauce':
 								category = 'Salsa'
 							 	break;

 						  case 'addition':
 						  	category: 'Complemento'
 						   	break;

 						}

 						let grossWeightPercentage = (compElement.grossWeight / doc.compTotal.grossWeight)*100;
 						let netWeightPercentage = (compElement.netWeight / doc.compTotal.netWeight) * 100;
 						let costPercentage = (compElement.calculatedCost / doc.compTotal.cost) * 100;
 						
 						let recipeCompLine = {
 							compElementCategory: category,
 							compElementName: compElement.name,
 							compElementGrossWeight: compElement.grossWeight,
 							compElementGrossWeightPercentage: grossWeightPercentage,
 							compElementMeasuringUnit: compElement.measuringUnitShortName,
 							compElementWastePercentage: compElement.wastePercentage,
 							compElementNetWeight: compElement.netWeight,
 							compElementNetWeightPercentage: netWeightPercentage,
 							compElementUnitCost: compElement.unitCost,
 							compElementCalculatedCost: compElement.calculatedCost,
 							compElementCostPercentage: costPercentage
 						}

						recipes.push(recipeCompLine)

 					})

 					doc.cookSteps.forEach((cookStep) => { //add cooking steps

 						let cookStepImages = '';

 						if (cookStep.images.length) {
 							cookStep.images.forEach((image, index) => { 
 								cookStepImages = image.sizes[1].url.concat(cookStepImages)
 								if(cookStep.images.length<index+1) cookStepImages = cookStepImages + ' / '
 							})
 						}

 						let cookStepVideos = '';

 						if (cookStep.videos.length) {
 							cookStep.videos.forEach((video, index) => { 
 								cookStepVideos = video.url.concat(cookStepVideos)
 								if(cookStep.videos.length<index+1) cookStepVideos = cookStepVideos + ' / '
 							})
 						}
 						let cookStepGastroCheckpoint 
 						
 						if (cookStep.gastroCheckpoint && cookStep.gastroCheckpoint.lang) cookStepGastroCheckpoint = cookStep.gastroCheckpoint.lang[0].name
 							else cookStepGastroCheckpoint = 'N/A'
						
						let cookStepCriticalCheckpoint 
 						
 						if (cookStep.criticalCheckpoint && cookStep.criticalCheckpoint.lang) cookStepCriticalCheckpoint = cookStep.criticalCheckpoint.lang[0].name
 							else cookStepCriticalCheckpoint = 'N/A'

						let recipeCookStepLine = {
							cookStepProcess: cookStep.process.lang[0].name,
							cookStepUtensil: cookStep.utensil.lang[0].name,
							cookStepDescription: cookStep.lang.description,
							cookStepTime: cookStep.time,
							cookStepTemperature: cookStep.temperature,
							cookStepTemperatureProbe: cookStep.temperatureProbe,
							cookStepVacuum: cookStep.vacuum,
							cookStepPressure: cookStep.pressure,
							cookStepPower: cookStep.power,
							cookStepCriticalCheckpoint: cookStepCriticalCheckpoint,
							cookStepCriticalCheckpointNote: cookStep.lang.criticalCheckpointNote,
							cookStepGastroCheckpoint: cookStepGastroCheckpoint,
							cookStepGastroCheckpointNote: cookStep.lang.gastroCheckpointNote,
							cookStepImages: cookStepImages,
							cookStepVideos: cookStepVideos
						}

						recipes.push(recipeCookStepLine)
 					})

 					doc.packagings.forEach((packaging) => { //add packagings

						let refId = packaging._id.toString();

 						let packagingLine = {
 							packagingName: packaging.lang[0].name,
							packagingRef: 'pk-' + refId.slice(-8) //get las 8 digits of _id
 						}

						recipes.push(packagingLine)
 				 	})

 				})

				logger.info('Compile recipes data for csv generator')

	 			cb(null, docs)

		}, (docs, cb) => { //convert to CSV

			var fields = ['name','ref','active', 'type', 'measurementUnit', 'family', 'subfamily', 'allergens', 'image', 'description', 'gastroComment', 
			'diet', 'numServings', 'weightPerServing', 'costPerServing', 'refPricePerServing', 'netWeight', 'totalCost', 'totalGrossWeight', 'totalNetWeight',
			'compElementCategory', 'compElementName', 'compElementGrossWeight', 'compElementGrossWeightPercentage', 'compElementMeasuringUnit', 'compElementWastePercentage', 'compElementNetWeight',
			'compElementNetWeightPercentage', 'compElementUnitCost', 'compElementCalculatedCost', 'compElementCostPercentage',
			'cookStepProcess', 'cookStepUtensil', 'cookStepDescription', 'cookStepTime', 'cookStepTemperature', 'cookStepTemperatureProbe',
			'cookStepVacuum', 'cookStepPressure', 'cookStepPower', 'cookStepCriticalCheckpoint', 'cookStepCriticalCheckpointNote', 'cookStepGastroCheckpoint',
			'cookStepGastroCheckpointNote', 'cookStepImages', 'cookStepVideos', 'packagingName', 'packagingRef'];

			var fieldNames = ['Nombre', 'Referencia', 'Activo', 'Tipo de elaboración', 'Unidad de medida', 'Família', 'Subfamília', 'Alérgenos', 'Imagen', 'Descripción', 'Comentario Gastronómico',
			'Dieta', 'Número raciones', 'Peso por ración', 'Coste por ración', 'Precio referencia', 'Peso neto', 'Coste Total', 'Peso bruto total', 'Peso neto total',
			'Composición: Tipo', 'Composición: Nombre', 'Composición: peso bruto', 'Composición: % peso bruto', 'Composición: unidad de medida', 'Composición: merma (%)', 'Composición: Peso neto',
			'Composición: % peso neto', 'Composición: Coste unitario', 'Composición: Coste total', 'Composición: % coste',
			'Elaboración: Proceso', 'Elaboración: Utensilio', 'Elaboración: Descripción', 
			'Elaboración: Tiempo (min)', 'Elaboración: Temperatura(C)', 'Elaboración: Temperatura Sonda (C)', 'Elaboración: Vacío (%)', 'Elaboración: Presión (mbar)', 'Elaboración: Potencia (W)',
			'Elaboración: Punto de control de calidad', 'Elaboración: Comentario (PCC)', 'Elaboración: Punto de control gastronómico', 
			'Elaboración: Comentario (PCG)', 'Elaboración: Imágenes', 'Elaboración: Vídeos', 'Envases: Nombre', 'Envases: Referencia'];

			let fileName = '/tmp/recipe_export.csv';
			if(subproductExport) fileName = '/tmp/subproduct_export.csv';

			json2csv({ data: recipes, fields: fields, fieldNames: fieldNames}, function(err, csv) {
			  if (err) cb(err);
			  fs.writeFile(fileName, csv, function(err) {
				  if (err) return cb(err);
				  logger.info('Create csv file: %s', fileName)
				  cb(null, docs)
				});			  
			});

		}], (err, docs) => {

			if(err) return callback(err)
			callback();
	})

}

exports.extractSubproducts = (recipesList, cb) => {

  let subproductsList = [];
  var Model;
  var recipes = [];

  //Flatten recipesList
  recipes = recipes.concat(recipesList.dishList);
  recipes = recipes.concat(recipesList.productList)
  recipes = recipes.concat(recipesList.drinkList)
  if(recipesList.subproductList) recipes = recipes.concat(recipesList.subproductList)

	async.eachSeries(recipes, (recipe, cb_async) => { 

		if(recipe) {

			let parent = [];

			switch (recipe.type) {
				case 'drink':
					Model=Drink
				break;

				case 'dish':
					Model=Dish
				break;

				case 'product':
					Model=Product
				break;

				case 'subproduct':
					Model=Subproduct
					parent = parent.concat(recipe._id)
				break;
			}		

			let filterLocation = [];

			exports.extractSubproductsInRecipe(recipe._id, Model, parent, filterLocation, (err, doc) => {
				
				subproductsList = subproductsList.concat(doc);
				cb_async()
			})

		} else {
			process.nextTick(()=>cb_async())
		}
	}, (err) => { //end of async loop
		if(err) return cb(err)

		subproductsList = exports.removeSubproductDuplicates(subproductsList);
		logger.info('Extract subproducts from recipe list. Total count: %s', subproductsList.length)
		cb(null, subproductsList)
	})

}

exports.extractSubproductsInRecipe = (_id, Model, parent, filterLocation, callback) => {
  //console.log(_id,'_id entra por funcion')
  var elementId = new ObjectId(_id);
  let elementsList = [];
  var conversionTable;

  waterfall([
    (cb) => { //Get active version of recipe
      
      Model.aggregate([
        {$unwind:
          {path: "$versions"}
        },
        {$match: {'_id': elementId}},
        {$match: {'versions.active': true}},
        
        ], (err, doc) => {

          if(err) return cb(err)

          if(doc && doc.length) {          
          	cb(null, doc);
          } else {
          	let err = new Error('Document not found')
          	return cb(err)
          }
        
        })

    }, (doc, cb) => { //Update composition elements unit cost 

      doc[0].versions.composition.forEach((compElement) => {

        if(compElement.element.kind == 'subproduct') { //composition element is a subproduct
          
          //Update composition element unitCost with average location cost based on filterLocation
          costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc[0].location, Subproduct);                

        } else if(compElement.element.kind == 'ingredient'){ //composition element is an ingredient

          //Update composition element unitCost with average location cost based on filterLocation
          costHelper.calculateCompElementAvgLocCostAndAllergens(compElement, doc[0].location, Ingredient);              	
        }   

      })

	     cb(null, doc);

    }, (doc, cb) => { //Get conversion table

					costHelper.getConversionTable((err, table) => {
						conversionTable = table;
						cb(null, doc);
					})

    },(doc,cb) => { //Recalculate recipe composition elements cost

				//Calculate costs of all elements using conversion table
				doc[0].versions.composition.forEach((recipeElement) => {

	  			if(recipeElement.measuringUnit==null) { //measuring unit is an equivalence unit. Gross weight is already expressed in base unit.
  					
  					recipeElement.grossWeight = recipeElement.equivalenceUnit.quantity * recipeElement.quantity;
  					recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;	
	  			
	  			} else {
	  			
	  				let measuringUnitId = new ObjectId(recipeElement.measuringUnit);
	  				let baseUnitId = new ObjectId(recipeElement.baseUnit);
		  			if(!measuringUnitId.equals(baseUnitId)) { //measuring unit is different than base unit, so we need conversion factor
		  				//Find conversion quantity in convertion table. Start by finding base unit...
		  				conversionTable.find((x) => { 
		  					if(x.baseUnit._id == recipeElement.baseUnit) {
			  					//Now find the conversion quantity in conversions object
			  					x.conversions.find((c) => {
			  						if(c.convUnit._id == recipeElement.measuringUnit) {
			  							let conversionQty = c.quantity;
			  							recipeElement.calculatedCost = recipeElement.grossWeight * conversionQty * recipeElement.unitCost;
			  						}  						
			  					})
			  				}
			  			})
		  			} else { //Measuring unit is equal to base unit, so there's no need for conversion
			  			//console.log('calculating calculatedCost: grossWeight= ' + recipeElement.grossWeight+ 'unit cost: '+recipeElement.unitCost)
			  			recipeElement.calculatedCost = recipeElement.grossWeight * recipeElement.unitCost;
		  			}
		  		}

				})

			cb(null, doc)

    }, (doc, cb) => {

        costHelper.calculateAvgRecipeLocCostAndAllergens(doc, Model);
        cb(null, doc)			

    }, (doc, cb) => {

    		if(doc[0]) { //Only if document find was successful
        
		        async.eachSeries(doc[0].versions.composition, function(compElement, cb_async) {
		          //console.log(compElement,'eachSeries')
		          if(compElement.element.kind == 'subproduct'){

                  let subproductId = new ObjectId(compElement.element.item)

                  let match = parent.some((_id) => {
                    let id = new ObjectId(_id);
                    return id.equals(subproductId)
                  })  

                  if(match) {
                    logger.warn('Circular loop detected when obtaining subproducts in recipe.')
                    process.nextTick(()=>cb_async()); 

                  } else {

                  	if(compElement.element.item) {

	                    parent.push(compElement.element.item);		          	

			                elementsList.push(compElement.element.item)

			                exports.extractSubproductsInRecipe(compElement.element.item, Subproduct, parent, filterLocation, (err, res) => { //recursive call!!!
	                      parent.pop()
			                  if(res && res.length) elementsList = elementsList.concat(res);
			                  process.nextTick(()=>cb_async())
			                });

			               } else {
	                			logger.warn("The value of a composition item is null. Skipping. id: " + doc[0]._id + " ,version: " + doc[0].versions._id)
	 		                	process.nextTick(()=>cb_async())
			               }
		              }
		          
		          } else {
		            process.nextTick(()=>cb_async());                                    
		          } 
		        
		        }, (err, results) => { //end of async loop
		        		if(err) return cb(err)
		            cb(null, elementsList);
		        }) 

		     } else {
		     		cb(null, elementsList);
		     }

      }], (err, elementsList) => { //end of waterfall
        
        if (err) return callback(err)
      	callback(null, elementsList)
    }) 
}


	exports.removeSubproductDuplicates = (arr) => {
	  //console.log(arr,'arr')
	  // console.log(arr.length,'arr2')
	  var i,j,cur,found;
	  for(i=arr.length-1;i>=0;i--){
	    cur = new ObjectId(arr[i]);
	    found=false;
	    for(j=i-1; !found&&j>=0; j--){
	      let id= new ObjectId(arr[j]);
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