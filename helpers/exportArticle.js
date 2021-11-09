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
 var Packaging = require('../models/packaging');
 var Family = require('../models/family');
 var Location = require('../models/location');
 var GastroOffer = require('../models/gastroOffer');
 var {ObjectId} = require('mongodb');
 var config = require('../config/config');
 var json2csv = require('json2csv');
 var cookStepsHelper = require('../helpers/cookingSteps')
 var allergenHelper = require('../helpers/allergen')
 var loggerHelper = require('../helpers/logger');
 const logger = loggerHelper.dataExport;

 exports.export = (params, userProfile, callback) => {

  var articles = [];
  var filterId;
  var searchPipeline;
  var Model;

	waterfall([

 		(cb) => {

			if (params.filterId) {
          filterId = JSON.parse(params.filterId).map(function(doc) { return new ObjectId(doc); });
      } else {
          filterId = [];
      }

      searchPipeline = {
      	$text: {$search: params.filterText}      	
      };

			if (filterId.length > 0) {
          searchPipeline = {
          	$text: {$search: params.filterText},
          	'_id': {$in: filterId}
          }
      }

      if(params.exportType) {
      	switch(params.exportType) {
					case 'ingredient':
						Model = Ingredient;
						break;

					case 'packaging':
						Model = Packaging;
						break;
				}
      } else {
      	var err = new Error('Article type must be provided.')
        err.statusCode = 400;
      	return cb(err)
      }      


 			//Get ingredients or packagings
 			Model.find(
 				searchPipeline
 			,{
        last_account: 1,
        active: 1,
        updatedAt: 1,
        gallery: 1,
        family: 1,
        subfamily: 1,
        referenceNumber:1,
        ingredientPercentage: 1,
        netPercentage: 1,
        quartering: 1,
        measurementUnit: 1,
        referencePrice: 1,
        averagePrice: 1,
        allergens: 1,
        lang: {$elemMatch: {langCode: userProfile.user.language}}
 			})
 			.populate("measurementUnit gallery")
			.exec((err, docs) => {
       	if(err) return cb(err)	

      	//Flag docs
      	docs.map((doc) => {
      		doc.type=params.exportType
      	})

 				logger.info('Obtain ingredients from list of ingredients ObjectIds. Total count: %s', docs.length)

       	articles = articles.concat(docs)
       	cb(null, docs)         
      })

 		}, (docs, cb) => {

 				//articles is an array of objects that contains ingredients and/or products
 				exportArticles(articles, params, userProfile, (err) => {
 					if(err) return cb(err)
 					cb(null, docs)
 				})

 		}],(err, docs) => {
        if (err) return callback(err)
		    callback(null, docs)
 		})

}


 //Generates csv file from a list of articles. Method called from export.
 exports.exportArticlesFromList = (articleList, userProfile, params, callback) => {

 	//Recipes list is a JSON object with a dishList, drinkList and productList key

  var articles = [];

	waterfall([

 		(cb) => {

 			let ingredientList = articleList.ingredientsList;

 			//Get ingredients
 			Ingredient.find({
 				'_id': {$in: ingredientList}
 			},{
        last_account: 1,
        active: 1,
        updatedAt: 1,
        gallery: 1,
        family: 1,
        subfamily: 1,
        ingredientPercentage: 1,
        referenceNumber:1,
        netPercentage: 1,
        quartering: 1,
        measurementUnit: 1,
        referencePrice: 1,
        averagePrice: 1,
        allergens: 1,
        lang: {$elemMatch: {langCode: userProfile.user.language}}
 			})
 			.populate("measurementUnit gallery")
			.exec((err, docs) => {
       	if(err) return cb(err)	
 				
 				logger.info('Obtain ingredients from list of ingredients ObjectIds.')

      	//Flag docs
      	docs.map((doc) => {
      		doc.type='ingredient'
      	})

       	articles = articles.concat(docs)
       	cb(null, docs)         
      })

 		}, (docs, cb) => {

 			//Get product id list from Recipes List
 			let packagingsList = articleList.packagingsList;

 			//Get packagings
 			Packaging.find({
 				'_id': {$in: packagingsList}
 			},{
        last_account: 1,
        active: 1,
        updatedAt: 1,
        gallery: 1,
        family: 1,
        subfamily: 1,
        ingredientPercentage: 1,
        netPercentage: 1,
        referenceNumber:1,
        quartering: 1,
        measurementUnit: 1,
        referencePrice: 1,
        averagePrice: 1,
        allergens: 1,
        lang: {$elemMatch: {langCode: userProfile.user.language}}
 			})
			.populate("measurementUnit gallery") 			
			.exec((err, docs) => {
       	if(err) return cb(err)	
      	
      	//Flag docs
      	docs.map((doc) => {
      		doc.type='packaging'
      	})       		

       	articles = articles.concat(docs)
       	cb(null, docs)         
      })

 		}, (docs, cb) => {

	 			logger.info('Obtain packagings from list of packagings ObjectIds.')

 				//articles is an array of objects that contains ingredients and/or products
 				exportArticles(articles, params, userProfile, (err) => {
 					if(err) return cb(err)
 					cb(null, docs)
 				})

 		}],(err, docs) => {
        if (err) return callback(err)
		    callback(null, docs)
 		})

}


var exportArticles = (docs, params, userProfile, callback) => {

	//docs is an array of articles objects (ingredients or packagings)

  var articles = [];
  var allergens;
  var allergenTextList = '';

	waterfall([

		(cb) => {  //Get list of allergens in user language

				allergenHelper.getAllergens(userProfile, (err, aller) => {
					if(err) return cb(err)
					allergens = aller;
					cb(null, docs)
				})	 			

 		}, (docs, cb) => { //populate allergens

        docs.forEach((doc) => { 

        	if(doc.allergens) { //If doc has allergens (ingredients)

		        	//populate ingredients allergens
							doc.allergens.forEach((ingAllergen) => { 

		            let subAllerId = new ObjectId(ingAllergen.allergen);

		            allergens.forEach((allergen) => {                
		              let allergenId = new ObjectId(allergen._id)

		              if(subAllerId.equals(allergenId)) {
		                ingAllergen.allergen=allergen;
		              }
		            })
		          })  

		   	      allergenTextList = '';

		          //Generate allergen text for csv
							doc.allergens.forEach((ingAllergen) => {
		          	allergenTextList = allergenTextList.concat(ingAllergen.allergen.lang[0].name)

		          	switch (ingAllergen.level) {
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
		      } 
						        	
        })

        logger.info('Populate allergens in list of ingredients.')

        cb(null, docs)

 		}, (docs, cb) => {  //Populate families and subfamilies

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
            {$match: {'category': {$in: ['ingredient', 'packaging']}}},
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
								doc.populatedFamily = fam;
								families[index].subfamilies.forEach((subfam)=> {
									let subfamId = new ObjectId(subfam._id)
									let elementSubFamId = null;
									if(mongoose.Types.ObjectId.isValid(doc.subfamily))
										elementSubFamId = new ObjectId(doc.subfamily)
									if (subfamId.equals(elementSubFamId)) {
										doc.populatedSubfamily=subfam;
									}
								})
							} 
						})
					})

					logger.info('Populate families and subfamilies in list of articles (ing or packs). ')
					cb(null, docs)
				})

		}, (docs, cb) => { //If article is an ingredient, check whether it is a quartering and save parent ingredient name

					async.eachSeries(docs, (doc, cb_async) => {
						
						if(doc.quartering) {
							
							Ingredient.find(
							{
								_id: doc.quartering
							},
							{
				        lang: {$elemMatch: {langCode: userProfile.user.language}}
				 			})	
							.exec((err, parent) => {
				       	if(err) return cb(err)	

				       	if(parent) {

				       		doc.parentQuarteringName = parent[0].lang[0].name;
				        	let refId = parent[0]._id.toString();				       
				       		doc.parentQuarteringRef = 'in-' + refId.slice(-8);
				       		cb_async()

				       	} else {
				       		cb_async()
				       	}
				       	      
				      })
						} else {
							cb_async();
						}

				}, (err) => { //finished async loop
					if(err) return cb(err)
					logger.info('Add parent information to quarterings.')
					cb(null, docs)
				})


		}, (docs, cb) => {

 				docs.forEach((doc) => { //add firt recipe line with general information

					let subfamily=''
					if(doc.populatedSubfamily) {
						subfamily = doc.populatedSubfamily.lang.name
				  }

					let family=''
					if(doc.populatedFamily) {
						family = doc.populatedFamily.lang.name
				  }		

					let image = '';
					if(doc.gallery) image = doc.gallery.sizes[1].url;

	        let refId = doc._id.toString();	

	        let tag;
					let type;

					switch(doc.type) {
						case 'ingredient':
							tag = 'in-';
							type = 'Ingrediente';
							break;

						case 'packaging':
							tag = 'pk-';
							type = 'Envase'
							break;
					}

					let articleLine = {
						ref: tag + refId.slice(-8), //get las 8 digits of _id
						type: type,
						name: doc.lang[0].name,
						description: doc.lang[0].description,
						measurementUnit: doc.measurementUnit.lang[0].name,
						family: family,
						subfamily: subfamily,						
						allergens: doc.allergenTextList,
						image: image,
						referenceNumber:doc.referenceNumber,
						referencePrice: doc.referencePrice,
						equivalenceUnit: doc.equivalenceUnitName,
						equivalenceQty: doc.equivalenceQty,
						parentQuarteringName: doc.parentQuarteringName,
						parentQuarteringRef: doc.parentQuarteringRef,
						ingredientPercentage: doc.ingredientPercentage,
						netPercentage: doc.netPercentage
					}

					articles.push(articleLine)

 				})

 				logger.info('Build data to pass on to the csv generator.')

	 			cb(null, docs)

		}, (docs, cb) => { //convert to CSV

				var fields = ['ref', 'type', 'name', 'description', 'measurementUnit', 'family', 'subfamily', 'allergens', 'image', 'referencePrice', 'equivalenceUnit',
				'parentQuarteringName', 'parentQuarteringRef', 'ingredientPercentage', 'netPercentage'];

				var fieldNames = ['Referencia', 'Tipo', 'Nombre', 'Descripción', 'Unidad de medida', 'Família', 'Subfamília', 'Alérgenos', 'Imagen', 'Precio de referencia',
				'Unidad de equivalencia', 'Despiece - ingrediente padre', 'Despiece - Referencia ing padre', 'Porcentage parte', 'Neto aplicable'];

				json2csv({ data: articles, fields: fields, fieldNames: fieldNames}, function(err, csv) {
				  if (err) cb(err);
				  fs.writeFile('/tmp/article_export.csv', csv, function(err) {
					  if (err) return cb(err);
					  logger.info('Create csv file: /tmp/article_export.csv')
					  cb(null, docs)
					});			  
				});

		}], (err, docs) => {

			if(err) return callback(err)
			callback();
	})
}


exports.extractPackagings = (recipesList, cb) => {
	  let packagingsList = [];

	  if(recipesList.productList) {

			  //Flatten recipesList
			  var products = recipesList.productList;

			  products = products.map((product) => {
			  	return new ObjectId(product._id)
			  })

				waterfall([

					(cb) => {  //Get products

						Product.aggregate([
		      		{$unwind:
		      			{path: "$versions"}
		      		},
		      		{$match: {'_id': {$in: products}}},
		      		{$match: {'versions.active': true}},
		      		], (err, docs) => {
		      			
		      			if(err) return cb(err)
		      			cb(null, docs)						         
		          })	

		      }, (docs, cb) => {
		          		
		         	docs.forEach((doc) => {
								
								let packs = doc.versions.packaging.map((pack) => {
									return pack.packaging;
								})	  		
					  		packagingsList = packagingsList.concat(packs)
		         	})

		         	cb(null, docs)
			  
					}], (err, docs) => {

						if(err) return cb(err)
						packagingsList = removeIngredientDuplicates(packagingsList);

						logger.info('Extracting packagings from products. Total count of packagings: %s', packagingsList.length)
						cb(null, packagingsList);
				})
		
		} else {
			cb(null, packagingsList);
		}
}


exports.getProductPackagings = (packagingArray, userProfile, cb) => {

	waterfall([

		(cb) => {  //Get list of allergens in user language
			
			let packagingList = packagingArray.map((pack) => {
				return pack.packaging;
			})

 			Packaging.find({
 				'_id': {$in: packagingList}
 			},{
        last_account: 1,
        active: 1,
        updatedAt: 1,
        gallery: 1,
        family: 1,
        subfamily: 1,
        measurementUnit: 1,
        referencePrice: 1,
        averagePrice: 1,
        lang: {$elemMatch: {langCode: userProfile.user.language}}
 			})
 			.populate("measurementUnit gallery")
			.exec((err, docs) => {
       	if(err) return cb(err)	
 				
 				logger.info('Obtain packagings from list of packaging ObjectIds. Total count: %s', docs.length)

       	cb(null, docs)         
      })

		}], (err, docs) => {

			if(err) return cb(err)
			cb(null, docs);
	})

}

exports.extractIngredients = (recipesList, cb) => {

  let ingredientsList = [];
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

			extractIngredientsInRecipe(recipe._id, Model, parent, (err, doc) => {
				ingredientsList = ingredientsList.concat(doc);
				cb_async()
			})

		} else {
			cb_async()
		}

	}, (err) => { //end of async loop
		if(err) return cb(err)
		ingredientsList = removeIngredientDuplicates(ingredientsList);

		logger.info('Extracted ingredients from list of recipes. Total count: %s', ingredientsList.length)

		cb(null, ingredientsList)
	})
}


var extractIngredientsInRecipe = (_id, Model, parent, cb) => {
	
	var id = new ObjectId(_id);
	let ingredientList = [];

	waterfall([
      (cb) => { //Get active version of recipe
      	
      	Model.aggregate([
      		{$unwind:
      			{path: "$versions"}
      		},
      		{$match: {'_id': id}},
      		{$match: {'versions.active': true}},
      		], (err, doc) => {
      			
      			if(err) return cb(err)

      			//if(doc[0]) { console.log('checking: ', doc[0].versions.lang[0].name) }
          	cb(null, doc);
          
          })
      	
      }, (doc, cb) => {

    		if(doc[0]) { //Only if document find was successful

					async.eachSeries(doc[0].versions.composition, function(compElement, cb_async) {

						if(compElement.element.kind == 'ingredient'){
							
							ingredientList.push(compElement.element.item);
							cb_async();
						
						} else if (compElement.element.kind == 'subproduct') {

							let subproductId = new ObjectId(compElement.element.item)

							//console.log(parent, 'parent')
							
							let match = parent.some((_id) => {
								let id = new ObjectId(_id);
								return id.equals(subproductId)
							})

							if(match) {
								//console.log('circular loop! Move on...')
								cb_async();

							} else {
								parent.push(compElement.element.item);

								extractIngredientsInRecipe(compElement.element.item, Subproduct, parent, (err, res) => { //recursive call!!!
									parent.pop()
									if(res.length > 0) ingredientList = ingredientList.concat(res);
									cb_async();
								});
							}					
												
						}
					}, (err, results) => { //async loop finished
						if(err) return cb(err)
						cb(null, ingredientList);
					})	

	     } else {
	     		cb(null, ingredientList);
	     }

	}], (err, ingredientList) => {
		if (err) return cb(err)
    cb(null, ingredientList)
  }) 
}

var removeIngredientDuplicates = (arr) => {
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