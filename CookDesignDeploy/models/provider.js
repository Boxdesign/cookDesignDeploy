var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var validator = require('validator');
require('../models/address');
var addressSchema = require('mongoose').model('address').schema;
require('../models/contact');
var contactSchema = require('mongoose').model('contact').schema;
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');
var Article = require('./article');
var async = require('async');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.providerHooks;

//Define schema
var providerSchema = new Schema({
	commercialName: {
		type: String,
		required: true,
		uppercase: true
	},
	legalName: {
		type: String,
		uppercase: true,
	},
	address: [
		addressSchema
	],
	contact: [
		contactSchema
	],
	document: [{
		type: Schema.Types.ObjectId, 
		ref: 'document'
	}],
	identification: { 
		type: String 
	},
	externalReference : { //Use for SAP codes, etc...
 		type: String
 	},
 	taxId : {
 		type: String
 	},
	telephone: [{
		label: String,
		value: String
	}],
	email: [{
		type: String,
		uppercase: true,
		validate: {
          validator: function(v) {
            return validator.isEmail(v);
          },
          message: '{VALUE} is not a valid email!'
        },
	}],
 	url: {
 		type: String,
 		uppercase: true,
 		validate: {
          validator: function(v) {
            return validator.isURL(v);
          },
          message: '{VALUE} is not a valid URL!'
        },
 	},
 	approved: {
 		type: Boolean,
 		default: false,
 	},
 	provider: {
 		type: Boolean,
 		default: true
 	},
 	creditor: {
 		type: Boolean,
 		default: false
 	},
 	active: {
 		type: Boolean,
 		default: true
 	},
	location: [{
		type: Schema.Types.ObjectId, 
		ref: 'location',
		required: true
	}],
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
providerSchema.post('init', function() {
  this._original = this.toJSON();
});

/***************** Pre remove *********************/
providerSchema.pre('remove', function (next) {
  var provider = this; //this is the document being removed
  var Provider = this.constructor;  //this.constructor is the model
  var providerId = new ObjectId(provider._id);

  logger.info('Entering provider pre-remove hook.')

  waterfall([
    (cb) => {
	    //Verify whether the provider has articles
	    Article.find({'provider':providerId})
	    .exec((err,doc) =>{
	    	if(err) return cb(err)
	    	if(doc.length>0) {
	    		logger.info('Provider cannot be removed because it has articles.')
	    		var err = new Error('Provider cannot be removed because it has articles.');
	            err.statusCode = 400;
	            return cb(err);
	    	}
	    	cb(null, true)
	    })

	}], (err, ok) => {
	    if (err) { 
	    	return next(err);
	    }
	    logger.info('Clear to remove provider.')
	    next();
	})   
})

/***************** Post save *********************/
providerSchema.post('save', function (doc, next) {
	var location = require('../helpers/locations')
	var provider = this;
  var providerId = new ObjectId(provider._id);
	var equal;
	var deletedLocations;
	var providerQueue = require('../queues/provider')

	logger.info("Entering provider post-save hook.")

	waterfall([
	  (cb) => { //check whether location has changed

	  if(provider._original) { //check whether it's a new provider creation

	  	logger.info("Provider edit.")
	  	
	  	//location.compareLocation(provider.location, provider._original.location, (res) => {
	  	location.deletedLocations(provider.location, provider._original.location, (res) => {
	  		//equal = res;
	  		deletedLocations = res;
	  		logger.info("deletedLocations.", deletedLocations.length)
	  	});
	  	//if (!equal) { //location array has changed, update all provider's articles with the new location.
	  	if (deletedLocations.length) { //location array has changed, there are deleted locations

	  		//logger.info("Location array has changed. Update all provider's articles with new locations")
	  		logger.info("Location array has changed. Update all provider's articles with deleted locations")

	  		logger.info('Adding provider job to the queue.')
	  		
	  		providerQueue.create(
	  			{
	  				title: 'Update provider\'s articles with new location',
	  				providerId: providerId, 
	  				provider: provider,
	  				deletedLocations: deletedLocations
	  			});

	  		cb(null, true)

	  	} else {  //location has not changed, move on.
 		  		logger.info("Location has not changed, move on.")
	  			cb(null, true)
	  	}
	  } else { //new provider creation, move on.
 		  	logger.info("New provider creation, move on.")
	  		cb(null, true)
	  }

	  }], (err, doc) =>{
	      if(err) return next(err);
	      this._original = this.toJSON();
	      next();
	  })
});

//create model
var model = mongoose.model('provider', providerSchema);
module.exports = model;