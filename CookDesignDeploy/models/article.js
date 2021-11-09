var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');
var async = require('async');
var hasAllergensSchema = require('mongoose').model('hasAllergens').schema;
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.articleHooks;

//Define schema
var articleSchema = new Schema({
	lang: [{
	    langCode: {
	      type: String,
	      maxlength: 3,
	      required: true
	   },
	   name: {
	      type: String,
	      uppercase: true
	   },
	   description: {
	      type: String,
	      uppercase: true,
	      maxlength: 500
	   }
	}],
	category: { //Dynamic reference to either ingredient or packaging. kind can either be 'ingredient' or 'packaging'
		kind: String,
		item: { 
			type: Schema.Types.ObjectId, 
			refPath: 'category.kind',
	    validate: {
	      validator: function(v) {
	        return v != null;
	      },
	      message: 'Linked ingredient or packaging must be set!'
	    }
		}
	},
	allergens: [
        hasAllergensSchema
    ],
	provider: {
		type: Schema.Types.ObjectId,
		ref: 'provider',
    validate: {
      validator: function(v) {
        return v != null;
      },
      message: 'Provider must be set!'
    }
	},
	document: [{
		type: Schema.Types.ObjectId, 
		ref: 'document'
	}],
	location: [{
		type: Schema.Types.ObjectId, 
		ref: 'location',
		required: true
	}],
	reference: {
		type: String,
		uppercase: true
	},
	packFormat: {
		type: Schema.Types.ObjectId, 
		ref: 'packFormat'
	},
	packUnits: {
		type: Number,
		default: 0
	},
	grossWeightPerUnit: {
		type: Number,
		default: 0
	},
	netWeightPerUnit: {
		type: Number,
		default: 0
	},
	totalGrossWeight: {
		type: Number,
		default: 0	
	},
	packPrice: {
		type: Number,
		default: 0
	},	
	grossPricePerUnit: {
		type: Number,
		default:0
	},	
	netPricePerUnit: {
		type: Number,
		default:0
	},	
	grossPrice: {  //grosPrice per measuring unit
		type: Number,
		default:0
	},	
	netPrice: {  //netPrice per measuring unit
		type: Number,
		default:0
	},
	hasDataSheet: {  //netPrice per measuring unit
		type: Boolean,
		default:false
	},
	active: {
 		type: Boolean,
 	},
 	externalReference : { //Use for SAP codes, etc...
 		type: String
 	},
 	last_account: {
 		type: Schema.Types.ObjectId,
 		ref: 'account',
 		required: true
 	}
},
{
	timestamps: true
});

/***************** Post init *********************/
articleSchema.post('init', function() {
  this._original = this.toJSON();
});

/***************** Pre save *********************/
articleSchema.pre('save', function(next) {
	var article = this;
	var err;

	if(!article.location.length) {
		logger.error('Article pre-save hook - Article must have at least one location assigned')
		err = new Error('Article must have at least one location assigned')
		return next(err)
	}	

	next();

});


/***************** Post save *********************/
articleSchema.post('save', function (doc, next) {
	var article = this;
  var Article = this.constructor;  //this.constructor is the model
  var articleId = new ObjectId(article._id);
  var currentNetPrice;
  var originalNetPrice;
  var locationHasChanged=false;
  var locCostHelper = require('../helpers/location-cost');
  var location = require('../helpers/locations');
	var articleQueue = require('../queues/article')
	var netPriceHasChanged = false;
	let allergenHasChanged = false;
	var allergenHelper = require('../helpers/allergen')
  var allergenQueue = require('../queues/refreshLocAllergens')


  logger.info('||||=============>>>>>>>>>>>> Entering article post-save hook.')

	waterfall([
	  (cb) => { 
		  	//1. Check whether it is an edit or new addition
		  	//2. If new addition, check whether it has a net price different than zero. If it does, 
		  	// then calculate the average net price and update the ing/pack's net price field.
		  	//3. If an edit, check whether net price has changed. If net price has changed, recalculate the ing/pack's average price and 
		  	// update the average field. In case net price has changed and it is now zero, then this article is not taken into consideration when
		  	//calculating the average net price.

		  	if(this._original) { //article edit

		  		logger.info('Article post-save hook - Article edit, move to next step.')
		  		cb(null)

			  } else { //new article
			  	//Calculate article location cost
			  	logger.info('Article post-save hook - New article, create calculateArticleAvgCost and location allergens job')
			  	
			  	articleQueue.calculateArticleAvgCost(
			  			{
			  				title: 'Post-save article hook - Calculate and update new article\'s average location cost',
			  				article: this
			  			}
			  		);

			  	if(this.category.kind == 'ingredient') {
			  		setTimeout( () => {
			          allergenQueue.refreshLocAllergens(
			            {
			              title: 'Post-save article hook - Calculate and update new article\'s location allergens',
			              ingId: this.category.item
			            }
			          );			  			
			  		}, 3000);
		        }

			  	return cb(true) 
			  }

		  }, (cb) => { //Check whether linked ingredient or packaging has changed in provider article

		  		let originalLinked = new ObjectId(this._original.category.item);
		  		let currentLinked = new ObjectId(this.category.item)

		  		if(originalLinked.equals(currentLinked)) {
		  			logger.info('Post-save article hook - Linked ingredient or packaging has not changed. Move on to next step.')
		  			cb(null)
		  		}
		  		else
		  		{
		  			logger.info('Post-save article hook - Linked ingredient or packaging has changed. Recalculate average location cost for previous and currently linked ingredient or packaging.')

		  			articleQueue.calculateArticleAvgCost(
			  			{
			  				title: 'Post-save article hook - Linked ingredient or packaging has changed. Calculate and update current article\'s average location cost',
			  				article: this
			  			}
		  			);

		  			articleQueue.calculateArticleAvgCost(
			  			{
			  				title: 'Post-save article hook - Linked ingredient or packaging has changed. Calculate and update original article\'s average location cost',
			  				article: this._original
			  			}
		  			);

				  	if(this.category.kind == 'ingredient') {
				  		setTimeout( () => {
				          allergenQueue.refreshLocAllergens(
				            {
				              title: 'Post-save article hook - Linked ingredient has changed. Calculate and update current article\'s location allergens',
				              ingId: this.category.item
				            }
				          );

				          allergenQueue.refreshLocAllergens(
				            {
				              title: 'Post-save article hook - Linked ingredient has changed. Calculate and update original article\'s location allergens',
				              ingId: this._original.category.item
				            }
				          );				  			
				  		}, 3000);

		        }

  			  	return cb(true) 
		  		}


		  }, (cb) => {

		  		logger.info('Article post-save hook - Check whether location of edited article has changed.')
		  		//Check whether location has changed
			  	location.compareLocation(this.location, this._original.location, (res) => {
				  		locationHasChanged=!res;
				  		if(locationHasChanged) logger.info('Article post-save hook - Location changed: %s', locationHasChanged)
				  		else logger.info('Article post-save hook - Location has not changed')
				  		cb(null)
				  	})

		  }, (cb) => {

			  	currentNetPrice = this.netPrice;
		  		originalNetPrice = this._original.netPrice;		  			

			  	if(currentNetPrice != originalNetPrice) {
			  		logger.info('Article post-save hook - Article net price has changed')
			  		netPriceHasChanged=true;
			  	}
			  	else
			  	{
			  		logger.info('Article post-save hook - Article net price has not changed')
			  	}		  	

			  	cb(null)

		  }, (cb) => {

	  		if(netPriceHasChanged || locationHasChanged) { 
			  	
			  	logger.info('Article post-save hook - Either cost or location have changed. Calculate and save ingredient or package average price.')
	  			
	  			articleQueue.calculateArticleAvgCost(
		  			{
		  				title: 'Post-save article hook - Calculate and update edited article\'s average location cost',
		  				article: this
		  			}
		  		);
					cb(null)

	  		} else { //nothing to do, move on
	  			logger.info('Article post-save hook - Neither netPrice or location have changed. Nothing to do.')
	  			cb(null)
	  		}

		  }, (cb) => {

		     if (this.category.kind == 'ingredient') {

   			     logger.info('Article post-save hook - Verifying if allergens have changed.')

		         allergenHelper.hasChanged(this.allergens, this._original.allergens, (hasChanged) => {
		             allergenHasChanged = hasChanged
		             cb(null)
		         })
		     } else {
		         cb(null)
		     }

		     }, (cb) => {

		         if (allergenHasChanged || locationHasChanged ) {
		         		 if(allergenHasChanged) logger.info('Article post-save hook - allergens have changed, launch refreshLocAllergens task')
		         		 if(locationHasChanged) logger.info('Article post-save hook - location has changed, launch refreshLocAllergens task')

 		             //Ingredient's allergens have changed. 
		             //Update allergens in subproducts, products and dishes that contain this ingredient.
		             setTimeout(() => {
		                 allergenQueue.refreshLocAllergens({
		                     title: 'Post-save article hook - Update ingredient location allergens',
		                     ingId: this.category.item
		                 });
		             }, 3000);
		             cb(null)

		         } else {
		             logger.info('Article post-save hook - Allergens have not changed.')
		             cb(null)
		         }


		 }], (err) => {
	      if(err) { 
	      	if (err==true) {
	      		this._original = this.toJSON();
	      		next();
	      	} else {
		      	logger.error(err)
		      	next(err);	      		
	      	}
	      }
	      else
	      {
	      	this._original = this.toJSON();
	      	next();
	      }
	  })
});

/***************** Post remove *********************/
articleSchema.post('remove', function (doc, next) {
	var article = this; //article just removed?
  var Article = this.constructor;  //this.constructor is the model
  var articleId = new ObjectId(article._id);
  var locCostHelper = require('../helpers/location-cost');
 	var articleQueue = require('../queues/article')

  logger.info('Entering article post-remove hook.')
  logger.info('Article just removed: %j', this)

  waterfall([
    (cb) => { 
    //1. Re-calculate the ingredient or packaging average price and update the average price field.
    //2. If there aren't any articles left for this ing/pack, then set average price to zero.
			logger.info('Post-remove article hook - calculated average cost.')    
			
			articleQueue.calculateArticleAvgCost(
				{
					title: 'Post-remove article hook - Calculate and update article\'s average location cost',
					article: this, 
					locationLoop: this.location 
				}
			);
	    cb(null, doc)

	}], (err, ok) => {
	    if (err) { 
	    	return next(err);
	    }
	    next();
	})   
})

/************** Indexes *********************/
articleSchema.index({"category.item": 1, location: 1})

//create model
var model = mongoose.model('article', articleSchema);
module.exports = model;