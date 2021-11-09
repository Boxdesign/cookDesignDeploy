

exports.restrictEquivalenceUnit = (ingredientId, callback) => {

	var Subproduct = require('../models/subproduct')
	var Product = require('../models/product')
	var Dish = require('../models/dish')
	var Drink = require('../models/drinks')
	var async = require('async')
	var Models = [Subproduct, Product, Dish, Drink]

	async.eachSeries(Models, (Model, cb_async) => {

			Model.aggregate([
        {$unwind: {path: "$versions"}},
        {$match: {'versions.composition.measuringUnit': null}},
        {$match: {'versions.composition.element.item': ingredientId}}
      ], (err, docs) => {
            if (err) return cb_async(err);
            if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
              // console.log('original equiqty' + ingredient._original.equivalenceQty)
              // console.log('pre save equiqty' + ingredient.equivalenceQty)
              console.log(docs,'docs')
              var err = new Error('Equivalence unit cannot be removed because it is being used in at least one recipe');
              err.statusCode = 400;
              return cb_async(err);
            } else {
              cb_async();
            }            
      })


	}, (err) => {
		if(err){
			callback(err)
		}
		else
		{
			callback(null, true)
		}
	})	

}