"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('./../helpers/restrict');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');
var cost = require('./../helpers/cost');
var locHelper = require('./../helpers/locations');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.packagingHooks;


//Definign schema
var packagingSchema = new Schema({
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
        description: {
            type: String,
            required: false
        }
    }],
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
    averagePrice: {
        type: Number,
        required: false
    },
    measurementUnit: {
        type: Schema.Types.ObjectId,
        ref: 'measurementUnit',
        required: false
    },
    family: {
        type: Schema.Types.ObjectId,
        ref: 'family',
        required: true
    },
    subfamily: {
         type: Schema.Types.ObjectId,
         ref: 'family.subfamilies',
         required: false
     },
    last_account: {
        type: Schema.Types.ObjectId,
        ref: 'account',
        required: true
    },
    assigned_location: {
        type: Schema.Types.ObjectId,
        ref: 'location',
        required: false
    }
}, {
    timestamps: true
});


/****************  HOOKS  ***************************/

/***************** Post init *********************/
packagingSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});

/***************** Pre remove *********************/
packagingSchema.pre('remove', function (next) {
  //Note: this hook is called when the remove method is invoked in the model. This is the case when we delete a new packaging.
  var packaging = this; //this is the document being removed
  var Packaging = this.constructor;  //this.constructor is the model
  var packagingId = new ObjectId(packaging._id);
  var Product = require('mongoose').model('product');
  var ProviderArticle = require('../models/article')

  waterfall([
    (cb) => {
        //Verify that there aren't any products that contain this packaging
        Product.aggregate([
        {$unwind: {path: "$versions"}},
        {$match: {'versions.packaging.packaging': packagingId}}
      ], (err, docs) => {
            if (err) return cb(err);
            if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
              var err = new Error('Packaging cannot be removed because it is used in at least one product');
              err.statusCode = 400;
              return cb(err);
            } else {
                cb(null, true);
            }            
      })

	  }, (ok, cb)=> { //Check whether there are provider articles related to this packaging

	  	ProviderArticle.find({'category.item': this._id},{_id: 1}, (err, docs) =>{
	  		if(err) return cb(err)
	  		if(docs.length){
	  			let err = new Error('Packaging cannot be removed because it is linked to ' + docs.length + ' provider articles')
	  			return cb(err)
	  		}
	  		cb(null, true)
	  	})

    }], (err, ok) =>{  
      if (err) next(err);
      next();
  }) 
})


/***************** Post save *********************/
packagingSchema.post('save', function (doc, next) {
  var packaging = this; //this is the document being removed
  var Packaging = this.constructor;  //this.constructor is the model
  var locationLoop = [];
  var recipeCostQueue = require('../queues/recipePackCost')
  var removeImageQueue = require('../queues/removeImage')  

  waterfall([
    (cb) => {

      if(this._original) { //Edit
        cb(null, true)
      } else { //New packaging creation. Nothing else to do, move on
         return next();
      }

    }, (doc, cb) => {

        //Compute location loop. Computes list of cost locations deleted, changed or added.
        locHelper.computeLocationLoop(this.locationCost, this._original.locationCost, function(res){
          locationLoop = res; //If location loop is empty, price location has not changed.
          cb(null, true)
        })

    }, (doc, cb) => {

        if(this.referencePrice != this._original.referencePrice) {

          logger.info('Packaging post-save hook - Packaging reference price has changed to %s: ', this.referencePrice)

          let referencePriceObj = {
            location: null,
            unitCost: this.referencePrice,
            status: 'edit'
          }
          locationLoop.push(referencePriceObj) //Add reference price to location loop
        }

        if(locationLoop.length > 0) {
          //Reference price or location prices of packaging have changed. 

          logger.info('Packaging post-save hook -- Either reference price or location prices of packaging have changed.')

          recipeCostQueue.updateRecipePackCost(
            {
              title: 'Post-save packaging hook - Update recipes packaging cost',
              id: this._id, 
              locationLoop: locationLoop 
            }
          );
        } 
        cb(null, true)

          }, (ok, cb) => { //Check if image has changed or has been deleted

        let deleteImage = false;

        if(this._original.gallery !=null && this.gallery == null) 
        {
          logger.info('Packaging post-save hook - Image has been deleted')
          deleteImage = true;
        } 
        else if(this._original.gallery !=null && this.gallery != null)
        {
          let galleryId = new ObjectId(this.gallery)
          let originalGalleryId = new ObjectId(this._original.gallery)
          
          if(!galleryId.equals(originalGalleryId)) {
            logger.info('Packaging post-save hook - Image has changed')
            deleteImage=true;
          }
          else
          {
            logger.info('Packaging post-save hook - Image has not changed')
          }
        }
        else
        {
          logger.info('Packaging post-save hook - No image added or one has been added')
        }

        if(process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

          removeImageQueue.removeImage(
            {
              title: 'Packaging post-save hook - Remove image',
              id: this._original.gallery, 
            }
          );        
        }

        cb(null, true)

    }], (err, doc) =>{

            if(err) return next(err);
            this._original = this.toJSON();
            next();
    })
});

//creating model
var model = mongoose.model('packaging', packagingSchema);
module.exports = model;