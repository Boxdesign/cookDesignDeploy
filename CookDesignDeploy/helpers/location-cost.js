var async = require('async');

var waterfall = require('async-waterfall');
var {ObjectId} = require('mongodb');
var Article = require('../models/article');
var Ingredient = require('../models/ingredient');
var Packaging = require('../models/packaging');
var locHelper = require('../helpers/locations')
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.locationCost;


exports.calculateAvgPrice = (article, locationLoop, callback) => { 
	//2. Calculate the average price, excluding articles with net price equal zero.
	//3. If there aren't any articles with this ingredient or packaging, set average price to zero.
	//4. Get the actual ingredient or packaging and update the averagePrice field
	var totalPrice;
	var totalItems;
	var Model;
	var docArray=[];

	logger.info('calculateAvgPrice - Entering method to calculate ingredient or packaging avg cost based on its articles.')

	waterfall([

		(cb) => {  				

				async.eachSeries(locationLoop, function(location, cb_loc) { //loop through all article's locations. Must calculate price for each of these locations.
					
					//console.log('updating location price')

					if(article.category.kind == 'ingredient') {
						Model=Ingredient;
					} else if(article.category.kind == 'packaging') {
						Model=Packaging;
					}

					Article.find( //Find articles for this ingredient or packaging that include the location evaluated. There will be at least one result.
						{'category.item': article.category.item,
						 'location' : {$in: [location]}
					}, (err, articles) => {
			
						if(err) return cb(err)

						let totalPrice=0;
						let totalItems=0;

						if(articles.length>0) { //There are articles for this ingredient and location, calculate average price
						  
   				  	logger.info('calculateAvgPrice - There are articles for this ingredient/packaging and location: %', location)
							//console.log(articles, 'articles match')
							
							//calculate average price
							articles.forEach((article) => { 
								if (article.netPrice && article.netPrice !=0) { 
									totalPrice += article.netPrice;
									totalItems++;
								}
							})					
							let price = totalPrice / totalItems;
							//console.log('average price: ', price)

							//Get ingredient or packaging
							Model.findById(article.category.item, (err, doc) => {
								
								if(err) return cb(err);

								if (!doc || doc == null) { 
										
										cb_loc(); 
								
								} else {

									//console.log(doc, 'ingredient or packaging')

									if (!doc.locationCost) doc.locationCost = [];

									//Get array index for that location and update value
								  let index = locHelper.arrayPriceIndexOf(doc.locationCost, location);
									
									if(index>-1) { //There's a match!
										//console.log('The ing/pack has a price entry for this location')
										//console.log('updating price to: ', price, 'for location: ', location)
										doc.locationCost[index].unitCost=price;
										
									} else { //no match, add price for this location
										//console.log('the ing/pack does not have a price entry for this location')
										//console.log('updating price to: ', price, 'for location: ', location)
										let priceObj = {
											location: location,
											unitCost: price
										}
										doc.locationCost.push(priceObj);	
									}

									doc.save((err) => {
										if (err) return cb(err)
										//console.log('saving ing or pack')
										cb_loc();
									});
								}
							})

						} else { //there are no articles for this ingredient/packaging and location

							//console.log('there are no articles for this ingredient/packaging and location')
							//Get ingredient or packaging
							Model.findById(article.category.item, (err, doc) => {

								if(err) return cb(err)

								if (!doc || doc == null) { 
										//console.log('doc is null')
										cb_loc(); 
								
								} else {

									//console.log(doc, 'ingredient or packaging')
									if (!doc.locationCost) doc.locationCost = [];

									//Get array index for that location and update value
								  let index = locHelper.arrayPriceIndexOf(doc.locationCost, location);
									
									if(index>-1) { //There's a match!
										//console.log('the ingredient has a price entry for this location, remove the entry.')
										//doc.price[index].value=0;
										doc.locationCost.splice(index, 1) //remove from array
										
									} else { //no match, set price to zero for this location. Move on
										//console.log('the ingredient does not have a price entry for this location, there is nothing to do.')
										// let priceObj = {
										// 	location: location,
										// 	value: 0
										// }
										// doc.price.push(priceObj);	
									}

									doc.save((err) => {
										if (err) return cb(err)
										//console.log('saving ing or pack')
										cb_loc();
									});
								}
							})
						}
					})

			}, function(err) { //finished async loop
				if (err) return cb(err)
				cb(null, true)
			})

		}], (err, doc) => {
			if(err) return callback(err)
			callback(null,true)
	})

}