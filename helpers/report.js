var async = require('async');
var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var Subproduct = require('../models/subproduct');
var GastroOffer = require('../models/gastroOffer')
var Product = require('../models/product')
var Dish = require ('../models/dish')
var Drink = require ('../models/drinks')
var Ingredient = require('../models/ingredient')
var Article = require('../models/article')
var Provider = require('../models/provider');
var report = require('../helpers/report');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.report;
var mongoose = require('../node_modules/mongoose');

exports.getIngredientsInSubproduct = (_id, parent, cb) => { 

	var subproductId = new ObjectId(_id);
	let ingredientList = [];
	var subproduct;

	waterfall([
        (cb) => { //Get active version of subproduct
        	
        	Subproduct.aggregate([
        		{$unwind:
        			{path: "$versions"}
        		},
        		{$match: {'_id': subproductId}},
        		{$match: {'versions.active': true}},
        		], (err, doc) => {
        			if(err) return cb(err)
        				subproduct=doc;
            	//console.log('subproduct: ',subproduct[0].versions.lang[0].name)
            	cb(null, doc);
            })
        	
        }, (doc, cb) => {

    				if(doc[0]) { //Only if document find was successful
		
							async.each(doc[0].versions.composition, function(compElement, cb_async) {
								
								if(compElement.element.kind == 'ingredient'){
									
									ingredientList.push(compElement.element.item);
									//console.log(ingredientList,subproduct[0].versions.lang[0].name)
									cb_async();
								
								} else if (compElement.element.kind == 'subproduct') {

									let subproductId = new ObjectId(compElement.element.item)

									//console.log(parent, 'parent')
									
									let match = parent.some((_id) => {
										let id = new ObjectId(_id);
										return id.equals(subproductId)
									})

									if(match) {
										logger.warn('Circular loop detected.')
										cb_async();

									} else {
										
										parent.push(compElement.element.item);
									
										exports.getIngredientsInSubproduct(compElement.element.item, parent, (err, res) => { //recursive call!!!
											
											parent.pop();
											if(res.length > 0) ingredientList = ingredientList.concat(res);
											cb_async();
										
										});	

									}				
								}

							}, (err, results) => { //End of async loop
								cb(null, ingredientList);
							})	

					} else {
	     				cb(null, ingredientList);
					}	

		}], (err, ingredientList) => {
					if (err) return cb(err)
            //console.log('exiting: ',subproduct[0].versions.lang[0].name)
          cb(null, ingredientList)
        }) 
}

exports.getGastroIngredients = (gastroOfferId, userProfile, callback) => {

  var dishIdList = [];
  var productIdList = [];
	var ingredientList = [];
	var recipesList = [];
  var kindPipeline;
	var drinkIdList = [];
	var loggerHelper = require('../helpers/logger');
	const logger = loggerHelper.report;


  logger.info('Helper method getGastroIngredients - Entering getGastroIngredients method.')
    
	async.waterfall([
		// aqui hacer enrutamiento si tenemos filterLocations o no hacia el helperReport que nos generara un listado u otro, como en print!!
        (cb) => { //Get active version of gastronomic offer

        	if(mongoose.Types.ObjectId.isValid(gastroOfferId)) {

        		GastroOffer.findById(gastroOfferId, {versions : {$elemMatch: {active: true}}, type: true}, (err, doc) =>{
        			if(err) return cb(err)
        			if (!doc) {
        				let err = new Error('Document not found')
                err.statusCode = 404;
                logger.error(err)
                return cb(err);
        			}

        			if(!doc.versions[0]) {
        				let err= new Error("Gastro offer "+ gastroOfferId + " does not have active version!")
                logger.error(err)
        				return cb(err)
        			}

        			if(!doc.versions[0].composition.length) {
        				let err = new Error('Empty gastronomic offer')
                logger.error(err)
        				return cb(err) 
        			}

        			logger.info('Gastro offer retrieved: %j', doc)

     				  logger.info('Helper method getGastroIngredients - Successfully retrieved gastro offer of type %s.', doc.type)

							//Note: after reviewing this code some considerable time later, I'm not sure what is the purpose of kindPipeline...
        			if (doc.type[0] == 'catalog') {//catalog has products
       				  logger.info('Helper method getGastroIngredients - Gastro offer is a catalog.')
        				kindPipeline = { 'versions.composition.element.kind': 'product'} 
        			} 
        			else 
        			{ 
       				  logger.info('Helper method getGastroIngredients - Gastro offer is a NOT a catalog.')
        				kindPipeline = {$or: [
        														{ 'versions.composition.element.kind': 'dish'},
        														{ 'versions.composition.element.kind': 'drink'}
        											 ]}  
					    }
							//console.log(doc[0].type,'type')
        		  cb(null, doc);
        		})	

	        } else {
	        	var err = new Error('Invalid document id.')
            err.statusCode = 404;
            return cb(err);
	        }
	    
	    }, (doc, cb) => { 

	    	GastroOffer.aggregate([
					{$match: {'_id': gastroOfferId}},
	    		{$unwind:
	    			{path: "$versions"}
	    		},
	    		{$match: {'versions.active': true}},
	    		{$match: kindPipeline }
	    		], (err, doc) => {
	    				if(err) return cb(err)
	    				if(!doc.length) {
		    					var err = new Error('Empty gastronomic offer')
	                //err.statusCode = 404;
	                return cb(err);
              } else {
            		//console.log(doc,'agg')
            		logger.info('Helper method getGastroIngredients - Successfully retrieved gastro offer.')
            		cb(null, doc);
            	}
	         }) 

      }, (doc, cb) => {  

					if(doc[0].type == 'catalog') { //Catalog has products

						logger.info('Helper method getGastroIngredients - Gastro offer is a catalog.')

						//Put list of products id in array
						doc[0].versions.composition.forEach((compElement) => {
							productIdList.push(compElement.element.item);
						})
						
						logger.info('Helper method getGastroIngredients - Catalog contains %s products.', productIdList.length)

					} else { //All other gastro offers have dishes or drinks

						logger.info('Helper method getGastroIngredients - Gastro offer is NOT a catalog.')

						//Put list of dishes id in array
						doc[0].versions.composition.forEach((compElement) => {
							
							if(compElement.element.kind == 'dish'){
								dishIdList.push(compElement.element.item);
							} else {
								drinkIdList.push(compElement.element.item);
							}
						})
					}
					cb(null, doc)

			}, (doc, cb) => { //Get list of products

				if(productIdList.length > 0){

    			Product.aggregate([
						{$match: {'_id': {$in: productIdList}}},
	    			{$unwind:
	               {path: "$versions"}
            },
            {$match: {'versions.active': true}}
	    		], (err, docs) => {
							if(err) return cb(err);
							recipesList = recipesList.concat(docs);
							logger.info('Helper method getGastroIngredients - Successfully obtained list of products.')
							cb(null, doc);
	    		})
	
				} else {
					cb(null, doc);
				}					
			
		}, (doc, cb) => { //Get list of dishes

			if(dishIdList.length > 0){
				//Get active version of dishes in dishIdList
				Dish.aggregate([
					{$match: {'_id': {$in: dishIdList}}},
					{$unwind:
							{path: "$versions"}
					},
					{$match: {'versions.active': true}}
				], (err, docs) => {
					if(err) return cb(err);
					recipesList = recipesList.concat(docs);
					cb(null, doc);
				})

			} else {
				cb(null, doc);
			}			
			
		}, (doc, cb) => { //Get list of drinks

			if(drinkIdList.length > 0){
				//Get active version of drinks in drinkIdList
				Drink.aggregate([
					{$match: {'_id': {$in: drinkIdList}}},
					{$unwind:
							{path: "$versions"}
					},
					{$match: {'versions.active': true}}
				], (err, doc) => {
					if(err) return cb(err);
					recipesList = recipesList.concat(doc);
					cb(null, doc);
				})
			} else {
				cb(null, doc);
			}		

		}, (doc, cb) => {			
		
			async.eachSeries(recipesList, function(recipe, cb_async1) { //could be dish, drink or product

				async.eachSeries(recipe.versions.composition, function(compElement, cb_async2) {

					if(compElement.element.kind == 'ingredient'){
						ingredientList.push(compElement.element.item);
						//console.log(ingredientList)
						cb_async2();
					
					} else if (compElement.element.kind == 'subproduct') {
						
						let parent = [compElement.element.item]
						
						report.getIngredientsInSubproduct(compElement.element.item, parent, (err, res) => {
							if(res.length > 0) ingredientList = ingredientList.concat(res);
							cb_async2();
						});						
					}
				},
				(err, results) => { //end of async2
					cb_async1(); 
				})	

			}, (err) => { //end of async1
				//console.log('ingredientsList--- Report Helper',ingredientList)
				cb(null, ingredientList);
			})	

		}, (ingredientList, cb) => {

			Ingredient.find(
				{
				  _id: {$in: ingredientList},
				  lang: {$elemMatch: {langCode: userProfile.user.language}}
				}
				)
				.populate('allergens.allergen')
				.exec((err, docs) => {
	    			if(err) return cb(err)
	          cb(null, docs);
	    		})

		}],(err,docs)=>{
				if (err) {
					if (err.message == "Empty gastronomic offer") callback(null, [])
					else callback(err)
				}
				else
				{
					callback(null,docs)
				}
		})
}
