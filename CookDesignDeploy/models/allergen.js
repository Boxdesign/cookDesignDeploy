"use strict";

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var restrict = require('../helpers/restrict');
var {ObjectId} = require('mongodb');
var waterfall = require('async-waterfall');
var loggerHelper = require('../helpers/logger');
const logger = loggerHelper.allergenHooks;


//Definign schema
var allergenSchema = new Schema({
    lang: [{
        langCode: {
            type: String,
            maxlength: 3,
            required: true
        },
        name: {
                 type: String,
            required: true,
            unique: true,
            minlength: 2
        },
        description: {
            type: String,
            required: false,
            maxlength: 500
        }
    }],
    referenceNumber:{
        type:String,
        required:false,
        unique:false
    },
    code: String,
    gallery : {
        type: Schema.Types.ObjectId,
        ref: 'gallery',
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

// allergenSchema.statics.findDeps = (allergenId, cb) => {
//     restrict(cb, allergenId, 'allergen',[Ingredient]);
// };

/***************** Post init *********************/
allergenSchema.post('init', function() {
  //save original for later use
  this._original = this.toJSON();
});


/***************** Post save *********************/
allergenSchema.post('save', function (doc, next) {
  var removeImageQueue = require('../queues/removeImage')

  logger.info('Allergen post-save hook - Entering user post save hook.')

  waterfall([
    (cb) => {

    if(this._original) { //Edit
        cb(null, true)
        } else { //New ingredient creation. Nothing else to do, move on
            return next();
        }

    }, (ok, cb) => {

        let deleteImage = false;
        console.log(this._original.gallery, 'this._original.gallery')
        console.log(this.gallery, 'this.gallery')

        if(this._original.gallery !=null && this.gallery == null) 
        {
            logger.info('Allergen post-save hook - Image has been deleted')
            deleteImage = true;
        } 
        else if(this._original.gallery !=null && this.gallery != null)
        {
            let galleryId = new ObjectId(this.gallery)
            let originalGalleryId = new ObjectId(this._original.gallery)
            
            if(!galleryId.equals(originalGalleryId)) {
                logger.info('Allergen post-save hook - Image has changed')
                deleteImage=true;
            }
            else
            {
                logger.info('Allergen post-save hook - Image has not changed')
            }
        }
        else
        {
            logger.info('Allergen post-save hook - No image added or one has been added')
        }

        if(process.env.NODE_ENV == 'production' && deleteImage) { //Images are only deleted from database and S3 in production

      removeImageQueue.removeImage(
        {
          title: 'Allergen post-save hook - Remove image',
          id: this._original.gallery, 
        }
      );            
        }

        cb(null, true)

    }], (err, doc) => {
        if(err) return next(err);
        this._original = this.toJSON();
        logger.info('Ingredient post-save hook - Finished user post-save.')
        next();
  })
});

/***************** Pre remove *********************/
allergenSchema.pre('remove', function (next) {
  var Ingredient = require('./ingredient');
  //Note: this hook is called when the remove method is invoked in the model. This is the case when we delete an allergen.
  var allergen = this; //this is the document being removed
  var Allergen = this.constructor;  //this.constructor is the model
  var allergenId = new ObjectId(allergen._id);

  waterfall([
    (cb) => {  
      //Verify that there aren't any ingredients that include this allergen
      Ingredient.aggregate([
            {$unwind: {path: "$allergens"}},
            {$match: {'allergens.allergen': allergenId}}
          ], (err, docs) => {
                if (err) return cb(err);
                if (docs.length > 0) { //aggregate returns an array. Check if the array is not empty
                  var err = new Error('Allergen cannot be removed because it is used in at least one ingredient');
                  err.statusCode = 400;
                  return cb(err);
                } else {
                  cb(null, true);
                }            
          })
  }], (err, ok) => { 
      if (err) return next(err);
      next();
  })   
})

//creating model
var model = mongoose.model('allergen', allergenSchema);
module.exports = model;