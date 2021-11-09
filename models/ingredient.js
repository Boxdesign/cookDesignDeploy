"use strict";

 var mongoose = require('mongoose');
 var Schema = mongoose.Schema;
 require('../models/hasAllergens');
 var hasAllergensSchema = require('mongoose').model('hasAllergens').schema;
 var restrict = require('./../helpers/restrict');
 var cost = require('./../helpers/cost');
 var locHelper = require('./../helpers/locations')
 var allergen = require('./../helpers/allergen');
 var quarteringHelper = require('./../helpers/quartering');
 var waterfall = require('async-waterfall');
 var Subproduct = require('../models/subproduct');
 var Dish = require('../models/dish');
 var Product = require('../models/product');
 var {ObjectId} = require('mongodb');
 var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.ingredientHooks;


//Definign schema
var ingredientSchema = new Schema({
  lang: [{
    langCode: {
      type: String,
      maxlength: 3,
      required: true
   },
   name: {
      type: String,
      required: true,
      unique: true
   },
   equivalenceUnitName: {
      type: String,
      required: false,
      unique: false
   },
   description: {
      type: String,
      required: false,
      maxlength: 5000
   },
   tastingNote: {
      type: String,
      required: false,
      maxlength: 5000
   },
   region: {
      type: String,
      required: false,
      maxlength: 5000
   },
   alcoholPercentage: {
      type: String,
      required: false,
      maxlength: 5000
   }
    }],
    quartering: { //Will be the parent ingredient
       type: Schema.Types.ObjectId,
       ref: 'ingredient'
    },
    gallery: {
       type: Schema.Types.ObjectId,
       ref: 'gallery',
       required: false
    },
    active: {
       type: Boolean,
       required: false
    },
    referencePrice: {
       type: Number,
       required: false
    },
    referenceNumber: {
       type: String,
       required: false,
       unique: false
    },
    locationCost: [{
       location: {
        type: Schema.Types.ObjectId,
        ref: 'location',
       },
       unitCost: {
        type: Number,
        min: 0
      }
    }],
    locationAllergens: [{
       location: {
        type: Schema.Types.ObjectId,
        ref: 'location',
       },
       allergens: [
        hasAllergensSchema
    	]
    }],
    averagePrice: {
       type: Number,
       required: false
    },
    equivalenceQty: {
       type: Number,
       required: false,
       min: 0
    },
    measurementUnit: {
       type: Schema.Types.ObjectId,
       ref: 'measurementUnit',
       required: false
    },
    family: {
       type: Schema.Types.ObjectId,
       ref: 'family',
       required: false
    },
    subfamily: {
       type: Schema.Types.ObjectId,
       ref: 'family.subfamilies',
       required: false
    },
    allergens: [
        hasAllergensSchema
    ],
    ingredientPercentage: { //Quartering
       type: Number,
       max: 100,
       min: 0,
       required: false
    },
    netPercentage: { //Quartering
       type: Number,
       min: 0,
       required: false
    },
    last_account: {
       type: Schema.Types.ObjectId,
       ref: 'account',
       required: false
    },
    temporality: {
      isActive : Boolean,
      month : {
        january : Boolean,
        february : Boolean,
        march : Boolean,
        april : Boolean,
        may : Boolean,
        june : Boolean,
        july : Boolean,
        august : Boolean,
        september : Boolean,
        october : Boolean,
        november : Boolean,
        december : Boolean
      }
    }

 }, {
  timestamps: true
});

ingredientSchema.statics.findDeps = (ingredientId, cb) => {
  restrict(cb, ingredientId, 'ingredient', []);
};

/****************  HOOKS  ***************************/

/***************** Post init *********************/
ingredientSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});

/***************** Pre save *********************/
ingredientSchema.pre('save', function (next) {
  //Note: this hook is called when the save method is invoked in the model. This is the case when we create a new ingredient.
  var ingredient = this; //this is the document
  var Ingredient = this.constructor;  //this.constructor is the model
  var ingredientId = new ObjectId(ingredient._id);
	var Subproduct = require('../models/subproduct');
	var equivalenceUnitHelper = require('../helpers/ingredientRestrict')

  waterfall([
    (cb) => {  

    	if(ingredient._original && ingredient._original.equivalenceQty!=0 && ingredient.equivalenceQty==0) {
    			//Ingredient edit and equivalenceQty has been set to zero. Check integrity in next step.
    			cb(null, true)
    	}
    	else
    	{
    		//An addition or equivalenceQty has not changed to zero, ie, it has remained as zero or has changed from zero to a different number.
    		//Nothing to do, skip.
    		return cb(true)
    	}

    },(doc,cb) => {

      //If equivalence unit has been removed, verify whether it is being used in any subproduct before saving.
      //second verify the equivalence unit has been removed
      //Verify that there aren't any subproduct versions that contain this ingredient's equivalence unit
      equivalenceUnitHelper.restrictEquivalenceUnit(ingredientId, (err, doc) => {
      	if(err) return cb(err)
      	else cb(null, doc)
      })      

	  }], (err, ok) =>{  

	  		if(err){
	  			if(err == true) next()
	  			else next(err)
	  		}
	  		else
	  		{
	  			next()
	  		}
	  }) 
})

/***************** Pre remove *********************/
ingredientSchema.pre('remove', function (next) {
  //Note: this hook is called when the remove method is invoked in the model. This is the case when we delete a new ingredient.
  var ingredient = this; //this is the document being removed
  var Ingredient = this.constructor;  //this.constructor is the model
  var ingredientId = new ObjectId(ingredient._id);
	var Subproduct = require('../models/subproduct');
	var Product = require('../models/product');
	var Dish = require('../models/dish');
	var ProviderArticle = require('../models/article');
	var Drink = require('../models/drinks');
	var async = require('async')

  waterfall([
    (cb) => { 

    	var Models = [Subproduct, Dish, Drink, Product]

    	async.eachSeries(Models, (Model, cb_async) => {
	      //Verify that there aren't any subproduct versions that contain this ingredient or quartering
	      Model.aggregate([
	        {$unwind: {path: "$versions"}},
	        {$match: {'versions.composition.element.item': ingredientId}}
	      ], (err, docs) => {
	            if (err) return cb_async(err);
	            if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
	              var err = new Error('Ingredient cannot be removed because it is used in at least one recipe');
	              err.statusCode = 400;
	              return cb_async(err);
	            } else {
	              cb_async(null, true);
	            }            
	      })

    	}, (err) => {
    		if(err) return cb(err)
    		cb(null, true)    		
    	})

  }, (ok, cb)=> { //Check whether there are provider articles related to this ingredient

  	ProviderArticle.find({'category.item': this._id},{_id: 1}, (err, docs) =>{
  		if(err) return cb(err)
  		if(docs.length){
  			let err = new Error('Ingredient cannot be removed because it is linked to ' + docs.length + ' provider articles')
  			return cb(err)
  		}
  		cb(null, true)
  	})

  }, (ok, cb)=> {
      //If the ingredient is not a quartering, verify it doesn't have quarterings. It it does, it can't be deleted.
      if (!ingredient.quartering) {
        Ingredient.findOne({'quartering': ingredient._id}, '_id', (err, ing) => {
            if (err) return cb(err);
            if (ing) {
                //ingredient has quarterings therefore it can't be deleted
                var err = new Error('Ingredient cannot be removed because it has quarterings. Remove quarterings before deleting the ingredient.');
                err.statusCode = 400;
                return cb(err);
            }
            else {
              cb(null, true);
            }
        })
      } else {
        cb(null, true)
      }

  }], (err, ok) =>{ 
      if (err) return next(err);
      next();
  })   
})

/***************** Post save *********************/
ingredientSchema.post('save', function (doc, next) {
  var ingredient = this; //this is the document being removed
  var Ingredient = this.constructor;  //this.constructor is the model
  var locationLoop = [];
  var locationAllergensLoop = [];
  var recipeCostQueue = require('../queues/recipeCompCost')
  var recipeAllergensQueue = require('../queues/recipeCompAllergens')
  var recipeConvQueue = require('../queues/recipeConvCost')
  var allergenQueue = require('../queues/allergen')
  var updateMeasUnitQueue = require('../queues/measUnit')
  var removeImageQueue = require('../queues/removeImage')

  logger.info('Ingredient post-save hook - Entering ingredient post save hook.')

  waterfall([
    (cb) => {

      if(this._original) { //Edit
        cb(null, true)
      } else { //New ingredient creation. Nothing else to do, move on
         return cb(true);
      }

    }, (ok, cb) => {   //Check whether ingredient is a quartering

    	if(this.quartering) {
    		logger.info('Ingredient post-save hook - Ingredient is a quartering, move on to the next step.')
    		cb(null, true)
    	}
    	else
    	{
    		logger.info('Ingredient post-save hook - Ingredient is not a quartering, but may have quarterings. Call updateQuarteringsCost to update quarterings if required.')

    		let qtrLocLoop=[];

				let refObject = {
	     		location: null,
	     		unitCost: this.referencePrice
	      }

	 			qtrLocLoop.push(refObject);
	 			if(this.locationCost) qtrLocLoop = qtrLocLoop.concat(this.locationCost)

	      logger.info('Ingredient post-save hook - Calculated quartering location loop: %j', qtrLocLoop)

    		quarteringHelper.updateQuarteringsCost(this, true, qtrLocLoop, (err, res) => {
    			if(err) return cb(err)
    			logger.info('Ingredient post-save hook - Finished updateQuarteringsCost method. Moving on to next step.')
    			cb(null, true)
    		})
    	}

    }, (ok, cb) => {   //Compute location loop. Computes list of cost locations deleted, changed or added.

        //Calculate location loop
        locHelper.computeLocationLoop(this.locationCost, this._original.locationCost, function(res){
          locationLoop = res; //If location loop is empty, price location has not changed.
          logger.info('Ingredient post-save hook - Calculated location loop %j.', locationLoop)
          cb(null, true)
        })

    }, (ok, cb) => {  


        if(this.referencePrice != this._original.referencePrice) {

          logger.info('Ingredient post-save hook - Ingredient reference price has changed to %s: ', this.referencePrice)

          let referencePriceObj = {
            location: null,
            unitCost: this.referencePrice,
            status: 'edit'
          }
          locationLoop.push(referencePriceObj) //Add reference price to location loop
        }
        else
        {
          logger.info('Ingredient post-save hook - Ingredient reference price has not changed')
        }

        if(locationLoop.length > 0) {
          //Reference price or location prices of ingredient have changed. 

          logger.info('Ingredient post-save hook - Either reference price or location prices of ingredient have changed.')
          logger.info('Ingredient post-save hook - Create updateRecipeCompCost task.')

          recipeCostQueue.updateRecipeCompCost(
            {
              title: 'Post-save ingredient hook - Update recipes composition cost',
              id: this._id, 
              locationLoop: locationLoop 
            }
          );
        }
        cb(null, true)

    }, (ok, cb) => {   //Compute location loop. Computes list of cost locations deleted, changed or added.

        logger.info('Ingredient post-save hook - Compute allergens location loop')
        logger.info('Ingredient post-save hook - Current allergens %j', this.locationAllergens)
        logger.info('Ingredient post-save hook - Current allergens %j', this._original.locationAllergens)

        //Calculate location loop
        allergen.computeAllergensLocationLoop(this.locationAllergens, this._original.locationAllergens, function(res){
          locationAllergensLoop = res; //If location loop is empty, price location has not changed.
          logger.info('Ingredient post-save hook - Calculated allergens location loop %j.', locationAllergensLoop)
          cb(null, true)
      	})

    }, (ok, cb) => {

      logger.info('Ingredient post-save hook - Entering reference allergen ingredient post-save verification.')
      allergen.hasChanged(this.allergens, this._original.allergens, (hasChanged) => {
        if (hasChanged) {
		          logger.info('Ingredient post-save hook - Ingredient reference allergens has changed to %s: ', this.allergens)

		          let referenceAllergenObj = {
		            location: null,
		            allergens: this.allergens,
		            status: 'edit'
		          }
		          locationAllergensLoop.push(referenceAllergenObj) //Add reference price to location loop

        } else {
          logger.info('Ingredient post-save hook - Reference allergens have not changed.')
        }
        cb(null, true)
      })

    }, (ok, cb) => {  

        if(locationAllergensLoop.length > 0) {
          //Reference price or location prices of ingredient have changed. 

          logger.info('Ingredient post-save hook - Either reference allergens or location allergens of ingredient have changed.')
          logger.info('Ingredient post-save hook - Create updateRecipeCompAllergens task.')

          recipeAllergensQueue.updateRecipeCompAllergens(
            {
              title: 'Post-save ingredient hook - Update recipes composition allergens',
              id: this._id, 
              locationLoop: locationAllergensLoop 
            }
          );
        }
        cb(null, true)

  }, (ok, cb) => {    

      logger.info('Ingredient post-save hook - Entering measuring unit ingredient post-save verification.')

      let measUnitId = new ObjectId(this.measurementUnit)
      let originalMeasUnitId = new ObjectId(this._original.measurementUnit)

      if(!measUnitId.equals(originalMeasUnitId)) {
        logger.info('Measuring unit has changed in edit.')
        //Measurement unit of ingredient has changed. 
        //Update measuring unit of recipe composition that include this ingredient.
				updateMeasUnitQueue.create(
          {
            title: 'Ingredient post-save hook - Update measuring unit',
            id: this._id, 
            measUnit: this.measurementUnit 
          }
        ); 
        cb(null, true)

      } else {
         logger.info('Ingredient post-save hook - Measuring unit has not changed.')
         cb(null, true)
      }

    }, (ok, cb) => {

      logger.info('Ingredient post-save hook - Entering equivalence unit ingredient post-save verification.')
      
      if(this.equivalenceQty != this._original.equivalenceQty) {
        logger.info('Ingredient post-save hook - Equivalence unit has changed in edit.')
        //Equivalence quantity of ingredient has changed. 
        //Update price of subproducts that include this ingredient and use this equivalence quantity.
        recipeConvQueue.updateRecipeConvCost(
          {
            title: 'Post-save ingredient hook - Update recipes equivalence unit conversion value in recipes',
						id : this._id,
						equivalenceQty: this.equivalenceQty,
						equivalenceUnitFlag: true
          }
        );
				cb(null, true)	
					
      } else {
         logger.info('Ingredient post-save hook - Equivalence unit has not changed.')
         cb(null, true)        
      }


    }, (ok, cb) => { //Check if image has changed or has been deleted

    		let deleteImage = false;

    		if(this._original.gallery !=null && this.gallery == null) 
    		{
    			logger.info('Ingredient post-save hook - Image has been deleted')
    			deleteImage = true;
    		} 
    		else if(this._original.gallery !=null && this.gallery != null)
    		{
    			let galleryId = new ObjectId(this.gallery)
    			let originalGalleryId = new ObjectId(this._original.gallery)
    			
    			if(!galleryId.equals(originalGalleryId)) {
    				logger.info('Ingredient post-save hook - Image has changed')
    				deleteImage=true;
    			}
    			else
    			{
    				logger.info('Ingredient post-save hook - Image has not changed')
    			}
    		}
    		else
    		{
    			logger.info('Ingredient post-save hook - No image added or one has been added')
    		}

    		if(process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

    			logger.info('Create removeImage task.')
          removeImageQueue.removeImage(
            {
              title: 'Ingredient post-save hook - Remove image',
              id: this._original.gallery, 
            }
          );   			
    		}

    		cb(null, true)

    }], (err, doc) => {
        
        if(err) {
        	if(err == true) next();
        	else next(err);
        }
        else
        {
        	this._original = this.toJSON();
        	logger.info('Ingredient post-save hook - Finished ingredient post-save.')
        	next();
        }
  })
});

var model = mongoose.model('ingredient', ingredientSchema);
module.exports = model;