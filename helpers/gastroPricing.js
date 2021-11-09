/* 

This helper updates the pricing rates of gastronomic offers when one or more pricing rates of a dish or product change.

---- Dishes ----
When the the default price or any othe pricing rates changes, the helper proceeds as follows:

1. Looks for gastronomic offers that include this dish and pricing rate.
2. Updates the price accordingly and saves gastronomic offer.

--- Products ---
When the the default price or any othe pricing rates changes, the helper proceeds as follows:

1. Looks for gastronomic offers that include this product and pricing rate.
2. Updates the price accordingly and saves gastronomic offer.

*/

var GastroOffer = require('../models/gastroOffer');
var {ObjectId} = require('mongodb');
var async = require('async');
var waterfall = require('async-waterfall');

exports.checkDishPricingChanges = (dish, cb) => { //gastroElement can either be a dish or a product
	var pricingChanges = [];
	var currentRefPricePerServing;
	var originalRefPricePerServing;
	var currentRates;
	var originalRates;

	waterfall([
        (cb) => {
        	//Get data of active version after saving (current pricing)
			dish.versions.find(function(version) {
				if(version.active==true) {
			  		currentRefPricePerServing = version.refPricePerServing;
			  		currentRates = version.pricing;
			  		return true;
			  	}
			})

			//Get data of active version before saving (original pricing)
		  	dish._original.versions.find(function(version) {
				if(version.active==true) {
			  		originalRefPricePerServing = version.refPricePerServing;
			  		originalRates = version.pricing;
			  		return true;
			  	}
  			})
  			cb(null, true)

        }, (docs, cb) => {
        	//console.log(currentRefPricePerServing, 'currentRefPricePerServing')
        	//console.log(originalRefPricePerServing,'originalRefPricePerServing')
        	if (currentRefPricePerServing != originalRefPricePerServing) {
		  		pricingChangeObj = {
		  			price: currentRefPricePerServing,
		  			rateId : null
		  		}
		  		pricingChanges.push(pricingChangeObj);
		  	}
		  	cb(null, true)
		}, (docs, cb) => {
			
			//Check changes in pricing rates
			originalRates.forEach((originalRate) => {
		  		currentRates.forEach((currentRate) => {
		  			let originalRateId=new ObjectId(originalRate._id);
		  			let currentRateId=new ObjectId(currentRate._id);
		  			if (originalRateId.equals(currentRateId)) {
		  				if (originalRate.price != currentRate.price) {
		  					pricingChangeObj = {
					  			price: currentRate.price,
					  			rateId : currentRate._id
						  	}
						  	pricingChanges.push(pricingChangeObj);
				  		}
		  			}
		  		})
		  		
		  	})
		  	cb(null, true)
        }], (err, ok) => {
					if (err) return cb(err)
        	cb(pricingChanges);
		})	
}

exports.checkProductPricingChanges = (product, cb) => { 
	var pricingChanges = [];
	var currentRefPrice;
	var originalRefPrice;
	var currentRates;
	var originalRates;

	waterfall([
        (cb) => {
        	//Get data of active version after saving (current pricing)
			product.versions.find(function(version) {
				if(version.active==true) {
			  		currentRefPrice = version.refPrice;
			  		currentRates = version.pricing;
			  		return true;
			  	}
			})

			//Get data of active version before saving (original pricing)
		  	product._original.versions.find(function(version) {
				if(version.active==true) {
			  		originalRefPrice = version.refPrice;
			  		originalRates = version.pricing;
			  		return true;
			  	}
  			})
  			cb(null, true)

        }, (docs, cb) => {
        	if (currentRefPrice != originalRefPrice) {
		  		pricingChangeObj = {
		  			price: currentRefPrice,
		  			rateId : null
		  		}
		  		pricingChanges.push(pricingChangeObj);
		  	}
		  	cb(null, true)
		}, (docs, cb) => {

			originalRates.forEach((originalRate) => {
		  		currentRates.forEach((currentRate) => {
		  			let originalRateId=new ObjectId(originalRate._id);
		  			let currentRateId=new ObjectId(currentRate._id);
		  			if (originalRateId.equals(currentRateId)) {
		  				if (originalRate.price != currentRate.price) {
		  					pricingChangeObj = {
					  			price: currentRate.price,
					  			rateId : currentRate._id
						  	}
						  	pricingChanges.push(pricingChangeObj);
				  		}
		  			}
		  		})
		  		
		  	})
		  	cb(null, true)
        }], (err, ok) => {
					if (err) return cb(err)
        	cb(pricingChanges);
		})	
}

exports.checkDrinkPricingChanges = (drink, cb) => { //gastroElement can either be a dish or a product
	var pricingChanges = [];
	var currentRefPricePerServing;
	var originalRefPricePerServing;
	var currentRates;
	var originalRates;

	waterfall([
        (cb) => {
        	//Get data of active version after saving (current pricing)
			drink.versions.find(function(version) {
				if(version.active==true) {
			  		currentRefPricePerServing = version.refPricePerServing;
			  		currentRates = version.pricing;
			  		return true;
			  	}
			})

			//Get data of active version before saving (original pricing)
		  	drink._original.versions.find(function(version) {
				if(version.active==true) {
			  		originalRefPricePerServing = version.refPricePerServing;
			  		originalRates = version.pricing;
			  		return true;
			  	}
  			})
  			cb(null, true)

        }, (docs, cb) => {
        	if (currentRefPricePerServing != originalRefPricePerServing) {
		  		pricingChangeObj = {
		  			price: currentRefPricePerServing,
		  			rateId : null
		  		}
		  		pricingChanges.push(pricingChangeObj);
		  	}
		  	cb(null, true)
		}, (docs, cb) => {
			
			//Check changes in pricing rates
			originalRates.forEach((originalRate) => {
		  		currentRates.forEach((currentRate) => {
		  			let originalRateId=new ObjectId(originalRate._id);
		  			let currentRateId=new ObjectId(currentRate._id);
		  			if (originalRateId.equals(currentRateId)) {
		  				if (originalRate.price != currentRate.price) {
		  					pricingChangeObj = {
					  			price: currentRate.price,
					  			rateId : currentRate._id
						  	}
						  	pricingChanges.push(pricingChangeObj);
				  		}
		  			}
		  		})
		  		
		  	})
		  	cb(null, true)
        }], (err, ok) => {
			if (err) return cb(err)
        	cb(pricingChanges);
		})	
}

exports.updatePricing = (gastroOffer, pricingChanges, callback) => { 
/* 
1. Find gastro offers of type 'carte' and 'fixedPriceCarte' that include this dish or product
2. If the dish or product in the composition uses one the updated pricing rates, update the dish or product pricing
3. Save updated gastro offers
*/

	var id=new ObjectId(gastroOffer._id);

	waterfall([
      (cb) => {

        	//find gastro offers of type 'carte' and 'fixedPriceCarte' that include the dish or product which pricing has changed
			GastroOffer.aggregate([
				{$unwind : {path: "$versions"}},
				{$match: {$or: [{type:'carte'}, {type:'fixedPriceCarte'},{type:'catalog'}]}},
				{$match: { "versions.composition.element.item": id}},
				{$group: {
					"_id": "$_id",
					"versions": { "$push": "$versions" }
				}}
				], (err, docs) => {
					if (err) return cb(err)
					cb(null, docs)
				})

        }, (docs, cb) => {

        	//Go over gastro offers. If docs is empty it won't go in.
			docs.forEach((gastroOffer) => {

				//Go over versions of gastro offer
				gastroOffer.versions.forEach((gastroOfferVersion, index) => {

					//Update pricing of dish in composition
					gastroOfferVersion.composition.forEach((compElement) => {

						let itemId = new ObjectId(compElement.element.item)

						if(itemId.equals(id)){ //if the comp element is the updated dish or product

							if(!compElement.pricingRate || compElement.pricingRate==null){ //composition element pricing rate is default gastro offer price
								//Check wheter default pricing rate (with rateId equal null) has been updated and update accordingly
								pricingChanges.find((pricingChange) => {
									if (pricingChange.rateId==null) {
										compElement.price = pricingChange.price;
										return true;
									}
								})

							} else { //price is from one pricing rate that is not the default one
								let elementRateId=new ObjectId(compElement.pricingRate);

								pricingChanges.find((pricingChange) => {
									let updatedRateId=new ObjectId(pricingChange.rateId);
									if (elementRateId.equals(updatedRateId)) {
										compElement.price = pricingChange.price;
										return true;
									}
								})
							}
						}
					})
				})
			})
      cb(null, docs)

		}, (docs, cb) => {

				//Save updated gastro offers 
				async.eachSeries(docs, function(updatedGastroOffer, cb_async) {
					//we first get the actual complete gastro offer
					GastroOffer.findById(updatedGastroOffer._id, (error,doc)=>{
						//console.log('hello findById')
						//Update the updated versions
						updatedGastroOffer.versions.forEach((updatedGastroOfferVersion) => {
							doc.versions.forEach((gastroOfferVersion, index) => {
								let gastroOfferVersionId = new ObjectId(gastroOfferVersion._id);
								let updatedGastroOfferVersionId = new ObjectId(updatedGastroOfferVersion._id);
								if(gastroOfferVersionId.equals(updatedGastroOfferVersionId)){ 
									//Replace version with updated one
									doc.versions.splice(index, 1, updatedGastroOfferVersion);
									//console.log(doc.versions[index].composition, 'updating composition')
								}
							})
						})
						doc.save((err, doc) => {
							if(err) return cb(err)
							cb_async();						
						})		
					});
				}, (err, doc) => { //finished async loop
					cb(null, true);
				});					

        }], (err, ok) => {
			if (err) return callback(err)
        	callback();
		})
}